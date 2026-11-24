import {
  VAT_CHOICE_LABELS,
  VAT_CHOICES,
  customerProjectLabel,
  isVatChoice,
  matchSellerUser,
  sellerNameForUser,
  sellerOnCreate,
  sellerOnEdit,
  parseVatChoice,
  visibleVatChoice,
  siteAddressFromBilling,
  suggestionFromPhoton,
} from "../aanvraag-fields";

describe("aanvraag fields", () => {
  it("offers exactly the three customer VAT choices", () => {
    expect(VAT_CHOICES.map((choice) => VAT_CHOICE_LABELS[choice])).toEqual([
      "Excl 21%",
      "Excl 6%",
      "Medecontractant",
    ]);
    expect(isVatChoice("MEDECONTRACTANT")).toBe(true);
    expect(parseVatChoice("EXCL_6")).toBe("EXCL_6");
    expect(parseVatChoice("")).toBeNull();
    expect(parseVatChoice(undefined)).toBeUndefined();
    expect(parseVatChoice("12")).toBeNull();
  });

  it("counts the VAT choice the dropdown already shows", () => {
    expect(visibleVatChoice("")).toBe("EXCL_21");
    expect(visibleVatChoice(undefined)).toBe("EXCL_21");
    expect(visibleVatChoice(null)).toBe("EXCL_21");
    expect(visibleVatChoice("EXCL_6")).toBe("EXCL_6");
    expect(visibleVatChoice("MEDECONTRACTANT")).toBe("MEDECONTRACTANT");
    expect(visibleVatChoice("12")).toBe("");
  });

  it("prefills a project description as last name then first name", () => {
    expect(customerProjectLabel({ name: "Jan Peeters", firstName: "Jan", lastName: "Peeters" })).toBe("Peeters Jan");
    expect(customerProjectLabel({ name: "Thielemans NV" })).toBe("Thielemans NV");
  });

  it("maps a seller when the user name has the same words", () => {
    const users = [
      { id: "1", name: "Evi Saerens" },
      { id: "2", name: "Admin" },
    ];
    expect(matchSellerUser(users, "Saerens Evi")?.id).toBe("1");
    expect(matchSellerUser(users, "De Meersman Stijn")).toBeNull();
  });

  it("locks a seller to their own name and leaves admin free to choose", () => {
    expect(sellerNameForUser({ name: "Robbe Haegeman", role: "user" })).toBe("Haegeman Robbe");
    expect(sellerNameForUser({ name: "Annaert Uwee", role: "user" })).toBe("Annaert Uwee");
    expect(sellerNameForUser({ name: "Van Doorslaer Kristof", role: "user" })).toBe("Van Doorslaer Kristof");
    expect(sellerNameForUser({ name: "Admin", role: "admin" })).toBeNull();
    expect(sellerNameForUser({ name: "Haegeman Robbe", role: "admin" })).toBeNull();
    expect(sellerOnCreate({ name: "Haegeman Robbe", role: "user" }, "Saerens Evi")).toBe("Haegeman Robbe");
    expect(sellerOnCreate({ name: "Admin", role: "admin" }, "Saerens Evi")).toBe("Saerens Evi");
    expect(sellerOnEdit({ name: "Haegeman Robbe", role: "user" }, "Haegeman Robbe", "Saerens Evi")).toBe("Haegeman Robbe");
    expect(sellerOnEdit({ name: "Admin", role: "admin" }, "Haegeman Robbe", "Saerens Evi")).toBe("Saerens Evi");
  });

  it("copies a customer billing address into the site address", () => {
    expect(
      siteAddressFromBilling({
        street: "Kerkstraat",
        houseNumber: "12",
        postalCode: "9000",
        city: "Gent",
        country: "be",
      }),
    ).toEqual({
      query: "Kerkstraat 12, 9000 Gent",
      label: "Kerkstraat 12, 9000 Gent",
      street: "Kerkstraat 12",
      postalCode: "9000",
      city: "Gent",
      country: "BE",
    });
    expect(
      siteAddressFromBilling({
        street: "Kerkstraat 12",
        postalCode: "9000",
        city: "Gent",
        country: "BE",
      }).street,
    ).toBe("Kerkstraat 12");
  });

  it("turns a Photon result into a structured address", () => {
    expect(
      suggestionFromPhoton({
        street: "Kerkstraat",
        housenumber: "12",
        postcode: "9050",
        city: "Gent",
        countrycode: "be",
      }),
    ).toEqual({
      label: "Kerkstraat 12, 9050 Gent",
      street: "Kerkstraat 12",
      postalCode: "9050",
      city: "Gent",
      country: "BE",
    });
  });
});
