import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readPlanLayer } from "@/lib/raamstudio2/plan-text";
import type { VisionBox } from "@/lib/raamstudio2/proposals";

export type VisionResult = {
  engines: string[];
  textSource: string | null;
  figures: string[];
  labels: string[];
  openings: VisionBox[];
  error?: string;
};

const PYTHON = path.join(process.cwd(), "services/raamstudio-vision/.venv/bin/python");
const SCRIPT = path.join(process.cwd(), "services/raamstudio-vision/analyze.py");

/** pdfplumber, pypdfium2, OpenCV and Tesseract. pdf.js is the fallback. */
export async function analyzePlanPage(bytes: Buffer, page: number): Promise<VisionResult> {
  const vision = await runPython(bytes, page);
  if (vision && !vision.error) return vision;
  const layer = await readPlanLayer(bytes, page);
  return {
    engines: ["pdfjs"],
    textSource: "pdfjs",
    figures: layer.figures,
    labels: layer.labels,
    openings: [],
    error: vision?.error ?? "pdfplumber, OpenCV en Tesseract zijn op deze server nog niet geïnstalleerd.",
  };
}

function runPython(bytes: Buffer, page: number): Promise<VisionResult | null> {
  if (!fs.existsSync(PYTHON) || !fs.existsSync(SCRIPT)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const child = spawn(PYTHON, [SCRIPT, String(page)], { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ engines: [], textSource: null, figures: [], labels: [], openings: [], error: "De plananalyse duurde te lang." });
    }, 60_000);
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const detail = Buffer.concat(err).toString("utf8").trim().slice(0, 180);
        resolve({ engines: [], textSource: null, figures: [], labels: [], openings: [], error: detail || "De plananalyse is gestopt." });
        return;
      }
      try {
        resolve(asResult(JSON.parse(Buffer.concat(out).toString("utf8"))));
      } catch {
        resolve({ engines: [], textSource: null, figures: [], labels: [], openings: [], error: "De plananalyse gaf geen leesbaar resultaat." });
      }
    });
    child.stdin.end(bytes);
  });
}

function asResult(value: unknown): VisionResult {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const openings = Array.isArray(row.openings) ? row.openings.map(asBox).filter((item): item is VisionBox => item != null) : [];
  return {
    engines: Array.isArray(row.engines) ? row.engines.filter((item): item is string => typeof item === "string") : [],
    textSource: typeof row.textSource === "string" ? row.textSource : null,
    figures: strings(row.figures),
    labels: strings(row.labels),
    openings,
    error: typeof row.error === "string" ? row.error : undefined,
  };
}

function asBox(value: unknown): VisionBox | null {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const x = number(row.x);
  const y = number(row.y);
  const w = number(row.w);
  const h = number(row.h);
  if (x == null || y == null || w == null || h == null || w <= 0 || h <= 0) return null;
  if (x < 0 || y < 0 || x > 1 || y > 1 || x + w > 1.002 || y + h > 1.002) return null;
  return {
    x,
    y,
    w: Math.min(w, 1 - x),
    h: Math.min(h, 1 - y),
    source: typeof row.source === "string" ? row.source : "pdfplumber",
    nearby: strings(row.nearby).slice(0, 4),
    status: "te controleren",
  };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
