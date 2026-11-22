import { SELLERS } from "../aanvraag-fields";
import { DEV_SALES_USERS, devSalesRosterCoversSellers } from "../dev-sales-users";

describe("dev sales users", () => {
  it("gives every verkoper one dev email, including the two new names", () => {
    expect(devSalesRosterCoversSellers()).toBe(true);
    expect(DEV_SALES_USERS.map((person) => person.name).sort()).toEqual([...SELLERS].sort());
    expect(DEV_SALES_USERS.map((person) => person.email)).toEqual([
      "yannick.ideler@thielemans.be",
      "merel.vandoorslaer@thielemans.be",
      "kristof.vandoorslaer@thielemans.be",
      "robbe.haegeman@thielemans.be",
      "evi.saerens@thielemans.be",
      "uwee.annaert@thielemans.be",
      "stijn.demeersman@thielemans.be",
    ]);
    expect(DEV_SALES_USERS.some((person) => person.name === "Annaert Uwee")).toBe(true);
    expect(DEV_SALES_USERS.some((person) => person.name === "Van Doorslaer Kristof")).toBe(true);
  });
});
