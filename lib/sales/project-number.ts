/**
 * Projectnummer van 10 cijfers: 1 + volgnummer van 7 cijfers + jaar van 2 cijfers.
 * Het eerste project van 2026 is 1000000126, het volgende 1000000226.
 */
export function formatProjectNumber(sequence: number, year: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9_999_999) {
    throw new Error("project sequence out of range");
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2099) {
    throw new Error("project year out of range");
  }
  const middle = String(sequence).padStart(7, "0");
  const yy = String(year % 100).padStart(2, "0");
  return `1${middle}${yy}`;
}

export function projectCreationAllowed(status: string | null | undefined): boolean {
  return status === "GEWONNEN";
}
