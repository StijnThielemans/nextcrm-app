import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SalesError } from "../errors";
import { readZip, type ZipEntry } from "./read-zip";
import { rtfToText } from "./rtf";

/**
 * Orgadata documents this quote export (help.orgadata.com, ERP export via SQLite):
 * tables Projects, Elevations and ReportOfferTexts.
 * Projects.Name, Projects.OrderNo.
 * Elevations.Name, Elevations.Description, Elevations.Amount.
 * ReportOfferTexts.ElevationID, ReportOfferTexts.Description (path to an RTF file).
 * The public help does not name the column that points at a position drawing.
 * A drawing is used only when a cell value resolves to an image inside this zip.
 * No sample export from this installation was available, so a file that lacks
 * those tables or whose ElevationID does not join is refused.
 */

const IMAGE = /\.(png|jpe?g|gif|webp|bmp|emf|wmf)$/i;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type ParsedDrawing = { fileName: string; mime: string; bytes: Buffer };

export type ParsedPosition = {
  elevationKey: string;
  name: string;
  description: string;
  quantity: number;
  quoteText: string | null;
  drawing: ParsedDrawing | null;
};

export type ParsedLogikalExport = {
  projectName: string | null;
  orderNo: string | null;
  projectKey: string | null;
  reference: string | null;
  positions: ParsedPosition[];
};

type Column = { name: string; pk: number };
type Row = Record<string, unknown>;

export function parseLogikalExport(zip: Buffer): ParsedLogikalExport {
  const entries = readZip(zip);
  const files = new Map<string, Buffer>();
  for (const entry of entries) files.set(entry.path.toLowerCase(), entry.bytes);
  const sqlite = entries.filter((entry) => entry.path.toLowerCase().endsWith(".sqlite3"));
  if (sqlite.length !== 1) throw new SalesError("logikalExportInvalid");
  return readDatabase(sqlite[0].bytes, entries, files);
}

function readDatabase(bytes: Buffer, entries: ZipEntry[], files: Map<string, Buffer>): ParsedLogikalExport {
  const dir = mkdtempSync(path.join(tmpdir(), "logikal-"));
  const file = path.join(dir, "export.sqlite3");
  writeFileSync(file, bytes);
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const tables = tableNames(db);
    const projects = requiredTable(tables, "Projects");
    const elevations = requiredTable(tables, "Elevations");
    const texts = requiredTable(tables, "ReportOfferTexts");
    const projectCols = columnInfo(db, projects);
    const elevationCols = columnInfo(db, elevations);
    const textCols = columnInfo(db, texts);
    const nameCol = requiredColumn(projectCols, "Name");
    const orderCol = column(projectCols, "OrderNo");
    const keyCol = column(projectCols, "ProjectID") ?? column(projectCols, "ID");
    const elevationName = requiredColumn(elevationCols, "Name");
    const elevationDescription = requiredColumn(elevationCols, "Description");
    const amountCol = requiredColumn(elevationCols, "Amount");
    const textElevation = requiredColumn(textCols, "ElevationID");
    const textDescription = requiredColumn(textCols, "Description");
    const elevationId = column(elevationCols, "ElevationID") ?? column(elevationCols, "ID") ?? primaryKey(elevationCols);
    if (!elevationId) throw new SalesError("logikalStructureUnknown");

    const projectRows = selectAll(db, projects, projectCols);
    if (projectRows.length === 0) throw new SalesError("logikalStructureUnknown");
    const first = projectRows[0];
    const projectName = text(first[nameCol]);
    const orderNo = orderCol ? text(first[orderCol]) : null;
    const projectKey = keyCol ? text(first[keyCol]) : null;
    const sameProject = projectRows.every((row) => (
      text(row[nameCol]) === projectName
      && (orderCol ? text(row[orderCol]) === orderNo : true)
      && (keyCol ? text(row[keyCol]) === projectKey : true)
    ));
    if (!sameProject) throw new SalesError("logikalStructureUnknown");

    const elevationRows = selectAll(db, elevations, elevationCols);
    const textRows = selectAll(db, texts, textCols);
    assertJoin(elevationRows, elevationId, textRows, textElevation);

    const positions = elevationRows.map((row) => {
      const elevationKey = text(row[elevationId]);
      if (!elevationKey) throw new SalesError("logikalStructureUnknown");
      const description = text(row[elevationDescription]) ?? "";
      const related = textRows.filter((item) => text(item[textElevation]) === elevationKey);
      const quoteText = quoteFrom(related, textDescription, entries, files);
      return {
        elevationKey,
        name: text(row[elevationName]) || elevationKey,
        description,
        quantity: quantity(row[amountCol]),
        quoteText,
        drawing: drawingFrom(row, elevationCols, related, textCols, entries, files),
      };
    });
    const seen = new Set<string>();
    for (const position of positions) {
      if (seen.has(position.elevationKey)) throw new SalesError("logikalStructureUnknown");
      seen.add(position.elevationKey);
    }
    positions.sort((a, b) => a.name.localeCompare(b.name, "nl", { numeric: true }));
    return {
      projectName,
      orderNo,
      projectKey,
      reference: orderNo || projectKey,
      positions,
    };
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertJoin(elevations: Row[], elevationId: string, texts: Row[], textElevation: string) {
  if (texts.length === 0) return;
  const keys = new Set(elevations.map((row) => text(row[elevationId])).filter((value): value is string => Boolean(value)));
  const matched = texts.some((row) => keys.has(text(row[textElevation]) ?? ""));
  if (!matched) throw new SalesError("logikalJoinUnknown");
}

function quoteFrom(rows: Row[], descriptionCol: string, entries: ZipEntry[], files: Map<string, Buffer>): string | null {
  const parts: string[] = [];
  for (const row of rows) {
    const raw = text(row[descriptionCol]);
    if (!raw) continue;
    const file = resolveFile(raw, entries, files);
    if (file && raw.toLowerCase().includes(".rtf")) {
      const plain = rtfToText(file.toString("latin1"));
      if (plain) parts.push(plain);
      continue;
    }
    if (looksLikePath(raw)) continue;
    parts.push(raw);
  }
  const joined = parts.join("\n\n").trim();
  return joined ? joined.slice(0, 20000) : null;
}

function drawingFrom(
  elevation: Row,
  elevationCols: Column[],
  texts: Row[],
  textCols: Column[],
  entries: ZipEntry[],
  files: Map<string, Buffer>,
): ParsedDrawing | null {
  const candidates = [...cells(elevation, elevationCols), ...texts.flatMap((row) => cells(row, textCols))];
  for (const value of candidates) {
    if (!IMAGE.test(value)) continue;
    const bytes = resolveFile(value, entries, files);
    if (!bytes) continue;
    const fileName = value.split(/[/\\]/).pop() ?? "drawing";
    const mime = mimeFor(fileName);
    if (!mime) continue;
    return { fileName, mime, bytes };
  }
  return null;
}

function cells(row: Row, columns: Column[]): string[] {
  return columns.map((item) => text(row[item.name])).filter((value): value is string => Boolean(value));
}

function resolveFile(raw: string, entries: ZipEntry[], files: Map<string, Buffer>): Buffer | null {
  const slash = raw.replace(/\\/g, "/").replace(/^\.\//, "");
  const parts = slash.split("/").filter(Boolean);
  for (let length = parts.length; length >= 1; length -= 1) {
    const candidate = parts.slice(parts.length - length).join("/").toLowerCase();
    const direct = files.get(candidate);
    if (direct) return direct;
    const found = entries.find((entry) => entry.path.toLowerCase() === candidate || entry.path.toLowerCase().endsWith(`/${candidate}`));
    if (found) return found.bytes;
  }
  return null;
}

function looksLikePath(value: string): boolean {
  return value.includes("/") || value.includes("\\") || value.toLowerCase().endsWith(".rtf");
}

function mimeFor(fileName: string): string | null {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "bmp") return "image/bmp";
  if (ext === "emf") return "image/emf";
  if (ext === "wmf") return "image/wmf";
  return null;
}

function quantity(value: unknown): number {
  const number = typeof value === "bigint" ? Number(value) : typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number) || number < 0) throw new SalesError("logikalStructureUnknown");
  return Math.round(number * 100) / 100;
}

function text(value: unknown): string | null {
  if (value == null) return null;
  const string = String(value).trim();
  return string.length > 0 ? string : null;
}

function tableNames(db: DatabaseSync): Map<string, string> {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
  return new Map(rows.map((row) => [row.name.toLowerCase(), row.name]));
}

function requiredTable(tables: Map<string, string>, name: string): string {
  const found = tables.get(name.toLowerCase());
  if (!found || !IDENT.test(found)) throw new SalesError("logikalStructureUnknown");
  return found;
}

function columnInfo(db: DatabaseSync, table: string): Column[] {
  return db.prepare(`PRAGMA table_info(${quote(table)})`).all() as Column[];
}

function column(columns: Column[], name: string): string | null {
  return columns.find((item) => item.name.toLowerCase() === name.toLowerCase() && IDENT.test(item.name))?.name ?? null;
}

function requiredColumn(columns: Column[], name: string): string {
  const found = column(columns, name);
  if (!found) throw new SalesError("logikalStructureUnknown");
  return found;
}

function primaryKey(columns: Column[]): string | null {
  const key = columns.filter((item) => item.pk > 0).sort((a, b) => a.pk - b.pk)[0];
  return key && IDENT.test(key.name) ? key.name : null;
}

function selectAll(db: DatabaseSync, table: string, columns: Column[]): Row[] {
  const list = columns.map((item) => `${quote(item.name)} AS ${quote(item.name)}`).join(", ");
  return db.prepare(`SELECT rowid AS __rowid, ${list} FROM ${quote(table)} ORDER BY rowid`).all() as Row[];
}

function quote(identifier: string): string {
  if (!IDENT.test(identifier)) throw new SalesError("logikalStructureUnknown");
  return `"${identifier}"`;
}
