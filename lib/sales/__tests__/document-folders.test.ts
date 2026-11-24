import { groupDocumentsIntoFolders } from "../document-folders";

describe("dossier document folders", () => {
  it("hides empty categories and keeps a single file inside its folder", () => {
    expect(groupDocumentsIntoFolders([])).toEqual([]);
    expect(
      groupDocumentsIntoFolders([{ id: "1", name: "gevel.pdf", category: "PLANNEN" }]),
    ).toEqual([{ key: "Plannen", label: "Plannen", files: [{ id: "1", name: "gevel.pdf", category: "PLANNEN" }] }]);
  });

  it("puts files that share a category in one folder and keeps another category separate", () => {
    const folders = groupDocumentsIntoFolders([
      { id: "a", name: "order.pdf", category: "BESTELLINGEN" },
      { id: "b", name: "gevel.pdf", category: "PLANNEN" },
      { id: "c", name: "grondplan.pdf", category: "PLANNEN" },
      { id: "d", name: "kost.xlsx", category: "CALCULATIE" },
    ]);

    expect(folders.map((folder) => folder.label)).toEqual(["Bestellingen", "Calculatie", "Plannen"]);
    expect(folders.find((folder) => folder.label === "Plannen")?.files.map((file) => file.name)).toEqual([
      "gevel.pdf",
      "grondplan.pdf",
    ]);
    expect(folders.find((folder) => folder.label === "Bestellingen")?.files).toHaveLength(1);
  });

  it("folds a legacy plan type into the Plannen folder", () => {
    const folders = groupDocumentsIntoFolders([
      { id: "1", name: "nieuw.pdf", category: "PLANNEN" },
      { id: "2", name: "oud.pdf", category: "PLAN" },
    ]);
    expect(folders).toHaveLength(1);
    expect(folders[0]?.label).toBe("Plannen");
    expect(folders[0]?.files.map((file) => file.id)).toEqual(["1", "2"]);
  });
});