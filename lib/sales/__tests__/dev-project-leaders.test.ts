import { SELLERS } from "../aanvraag-fields";
import { DEV_SALES_USERS } from "../dev-sales-users";
import { DEV_PROJECT_LEADERS, devProjectLeaderRosterCoversLeaders } from "../dev-project-leaders";
import { PROJECT_LEADERS } from "../projectbox";

describe("dev project leaders", () => {
  it("gives every projectleider one dev email and keeps them out of the verkoper roster", () => {
    expect(devProjectLeaderRosterCoversLeaders()).toBe(true);
    expect(DEV_PROJECT_LEADERS.map((person) => person.name)).toEqual([...PROJECT_LEADERS]);
    expect(DEV_PROJECT_LEADERS.map((person) => person.email)).toEqual([
      "jens.vanholder@thielemans.be",
      "johan.vanaerschot@thielemans.be",
      "jelle.deboeck@thielemans.be",
      "anne.vanloo@thielemans.be",
      "aaron.migeotte@thielemans.be",
    ]);
    const sellerNames = new Set<string>(SELLERS);
    const sellerEmails = new Set(DEV_SALES_USERS.map((person) => person.email));
    for (const person of DEV_PROJECT_LEADERS) {
      expect(sellerNames.has(person.name)).toBe(false);
      expect(sellerEmails.has(person.email)).toBe(false);
    }
  });
});
