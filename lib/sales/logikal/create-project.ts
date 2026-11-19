import type { LogikalCreateInput, LogikalGatewayResult } from "./gateway";

export type LinkSnapshot = {
  projectId: string | null;
  projectName: string | null;
  linkState: string | null;
  token: string | null;
  startedAt: Date | null;
  dossierNumber: string | null;
  dossierName: string | null;
};

export type CreateOutcome =
  | { status: "linked"; projectId: string; projectName: string | null; already: boolean }
  | { status: "needs_check" }
  | { status: "in_progress" }
  | { status: "not_configured" }
  | { status: "failed" };

const STALE_MS = 2 * 60 * 1000;

export type CreateDeps = {
  read: () => Promise<LinkSnapshot>;
  tryLock: (token: string, now: Date) => Promise<boolean>;
  saveLink: (token: string, projectId: string, projectName: string | null) => Promise<boolean>;
  markNeedsCheck: (token: string) => Promise<void>;
  release: (token: string) => Promise<void>;
  newToken: () => string;
  gateway: (input: LogikalCreateInput) => Promise<LogikalGatewayResult>;
};

/**
 * One create at a time. A second caller receives the stored id and does not
 * call Logikal again. There is no documented search in this installation, so
 * an unknown outcome is marked NEEDS_CHECK and is never followed by another create.
 */
export async function runLockedCreate(
  deps: CreateDeps,
  opts?: { now?: Date; pollMs?: number; attempts?: number },
): Promise<CreateOutcome> {
  const attempts = opts?.attempts ?? 20;
  const pollMs = opts?.pollMs ?? 50;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const outcome = await once(deps, opts?.now ?? new Date());
    if (outcome.status !== "in_progress" || attempt === attempts - 1) return outcome;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return { status: "in_progress" };
}

async function once(deps: CreateDeps, now: Date): Promise<CreateOutcome> {
  const row = await deps.read();
  if (row.projectId) {
    return { status: "linked", projectId: row.projectId, projectName: row.projectName, already: true };
  }
  if (row.linkState === "NEEDS_CHECK") return { status: "needs_check" };
  if (row.token) {
    const age = row.startedAt ? now.getTime() - row.startedAt.getTime() : STALE_MS + 1;
    if (age > STALE_MS) {
      await deps.markNeedsCheck(row.token);
      return { status: "needs_check" };
    }
    return { status: "in_progress" };
  }

  const token = deps.newToken();
  const locked = await deps.tryLock(token, now);
  if (!locked) return { status: "in_progress" };

  try {
    const result = await deps.gateway({ dossierNumber: row.dossierNumber, dossierName: row.dossierName });
    if (result.outcome === "created" || result.outcome === "found") {
      const saved = await deps.saveLink(token, result.projectId, result.projectName);
      if (!saved) {
        const again = await deps.read();
        if (again.projectId) {
          return { status: "linked", projectId: again.projectId, projectName: again.projectName, already: true };
        }
        await deps.markNeedsCheck(token);
        return { status: "needs_check" };
      }
      return {
        status: "linked",
        projectId: result.projectId,
        projectName: result.projectName,
        already: result.outcome === "found",
      };
    }
    if (result.outcome === "unknown") {
      await deps.markNeedsCheck(token);
      return { status: "needs_check" };
    }
    await deps.release(token);
    return result.outcome === "not_configured" ? { status: "not_configured" } : { status: "failed" };
  } catch {
    await deps.markNeedsCheck(token);
    return { status: "needs_check" };
  }
}
