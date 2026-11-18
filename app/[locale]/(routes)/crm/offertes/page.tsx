import { Link } from "@/i18n/navigation";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { euro, percentLabel } from "@/lib/sales/labels";
import { listOffertes } from "@/lib/sales/service";

export default async function OffertesPage(props: { searchParams: Promise<{ leverancier?: string; status?: string }> }) {
  const params = await props.searchParams;
  const user = await requireAuthenticated();
  const rows = await listOffertes(user, { supplier: params.leverancier, status: params.status });
  return (
    <Container title="Offertes" description="Versies en alternatieven uit de externe configurator. Oude versies blijven staan.">
      <form className="mb-4 flex flex-wrap gap-2" action="">
        <input
          name="leverancier"
          defaultValue={params.leverancier ?? ""}
          placeholder="Leverancier"
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        />
        <select name="status" defaultValue={params.status ?? ""} className="h-9 rounded-md border bg-transparent px-3 text-sm">
          <option value="">Alle statussen</option>
          <option value="ACTIVE">Actief</option>
          <option value="HISTORICAL">Vorige versie</option>
        </select>
        <button className="h-9 rounded-md border px-3 text-sm" type="submit">Filter</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-3">Leverancier</th>
              <th className="py-2 pr-3">Nummer</th>
              <th className="py-2 pr-3">Versie</th>
              <th className="py-2 pr-3">Dossier</th>
              <th className="py-2 pr-3">Verkoop</th>
              <th className="py-2 pr-3">Marge</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2 pr-3">{row.supplier}</td>
                <td className="py-2 pr-3">{row.number}</td>
                <td className="py-2 pr-3">{row.version}</td>
                <td className="py-2 pr-3">
                  <Link className="underline" href={`/crm/dossiers/${row.dossierId}`}>{row.dossierNumber}</Link>
                </td>
                <td className="py-2 pr-3">{euro(row.sell)}</td>
                <td className="py-2 pr-3">{euro(row.marginEuro)} ({percentLabel(row.marginPercent)})</td>
                <td className="py-2">{row.status === "ACTIVE" ? "Actief" : "Vorige versie"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="py-4 text-muted-foreground" colSpan={7}>Nog geen offertes.</td></tr>}
          </tbody>
        </table>
      </div>
    </Container>
  );
}
