import { SELLERS, type SellerName } from "@/lib/sales/aanvraag-fields";

/**
 * Dev sign-in for the verkopers. The password is TILO_DEV_PASSWORD, never stored here.
 * Emails are only used when no user with that verkoper name already exists.
 */
export const DEV_SALES_USERS: readonly { email: string; name: SellerName }[] = [
  { email: "yannick.ideler@thielemans.be", name: "Ideler Yannick" },
  { email: "merel.vandoorslaer@thielemans.be", name: "Van Doorslaer Merel" },
  { email: "kristof.vandoorslaer@thielemans.be", name: "Van Doorslaer Kristof" },
  { email: "robbe.haegeman@thielemans.be", name: "Haegeman Robbe" },
  { email: "evi.saerens@thielemans.be", name: "Saerens Evi" },
  { email: "uwee.annaert@thielemans.be", name: "Annaert Uwee" },
  { email: "stijn.demeersman@thielemans.be", name: "De Meersman Stijn" },
];

export function devSalesRosterCoversSellers(): boolean {
  const names = DEV_SALES_USERS.map((person) => person.name);
  return SELLERS.every((seller) => names.filter((name) => name === seller).length === 1);
}
