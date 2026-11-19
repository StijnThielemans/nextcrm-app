import { accountMatchesSearch, type AccountSearchRow } from "../account-search";

const jan: AccountSearchRow = {
  name: "Jan Peeters",
  account_role: "CUSTOMER",
  office_phone: "0470123456",
  mobile_phone: null,
  email: "jan.peeters@example.com",
  vat: "BE0123456789",
  billing_street: "Kerkstraat 12",
  billing_postal_code: "9000",
  billing_city: "Gent",
};

describe("account list search", () => {
  it("matches a fragment of any customer field", () => {
    expect(accountMatchesSearch(jan, "Peeters")).toBe(true);
    expect(accountMatchesSearch(jan, "klant")).toBe(true);
    expect(accountMatchesSearch(jan, "0470123456")).toBe(true);
    expect(accountMatchesSearch(jan, "123456")).toBe(true);
    expect(accountMatchesSearch(jan, "jan.peeters@example.com")).toBe(true);
    expect(accountMatchesSearch(jan, "BE0123")).toBe(true);
    expect(accountMatchesSearch(jan, "Kerkstraat")).toBe(true);
    expect(accountMatchesSearch(jan, "9000")).toBe(true);
    expect(accountMatchesSearch(jan, "gent")).toBe(true);
    expect(accountMatchesSearch(jan, "0470 123 456")).toBe(true);
    expect(accountMatchesSearch(jan, "BE 0123.456.789")).toBe(true);
    expect(accountMatchesSearch(jan, "Kerkstraat 12, 9000")).toBe(true);
    expect(accountMatchesSearch({ ...jan, vat_choice: "MEDECONTRACTANT" }, "Medecontractant")).toBe(true);
    expect(accountMatchesSearch({ ...jan, vat_choice: "EXCL_6" }, "Excl 6%")).toBe(true);
    expect(accountMatchesSearch({ ...jan, vat_choice: "EXCL_21" }, "Standard 21%")).toBe(false);
  });

  it("matches the Dutch label for every contact type", () => {
    expect(accountMatchesSearch({ ...jan, account_role: "SUPPLIER" }, "Leverancier")).toBe(true);
    expect(accountMatchesSearch({ ...jan, account_role: "BOTH" }, "Klant en leverancier")).toBe(true);
    expect(accountMatchesSearch({ ...jan, name: "Andere", account_role: "SUPPLIER" }, "Klant")).toBe(false);
  });

  it("matches the mobile number when the office phone is empty", () => {
    const row = { ...jan, office_phone: null, mobile_phone: "0488111222" };
    expect(accountMatchesSearch(row, "0488111222")).toBe(true);
    expect(accountMatchesSearch(row, "0470123456")).toBe(false);
  });

  it("keeps every row when the box is empty", () => {
    expect(accountMatchesSearch(jan, "")).toBe(true);
    expect(accountMatchesSearch(jan, "   ")).toBe(true);
  });

  it("hides a row that matches none of the fields", () => {
    expect(accountMatchesSearch(jan, "Antwerpen")).toBe(false);
    expect(accountMatchesSearch(jan, "...")).toBe(false);
  });
});
