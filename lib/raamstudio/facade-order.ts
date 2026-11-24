/** Gevels tegen de klok in, vanaf de straat (voorgevel); per verdieping opnieuw bij 1. */
export const FACADE_ORDER = ["voorgevel", "rechtergevel", "achtergevel", "linkergevel"] as const;

export type FacadeSide = (typeof FACADE_ORDER)[number];

/** Opening numbers are strings: "0.1" and "0.10" stay distinct. */
export function normalizeOpeningNumber(value: string): string {
  return value.trim();
}