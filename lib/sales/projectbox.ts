/**
 * Projectbox holds a dossier only when sales checked Actie projectleiding
 * and the dossier already has a 10-digit project number.
 * The project leader stored on the project is one of these display names.
 * Sign-in accounts are created beside the verkoper accounts, not in this file.
 */

export const PROJECT_LEADERS = [
  "Van Holder Jens",
  "Van Aerschot Johan",
  "De Boeck Jelle",
  "Van Loo Anne",
  "Migeotte Aaron",
] as const;

export type ProjectLeaderName = (typeof PROJECT_LEADERS)[number];

function personNameKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

/**
 * The project leader this login is. Admin keeps the full desk.
 * A partner is not a project leader. Word order does not matter.
 * The stored name on a project stays the display name from PROJECT_LEADERS.
 */
export function projectLeaderNameForUser(user: {
  name?: string | null;
  role?: string | null;
}): ProjectLeaderName | null {
  if (user.role === "admin" || user.role === "partner") return null;
  if (!user.name?.trim()) return null;
  const key = personNameKey(user.name);
  return PROJECT_LEADERS.find((leader) => personNameKey(leader) === key) ?? null;
}

/** After sign-in, a project leader opens Projectleiding. A verkoper and admin stay on the sales desk. */
export function homeHrefForUser(user: { name?: string | null; role?: string | null }): "/" | "/projectleiding/dashboard" {
  return projectLeaderNameForUser(user) ? "/projectleiding/dashboard" : "/";
}

const TEN_DIGITS = /^\d{10}$/;

export function isTenDigitProjectNumber(value: string | null | undefined): value is string {
  return typeof value === "string" && TEN_DIGITS.test(value);
}

/** Checked without a project number stays out. A project number without the check stays out. */
export function dossierInProjectbox(
  action: boolean | null | undefined,
  projectNumber: string | null | undefined,
): boolean {
  return action === true && isTenDigitProjectNumber(projectNumber);
}

export function parseProjectLeader(value: string | null | undefined): ProjectLeaderName | null {
  const name = (value ?? "").trim();
  if (!name) return null;
  if (!(PROJECT_LEADERS as readonly string[]).includes(name)) {
    throw new Error("projectLeaderInvalid");
  }
  return name as ProjectLeaderName;
}

export type ProjectboxRow = {
  id: string;
  projectNumber: string;
  dossierNumber: string | null;
  name: string | null;
  customer: string | null;
  seller: string | null;
  projectLeader: ProjectLeaderName | null;
};

export type ProjectboxAssignment = {
  projectLeader: string | null;
};

export type ProjectboxSummary = {
  count: number;
  leaders: { name: ProjectLeaderName; count: number }[];
  unassigned: number;
};

/** Counts only the rows already in the box. A stored name outside the list counts as unassigned. */
export function summarizeProjectbox(rows: readonly ProjectboxAssignment[]): ProjectboxSummary {
  const counts = new Map<ProjectLeaderName, number>(PROJECT_LEADERS.map((name) => [name, 0]));
  let unassigned = 0;
  for (const row of rows) {
    const name = (PROJECT_LEADERS as readonly string[]).includes(row.projectLeader ?? "")
      ? (row.projectLeader as ProjectLeaderName)
      : null;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    else unassigned += 1;
  }
  return {
    count: rows.length,
    leaders: PROJECT_LEADERS.map((name) => ({ name, count: counts.get(name) ?? 0 })),
    unassigned,
  };
}
