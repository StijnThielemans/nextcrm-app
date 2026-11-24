/**
 * Convert Prisma Decimal (and BigInt) values to plain numbers so the result
 * can cross the React Server Component boundary. Nested objects and arrays
 * are walked, so a related opportunity's budget, expected_revenue, and
 * snapshot_rate are converted along with any other Decimal on the payload.
 */
function isDecimal(val: object): val is { toNumber: () => number } {
  return (
    "toNumber" in val &&
    typeof (val as { toNumber?: unknown }).toNumber === "function"
  );
}

function serializeValue(val: unknown, seen: WeakSet<object>): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === "bigint") {
    return val <= BigInt(Number.MAX_SAFE_INTEGER) &&
      val >= BigInt(Number.MIN_SAFE_INTEGER)
      ? Number(val)
      : val.toString();
  }
  if (typeof val !== "object") return val;
  if (val instanceof Date) return val;
  if (isDecimal(val)) return val.toNumber();
  if (seen.has(val)) return undefined;
  seen.add(val);
  if (Array.isArray(val)) {
    return val.map((item) => serializeValue(item, seen));
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(val)) {
    result[key] = serializeValue(
      (val as Record<string, unknown>)[key],
      seen
    );
  }
  return result;
}

export function serializeDecimals<T>(obj: T): T {
  return serializeValue(obj, new WeakSet()) as T;
}

export function serializeDecimalsList<T>(list: T[]): T[] {
  return list.map((item) => serializeDecimals(item));
}
