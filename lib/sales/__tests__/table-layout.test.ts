import { sanitizeLayout } from "../table-layout";

describe("table column layout", () => {
  it("keeps a user's order and puts new columns at the end", () => {
    const layout = sanitizeLayout("customers", {
      order: ["email", "name", "not-a-column", "email"],
      hidden: ["vat", "name", "actions"],
    });
    expect(layout?.order.slice(0, 2)).toEqual(["email", "name"]);
    expect(layout?.order).toContain("office_phone");
    expect(layout?.order.filter((id) => id === "email")).toHaveLength(1);
    expect(layout?.hidden).toEqual(["vat"]);
  });

  it("rejects a layout without an order", () => {
    expect(sanitizeLayout("dossiers", { hidden: ["seller"] })).toBeNull();
  });

  it("keeps the quote name visible and drops an unknown quote column", () => {
    const layout = sanitizeLayout("quotes", { order: ["customer", "name", "missing"], hidden: ["name", "seller"] });
    expect(layout?.order.slice(0, 2)).toEqual(["customer", "name"]);
    expect(layout?.hidden).toEqual(["seller"]);
  });
});
