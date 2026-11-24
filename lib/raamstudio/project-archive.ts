import { crc32, deflateRawSync } from "node:zlib";

import {
  buildRaamstudioPayload,
  type DossierPrefill,
  type WorkspaceDraft,
  type WorkspaceStepId,
} from "./workspace-model";

/** A .tc-raam zip with one stored entry: project.json. Method 8, same as a desktop save. */
export function zipProjectJson(payload: unknown): Buffer {
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const data = deflateRawSync(raw);
  const name = Buffer.from("project.json");
  const method = 8;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(crc32(raw), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(crc32(raw), 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(name.length, 28);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + name.length, 12);
  eocd.writeUInt32LE(local.length + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, eocd]);
}

export function raamstudioArchive(
  prefill: DossierPrefill,
  draft: WorkspaceDraft,
  planNames: readonly string[],
  step?: WorkspaceStepId,
): Buffer {
  return zipProjectJson(buildRaamstudioPayload(prefill, draft, planNames, step));
}
