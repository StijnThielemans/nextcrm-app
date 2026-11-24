import { SalesError } from "../errors";
import { parseWorkDays } from "../work-days";

describe("planning work days", () => {
  it("keeps an empty value empty", () => {
    expect(parseWorkDays("")).toBeNull();
    expect(parseWorkDays("   ")).toBeNull();
    expect(parseWorkDays(null)).toBeNull();
    expect(parseWorkDays(undefined)).toBeNull();
  });

  it("accepts zero and positive whole numbers", () => {
    expect(parseWorkDays(0)).toBe(0);
    expect(parseWorkDays("0")).toBe(0);
    expect(parseWorkDays("12")).toBe(12);
    expect(parseWorkDays(" 7 ")).toBe(7);
  });

  it("rejects fractions, negatives and text", () => {
    for (const value of ["1.5", "1,5", "-1", -1, "abc", "1e2", 1.5, true, "2147483648"]) {
      expect(() => parseWorkDays(value)).toThrow(SalesError);
    }
  });
});
