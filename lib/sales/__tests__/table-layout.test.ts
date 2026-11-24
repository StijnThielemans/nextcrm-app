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

  it("puts Offertedossiernummer and Projectnummer first when a saved order is missing them", () => {
    const dossiers = sanitizeLayout("dossiers", {
      order: ["name", "number", "customer", "seller"],
      hidden: ["seller", "executionProjectNumber"],
    });
    expect(dossiers?.order.slice(0, 2)).toEqual(["number", "executionProjectNumber"]);
    expect(dossiers?.order.slice(2, 5)).toEqual(["name", "customer", "seller"]);
    expect(dossiers?.hidden).toEqual(["seller"]);

    const quotes = sanitizeLayout("quotes", {
      order: ["customer", "name", "gross"],
      hidden: ["won", "dossier"],
    });
    expect(quotes?.order.slice(0, 2)).toEqual(["dossier", "executionProjectNumber"]);
    expect(quotes?.order.slice(2, 5)).toEqual(["customer", "name", "gross"]);
    expect(quotes?.hidden).toEqual(["won"]);
  });

  it("moves both numbers to the front when a saved order parked the project number later", () => {
    const dossiers = sanitizeLayout("dossiers", {
      order: ["name", "number", "executionProjectNumber", "customer"],
      hidden: ["seller"],
    });
    expect(dossiers?.order.slice(0, 4)).toEqual(["number", "executionProjectNumber", "name", "customer"]);
    expect(dossiers?.hidden).toEqual(["seller"]);
  });

  it("keeps the quote name visible and drops an unknown quote column", () => {
    const layout = sanitizeLayout("quotes", { order: ["customer", "name", "missing"], hidden: ["name", "seller"] });
    expect(layout?.order.slice(0, 2)).toEqual(["dossier", "executionProjectNumber"]);
    expect(layout?.order).toContain("name");
    expect(layout?.order).not.toContain("missing");
    expect(layout?.hidden).toEqual(["seller"]);
  });
});
