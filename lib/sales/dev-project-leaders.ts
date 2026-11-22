import { PROJECT_LEADERS, type ProjectLeaderName } from "@/lib/sales/projectbox";

/**
 * Dev sign-in for the projectleiders. The password is TILO_DEV_PASSWORD, never stored here.
 * These people are not verkopers. Emails are only used when no user with that name already exists.
 */
export const DEV_PROJECT_LEADERS: readonly { email: string; name: ProjectLeaderName }[] = [
  { email: "jens.vanholder@thielemans.be", name: "Van Holder Jens" },
  { email: "johan.vanaerschot@thielemans.be", name: "Van Aerschot Johan" },
  { email: "jelle.deboeck@thielemans.be", name: "De Boeck Jelle" },
  { email: "anne.vanloo@thielemans.be", name: "Van Loo Anne" },
  { email: "aaron.migeotte@thielemans.be", name: "Migeotte Aaron" },
];

export function devProjectLeaderRosterCoversLeaders(): boolean {
  const names = DEV_PROJECT_LEADERS.map((person) => person.name);
  return PROJECT_LEADERS.every((leader) => names.filter((name) => name === leader).length === 1);
}
