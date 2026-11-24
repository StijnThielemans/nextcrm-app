import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  AuthenticationError,
  AuthorizationError,
  assertCanReadDocument,
  notFoundOrForbiddenResponse,
  requireAuthenticated,
  unauthorizedResponse,
} from "@/lib/authz";
import { isDocumentKey, isUploadThingUrl, keyFromUrl } from "@/lib/documents/file-key";
import { MINIO_BUCKET, MINIO_ENDPOINT, MINIO_PUBLIC_URL, minioClient } from "@/lib/minio";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prismaBase } from "@/lib/prisma-base";
import { measuresFromSheets, type PlanMark, type PlanSheet } from "@/lib/raamstudio/opening-measures";
import { readPdfPageWords } from "@/lib/raamstudio/pdf-page-words";

export const runtime = "nodejs";

type SheetRequest = {
  documentId: string;
  page: number;
  name: string;
  role: "floor" | "facade";
  rotation: number;
  marks: PlanMark[];
};

const cache = new Map<string, { width: number; height: number; words: PlanSheet["words"]; lines: PlanSheet["lines"] }>();

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuthenticated();
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    throw error;
  }

  const body = await request.json().catch(() => null) as { sheets?: unknown } | null;
  const sheets = parseSheets(body?.sheets);
  if (!sheets) return NextResponse.json({ error: "De maten konden niet worden gelezen." }, { status: 400 });

  const documentIds = [...new Set(sheets.map((sheet) => sheet.documentId))];
  try {
    for (const documentId of documentIds) await assertCanReadDocument(user, documentId);
  } catch (error) {
    if (error instanceof AuthorizationError) return notFoundOrForbiddenResponse();
    throw error;
  }

  const floors: { sheet: PlanSheet; marks: PlanMark[] }[] = [];
  const facades: { sheet: PlanSheet; marks: PlanMark[] }[] = [];
  for (const documentId of documentIds) {
    const wanted = sheets.filter((sheet) => sheet.documentId === documentId);
    let pages;
    try {
      pages = await wordsFor(documentId, wanted.map((sheet) => sheet.page + 1));
    } catch {
      continue;
    }
    for (const sheet of wanted) {
      const page = pages.get(sheet.page + 1);
      if (!page) continue;
      const built = {
        name: sheet.name,
        width: page.width,
        height: page.height,
        words: page.words,
        lines: page.lines,
        rotation: sheet.rotation,
        role: sheet.role,
      };
      const target = sheet.role === "facade" ? facades : floors;
      target.push({ sheet: built, marks: sheet.marks });
    }
  }

  return NextResponse.json({ measures: measuresFromSheets({ floors, facades }) });
}

function parseSheets(value: unknown): SheetRequest[] | null {
  if (!Array.isArray(value) || value.length > 40) return null;
  const sheets: SheetRequest[] = [];
  let marks = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const sheet = item as Record<string, unknown>;
    const documentId = typeof sheet.documentId === "string" ? sheet.documentId : "";
    const name = typeof sheet.name === "string" ? sheet.name.trim().slice(0, 80) : "";
    const page = sheet.page;
    const rotation = sheet.rotation === 90 || sheet.rotation === 180 || sheet.rotation === 270 ? sheet.rotation : 0;
    const role = sheet.role === "floor" || sheet.role === "facade" ? sheet.role : null;
    if (!/^[0-9a-f-]{16,40}$/i.test(documentId) || !name || !role) return null;
    if (typeof page !== "number" || !Number.isInteger(page) || page < 0 || page > 399) return null;
    if (!Array.isArray(sheet.marks) || sheet.marks.length > 80) return null;
    const parsed: PlanMark[] = [];
    for (const mark of sheet.marks) {
      if (!mark || typeof mark !== "object") return null;
      const row = mark as Record<string, unknown>;
      const number = typeof row.number === "string" ? row.number.trim().slice(0, 40) : "";
      if (!number || typeof row.x !== "number" || typeof row.y !== "number") return null;
      if (row.x < 0 || row.x > 1 || row.y < 0 || row.y > 1) return null;
      parsed.push({ number, x: row.x, y: row.y });
      marks += 1;
      if (marks > 200) return null;
    }
    if (parsed.length) sheets.push({ documentId, page, name, role, rotation, marks: parsed });
  }
  return sheets;
}

async function wordsFor(documentId: string, pages: number[]) {
  const doc = await prismaBase.documents.findUnique({
    where: { id: documentId },
    select: { key: true, document_file_url: true, document_name: true, document_file_mimeType: true },
  });
  if (!doc) throw new Error("missing");
  const pdf = doc.document_file_mimeType === "application/pdf" || doc.document_name.toLowerCase().endsWith(".pdf");
  if (!pdf) throw new Error("missing");
  const bytes = await documentBytes(doc);
  const stamp = createHash("sha1").update(bytes).digest("hex").slice(0, 16);
  const result = new Map<number, { width: number; height: number; words: PlanSheet["words"]; lines: PlanSheet["lines"] }>();
  const missing: number[] = [];
  for (const page of pages) {
    const cached = cache.get(`${documentId}:${page}:${stamp}`);
    if (cached) result.set(page, cached);
    else missing.push(page);
  }
  if (missing.length) {
    const read = await readPdfPageWords(bytes, missing);
    for (const [page, words] of read) {
      cache.set(`${documentId}:${page}:${stamp}`, words);
      result.set(page, words);
    }
    while (cache.size > 24) {
      const oldest = cache.keys().next().value;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }
  return result;
}

async function documentBytes(doc: {
  key: string | null;
  document_file_url: string;
  document_name: string;
}): Promise<Buffer> {
  if (isUploadThingUrl(doc.document_file_url)) {
    const response = await fetch(doc.document_file_url);
    if (!response.ok) throw new Error("missing");
    return Buffer.from(await response.arrayBuffer());
  }
  const key = doc.key || keyFromUrl(doc.document_file_url, MINIO_BUCKET!, [MINIO_PUBLIC_URL, MINIO_ENDPOINT!]);
  if (!key || !isDocumentKey(key) || !MINIO_BUCKET) throw new Error("missing");
  const object = await minioClient.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
  if (!object.Body) throw new Error("missing");
  const chunks: Buffer[] = [];
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
