import {
  customerProjectLabel,
  matchSellerUser,
  suggestionFromPhoton,
} from "../aanvraag-fields";

describe("aanvraag fields", () => {
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
