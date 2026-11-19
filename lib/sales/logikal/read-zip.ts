import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";
import { SalesError } from "../errors";

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;
const MAX_ENTRIES = 2000;
const MAX_FILE = 32 * 1024 * 1024;
const MAX_TOTAL = 80 * 1024 * 1024;

export type ZipEntry = { path: string; bytes: Buffer };

/** Reject absolute paths, drive letters, and any `..` segment. */
export function safeZipPath(name: string): string | null {
  const slash = name.replace(/\\/g, "/");
  if (slash.startsWith("/") || /^[a-zA-Z]:/.test(slash)) return null;
  const parts = slash.split("/");
  if (parts.some((part) => part === "..")) return null;
  const kept = parts.filter((part) => part.length > 0 && part !== ".");
  if (kept.length === 0) return null;
  return kept.join("/");
}

function decodeName(bytes: Buffer, flags: number): string {
  if (flags & 0x800) return bytes.toString("utf8");
  return bytes.toString("latin1");
}

export function readZip(buffer: Buffer): ZipEntry[] {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== SIG_LOCAL) {
    throw new SalesError("logikalExportInvalid");
  }
  const eocd = findEocd(buffer);
  const entries = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (entries > MAX_ENTRIES || centralOffset > buffer.length || centralOffset + centralSize > buffer.length) {
    throw new SalesError("logikalExportInvalid");
  }

  const out: ZipEntry[] = [];
  let total = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== SIG_CENTRAL) {
      throw new SalesError("logikalExportInvalid");
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    if (flags & 1) throw new SalesError("logikalExportInvalid");
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new SalesError("logikalExportInvalid");
    }
    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLength);
    const rawName = decodeName(nameBytes, flags);
    const isDirectory = rawName.endsWith("/") || rawName.endsWith("\\");
    const path = safeZipPath(rawName);
    if (!isDirectory && !path) throw new SalesError("logikalZipUnsafe");
    if (path && !isDirectory && !path.startsWith("__MACOSX/") && path !== ".DS_Store" && !path.endsWith("/.DS_Store")) {
      if (uncompressedSize > MAX_FILE) throw new SalesError("logikalExportInvalid");
      total += uncompressedSize;
      if (total > MAX_TOTAL) throw new SalesError("logikalExportInvalid");
      out.push({ path, bytes: readLocal(buffer, localOffset, method, compressedSize, uncompressedSize) });
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return out;
}

function readLocal(buffer: Buffer, offset: number, method: number, compressedSize: number, uncompressedSize: number): Buffer {
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== SIG_LOCAL) {
    throw new SalesError("logikalExportInvalid");
  }
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const end = start + compressedSize;
  if (end > buffer.length) throw new SalesError("logikalExportInvalid");
  const compressed = buffer.subarray(start, end);
  const bytes = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : null;
  if (!bytes || bytes.length !== uncompressedSize) throw new SalesError("logikalExportInvalid");
  return bytes;
}

function findEocd(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) return i;
  }
  throw new SalesError("logikalExportInvalid");
}

export function packZip(files: { path: string; bytes: Buffer }[], method: "store" | "deflate" = "store"): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const stored = method === "deflate" ? deflateRawSync(file.bytes) : file.bytes;
    const methodCode = method === "deflate" ? 8 : 0;
    const crc = crc32(file.bytes) >>> 0;
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(SIG_LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(methodCode, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(file.bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, stored);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(SIG_CENTRAL, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(methodCode, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(file.bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + stored.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(SIG_EOCD, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, eocd]);
}
