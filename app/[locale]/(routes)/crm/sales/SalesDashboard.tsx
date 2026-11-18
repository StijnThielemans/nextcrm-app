import { Link } from "@/i18n/navigation";
import { requireAuthenticated } from "@/lib/authz";
import { DOSSIER_STATUSES, DOSSIER_STATUS_LABELS, euro, percentLabel } from "@/lib/sales/labels";
import { getSalesDashboard } from "@/lib/sales/service";

export async function SalesDashboard() {
  const user = await requireAuthenticated();
  const tiles = await getSalesDashboard(user);
  const cards = [
    ["Open dossiers", String(tiles.openCount)],
    ["Op te volgen", String(tiles.followUpCount)],
    ["Nieuwe aanvragen deze maand", String(tiles.newThisMonth)],
    ["Gewonnen deze maand", String(tiles.wonCount)],
    ["Verloren deze maand", String(tiles.lostCount)],
    ["Open verkoopwaarde", euro(tiles.openSell)],
    ["Open marge", euro(tiles.openMargin)],
    ["Open marge %", percentLabel(tiles.openMarginPercent)],
    ["Gewonnen verkoop deze maand", euro(tiles.wonSell)],
    ["Gewonnen marge deze maand", euro(tiles.wonMargin)],
    ["Verloren verkoop deze maand", euro(tiles.lostSell)],
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href="/crm/aanvraag" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground">
          + Nieuwe aanvraag
        </Link>
        <Link href="/crm/dossiers" className="inline-flex h-9 items-center rounded-md border px-4 text-sm">
          Offertedossiers
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div>
        <h2 className="mb-2 text-lg font-semibold">Per status</h2>
        <ul className="grid gap-2 sm:grid-cols-2 text-sm">
          {DOSSIER_STATUSES.map((status) => (
            <li key={status} className="flex justify-between rounded-md border px-3 py-2">
              <span>{DOSSIER_STATUS_LABELS[status]}</span>
              <span>{tiles.byStatus[status] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
