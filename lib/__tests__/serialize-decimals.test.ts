import { serializeDecimals } from "../serialize-decimals";

function decimal(value: number) {
  return { toNumber: () => value, d: [value], e: 0, s: 1 };
}

describe("serializeDecimals", () => {
  it("converts every nested Decimal, not only the first", () => {
    const account = {
      id: "acc",
      name: "Jan",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      opportunities: [
        {
          budget: decimal(10),
          expected_revenue: decimal(20),
          snapshot_rate: decimal(1.25),
        },
      ],
    };

    const plain = serializeDecimals(account);

    expect(plain.opportunities[0].budget).toBe(10);
    expect(plain.opportunities[0].expected_revenue).toBe(20);
    expect(plain.opportunities[0].snapshot_rate).toBe(1.25);
    expect(plain.createdAt).toBe(account.createdAt);
    expect(JSON.parse(JSON.stringify(plain.opportunities[0]))).toEqual({
      budget: 10,
      expected_revenue: 20,
      snapshot_rate: 1.25,
    });
  });

  it("converts BigInt fields on the same payload", () => {
    const task = serializeDecimals({ likes: BigInt(3), title: "Call" });
    expect(task.likes).toBe(3);
  });
});
