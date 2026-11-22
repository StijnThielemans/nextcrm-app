import getProjectleidingMenuItem from "@/app/[locale]/(routes)/components/menu-items/Projectleiding";
import { formatProjectNumber, projectCreationAllowed } from "../project-number";

describe("project number", () => {
  it("builds 1 + seven-digit sequence + two-digit year", () => {
    expect(formatProjectNumber(1, 2026)).toBe("1000000126");
    expect(formatProjectNumber(2, 2026)).toBe("1000000226");
    expect(formatProjectNumber(3, 2026)).toBe("1000000326");
    expect(formatProjectNumber(10, 2026)).toBe("1000001026");
    expect(formatProjectNumber(1, 2027)).toBe("1000000127");
    expect(formatProjectNumber(1, 2026)).toHaveLength(10);
  });

  it("allows a project only from a won dossier", () => {
    expect(projectCreationAllowed("GEWONNEN")).toBe(true);
    expect(projectCreationAllowed("VERLOREN")).toBe(false);
    expect(projectCreationAllowed("NIEUW")).toBe(false);
    expect(projectCreationAllowed(null)).toBe(false);
  });
});

describe("Projectleiding menu", () => {
  it("is one group with Dashboard, Projectbox and Projecten", () => {
    const item = getProjectleidingMenuItem();
    expect(item.title).toBe("Projectleiding");
    expect(item.items?.map((entry) => [entry.title, entry.url])).toEqual([
      ["Dashboard", "/projectleiding/dashboard"],
      ["Projectbox", "/projectleiding/projectbox"],
      ["Projecten", "/projectleiding/projecten"],
    ]);
  });
});
