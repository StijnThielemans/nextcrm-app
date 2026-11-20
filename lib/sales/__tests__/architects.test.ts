import { parseArchitectSearchHtml, parseArchitectSuggestions } from "../architects";

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

  it("keeps every suggestion instead of stopping at three", () => {
    const hits = Array.from({ length: 25 }, (_, index) => ({
      name: `Architect ${index}`,
      stamnummer: `A${String(200000 + index)}`,
      city: "Asse",
      postal_code: "1730",
    }));
    expect(parseArchitectSuggestions({ members: { hits } })).toHaveLength(25);
  });
});

describe("architect search page", () => {
  const html = `
    <a data-member-stamnummer="B911243" data-member-type="Rechtspersoon"><h2>Asset Architecten</h2><p></p></a>
    <a data-member-stamnummer="B400129" data-member-type="Rechtspersoon"><h2>Atelier Architectenvennootschap</h2><p>Asse</p></a>
    <a data-member-stamnummer="A203616" data-member-type="Natuurlijke persoon"><h2>Bram Van den Brande</h2><p>Asse</p></a>
    <a data-member-stamnummer="A000162" data-member-type="Natuurlijke persoon"><h2>Jan De Graeve</h2><p>Assebroek</p></a>
    <a href="/jan-de-graeve/A000162"><span class="font-medium text-gray-900">Jan De Graeve</span><span class="text-gray-500">Assebroek</span></a>
    <a href="/extra/B000001"><span class="font-medium text-gray-900">Extra Naam</span><span class="text-gray-500">Assenede</span></a>
  `;

  it("keeps every card on the page, including the extra basic rows", () => {
    const hits = parseArchitectSearchHtml(html);
    expect(hits.map((hit) => hit.id)).toEqual(["B911243", "B400129", "A203616", "A000162", "B000001"]);
    expect(hits[1]).toMatchObject({ name: "Atelier Architectenvennootschap", city: "Asse" });
    expect(hits[4]).toMatchObject({ name: "Extra Naam", city: "Assenede" });
  });
});
