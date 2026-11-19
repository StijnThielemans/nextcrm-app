import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SalesError } from "../../errors";
import { packZip, readZip } from "../read-zip";
import { parseLogikalExport } from "../parse-export";
import { matchLogikalExport } from "../match";
import { runLockedCreate, type CreateDeps, type LinkSnapshot } from "../create-project";
import { importLogikalPositions } from "../import-positions";
import { logikalGateway } from "../gateway";
import { rtfToText } from "../rtf";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function sqlite(setup: (db: DatabaseSync) => void): Buffer {
  const dir = mkdtempSync(path.join(tmpdir(), "logikal-test-"));
  const file = path.join(dir, "export.sqlite3");
  const db = new DatabaseSync(file);
  setup(db);
  db.close();
  const bytes = readFileSync(file);
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

const SCHEMA = `
  CREATE TABLE Projects (
    ID INTEGER PRIMARY KEY,
    Name TEXT,
    OrderNo TEXT,
    OfferDiscount1 REAL
  );
  CREATE TABLE Elevations (
    ID INTEGER PRIMARY KEY,
    Name TEXT,
    Description TEXT,
    Amount REAL,
    ElevationGroupID INTEGER,
    Note TEXT
  );
  CREATE TABLE ReportOfferTexts (
    ID INTEGER PRIMARY KEY,
    ElevationID INTEGER,
    Description TEXT,
    Price REAL
  );
`;

function quoteZip(options?: { orderNo?: string; name?: string; withDrawing?: boolean }) {
  const orderNo = options?.orderNo ?? "LOG-1";
  const name = options?.name ?? "Ramen living";
  const withDrawing = options?.withDrawing !== false;
  const db = sqlite((database) => {
    database.exec(SCHEMA);
    database.prepare("INSERT INTO Projects (ID, Name, OrderNo) VALUES (10, ?, ?)").run(name, orderNo);
    database.prepare("INSERT INTO Elevations (ID, Name, Description, Amount, Note) VALUES (1, '1.1', 'Draaikiep', 2, ?)").run(withDrawing ? "drawings/1.png" : null);
    database.prepare("INSERT INTO Elevations (ID, Name, Description, Amount, Note) VALUES (2, '1.2', 'Vast raam', 1, NULL)").run();
    database.prepare("INSERT INTO ReportOfferTexts (ElevationID, Description, Price) VALUES (1, 'texts/1.rtf', 100)").run();
    database.prepare("INSERT INTO ReportOfferTexts (ElevationID, Description, Price) VALUES (2, 'texts/missing.rtf', 50)").run();
  });
  const files = [
    { path: "export.sqlite3", bytes: db },
    { path: "texts/1.rtf", bytes: Buffer.from("{\\rtf1\\ansi Draaikiep\\par wit}", "latin1") },
  ];
  if (withDrawing) files.push({ path: "drawings/1.png", bytes: PNG });
  return packZip(files, "deflate");
}

describe("logikal zip", () => {
  it("refuses a path that leaves the archive", () => {
    const zip = packZip([{ path: "../secret.sqlite3", bytes: Buffer.from("no") }]);
    expect(() => readZip(zip)).toThrow(SalesError);
    try {
      readZip(zip);
    } catch (error) {
      expect(error).toBeInstanceOf(SalesError);
      expect((error as SalesError).code).toBe("logikalZipUnsafe");
    }
  });

  it("refuses an absolute path", () => {
    const zip = packZip([{ path: "/tmp/export.sqlite3", bytes: Buffer.from("no") }]);
    expect(() => readZip(zip)).toThrow(expect.objectContaining({ code: "logikalZipUnsafe" }));
  });

  it("reads a deflated entry", () => {
    const zip = packZip([{ path: "notes/a.txt", bytes: Buffer.from("hallo") }], "deflate");
    expect(readZip(zip)).toEqual([{ path: "notes/a.txt", bytes: Buffer.from("hallo") }]);
  });
});

describe("logikal quote export", () => {
  it("keeps one row when the quantity is greater than one and reads the RTF", () => {
    const parsed = parseLogikalExport(quoteZip());
    expect(parsed.projectName).toBe("Ramen living");
    expect(parsed.reference).toBe("LOG-1");
    expect(parsed.positions).toHaveLength(2);
    const first = parsed.positions.find((position) => position.name === "1.1");
    expect(first?.quantity).toBe(2);
    expect(first?.quoteText).toContain("Draaikiep");
    expect(first?.drawing?.bytes.equals(PNG)).toBe(true);
    const second = parsed.positions.find((position) => position.name === "1.2");
    expect(second?.drawing).toBeNull();
    expect(second?.quoteText).toBeNull();
    expect(second?.description).toBe("Vast raam");
  });

  it("fails closed when the documented tables are missing", () => {
    const db = sqlite((database) => {
      database.exec("CREATE TABLE Projects (Name TEXT)");
    });
    const zip = packZip([{ path: "export.sqlite3", bytes: db }]);
    expect(() => parseLogikalExport(zip)).toThrow(expect.objectContaining({ code: "logikalStructureUnknown" }));
  });

  it("fails closed when ElevationID does not meet an elevation", () => {
    const db = sqlite((database) => {
      database.exec(SCHEMA);
      database.prepare("INSERT INTO Projects (ID, Name, OrderNo) VALUES (1, 'A', 'B')").run();
      database.prepare("INSERT INTO Elevations (ID, Name, Description, Amount) VALUES (1, '1', 'raam', 1)").run();
      database.prepare("INSERT INTO ReportOfferTexts (ElevationID, Description) VALUES (99, 'ergens.rtf')").run();
    });
    const zip = packZip([{ path: "export.sqlite3", bytes: db }]);
    expect(() => parseLogikalExport(zip)).toThrow(expect.objectContaining({ code: "logikalJoinUnknown" }));
  });
});

describe("logikal project match", () => {
  const base = { dossierNumber: "OFF-2026-0001", dossierName: "Ramen living", exportProjectKey: "10" };

  it("blocks a reliable reference that is a different project", () => {
    expect(matchLogikalExport({
      ...base,
      linkedProjectId: "LOG-1",
      exportName: "Andere werken",
      exportOrderNo: "OTHER",
    })).toBe("mismatch");
  });

  it("matches the stored Logikal reference", () => {
    expect(matchLogikalExport({
      ...base,
      linkedProjectId: "LOG-1",
      exportName: "Ramen living",
      exportOrderNo: "LOG-1",
    })).toBe("match");
  });

  it("asks when the export has no reliable reference", () => {
    expect(matchLogikalExport({
      linkedProjectId: "LOG-1",
      dossierNumber: "OFF-2026-0001",
      dossierName: "Ramen living",
      exportName: "Iets",
      exportOrderNo: null,
      exportProjectKey: null,
    })).toBe("uncertain");
  });
});

function memory(row: LinkSnapshot): CreateDeps & { row: LinkSnapshot; calls: number } {
  const counter = { calls: 0 };
  const deps = {
    row,
    read: async () => ({ ...row }),
    tryLock: async (token: string) => {
      if (row.projectId || row.token || row.linkState === "NEEDS_CHECK") return false;
      row.token = token;
      row.startedAt = new Date();
      return true;
    },
    saveLink: async (token: string, projectId: string, projectName: string | null) => {
      if (row.token !== token || row.projectId) return false;
      row.projectId = projectId;
      row.projectName = projectName;
      row.linkState = "LINKED";
      row.token = null;
      row.startedAt = null;
      return true;
    },
    markNeedsCheck: async (token: string) => {
      if (row.projectId || row.token !== token) return;
      row.linkState = "NEEDS_CHECK";
      row.token = null;
      row.startedAt = null;
    },
    release: async (token: string) => {
      if (row.token !== token) return;
      row.token = null;
      row.startedAt = null;
    },
    newToken: () => "token-1",
    gateway: async () => {
      counter.calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { outcome: "created" as const, projectId: "LOG-1", projectName: "Ramen living" };
    },
    get calls() {
      return counter.calls;
    },
  };
  return deps;
}

describe("logikal create lock", () => {
  const empty: LinkSnapshot = {
    projectId: null,
    projectName: null,
    linkState: null,
    token: null,
    startedAt: null,
    dossierNumber: "OFF-2026-0001",
    dossierName: "Ramen living",
  };

  it("returns the existing link and does not create twice", async () => {
    const deps = memory({ ...empty });
    const [first, second] = await Promise.all([
      runLockedCreate(deps, { pollMs: 10, attempts: 20 }),
      runLockedCreate(deps, { pollMs: 10, attempts: 20 }),
    ]);
    expect(deps.calls).toBe(1);
    expect(first).toMatchObject({ status: "linked", projectId: "LOG-1" });
    expect(second).toMatchObject({ status: "linked", projectId: "LOG-1", already: true });
    const again = await runLockedCreate(deps);
    expect(deps.calls).toBe(1);
    expect(again).toMatchObject({ already: true });
  });

  it("does not create again when the outcome is unknown", async () => {
    const deps = memory({ ...empty });
    let calls = 0;
    deps.gateway = async () => {
      calls += 1;
      return { outcome: "unknown" };
    };
    expect(await runLockedCreate(deps)).toMatchObject({ status: "needs_check" });
    expect(await runLockedCreate(deps)).toMatchObject({ status: "needs_check" });
    expect(calls).toBe(1);
  });

  it("does not call the network while this installation has no swagger", async () => {
    await expect(logikalGateway({ dossierNumber: "OFF-2026-0001", dossierName: "Ramen" })).resolves.toEqual({
      outcome: "not_configured",
    });
  });
});

describe("logikal import replace", () => {
  it("keeps the previous list when the new import fails and does not duplicate a repeat", async () => {
    const parsed = parseLogikalExport(quoteZip());
    let stored = [{ drawingKey: "logikal/old/a.png" }];
    const removed: string[] = [];
    const deps = {
      listExisting: async () => stored.map((row) => ({ ...row })),
      put: async (key: string) => {
        if (key.includes("fail")) throw new Error("disk");
      },
      remove: async (key: string) => {
        removed.push(key);
      },
      replace: async (rows: { elevationKey: string; drawingKey: string | null }[]) => {
        stored = rows.map((row) => ({ drawingKey: row.drawingKey }));
      },
    };
    const first = await importLogikalPositions(deps, "dossier-1", parsed.positions);
    expect(first).toHaveLength(2);
    expect(new Set(first.map((row) => row.elevationKey)).size).toBe(2);
    expect(stored).toHaveLength(2);
    const before = stored.map((row) => row.drawingKey);
    const failing = parsed.positions.map((position) => ({
      ...position,
      drawing: position.drawing ? { ...position.drawing, fileName: "fail.png" } : null,
    }));
    await expect(importLogikalPositions(deps, "dossier-1", failing)).rejects.toThrow("disk");
    expect(stored.map((row) => row.drawingKey)).toEqual(before);
    const second = await importLogikalPositions(deps, "dossier-1", parsed.positions);
    expect(second).toHaveLength(2);
    expect(stored).toHaveLength(2);
    expect(removed.some((key) => before.includes(key))).toBe(true);
  });
});

describe("rtf", () => {
  it("keeps the readable quote text", () => {
    expect(rtfToText("{\\rtf1\\ansi Hallo\\par wereld}")).toBe("Hallo\nwereld");
  });
});
