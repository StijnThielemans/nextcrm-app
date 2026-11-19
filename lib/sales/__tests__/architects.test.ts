import { parseArchitectSuggestions } from "../architects";

describe("architect directory", () => {
  it("keeps a real suggestion with name, city and stamnummer", () => {
    const hits = parseArchitectSuggestions({
      members: {
        hits: [
          {
            id: 226,
            name: "Alfons Peeters",
            stamnummer: "A200446",
            postal_code: "2990",
            city: "Wuustwezel",
            type: "NP",
          },
          { name: "Zonder nummer", stamnummer: "geen", city: "Gent" },
        ],
      },
    });
    expect(hits).toEqual([
      {
        id: "A200446",
        name: "Alfons Peeters",
        city: "Wuustwezel",
        postalCode: "2990",
        kind: "NP",
      },
    ]);
  });

  it("returns nothing when the payload has no members", () => {
    expect(parseArchitectSuggestions(null)).toEqual([]);
    expect(parseArchitectSuggestions({ locations: [] })).toEqual([]);
  });
});
