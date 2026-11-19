import { Link } from "@/i18n/navigation";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { listDossiers } from "@/lib/sales/service";

export default async function DossiersPage() {
  const user = await requireAuthenticated();
  const rows = await listDossiers(user);
  return (
    <Container title="Offertedossiers" description="Eén klant kan meerdere dossiers hebben.">
      <div className="mb-4">
        <Link href="/crm/aanvraag" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground">
          + Nieuwe aanvraag
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-3">Nummer</th>
              <th className="py-2 pr-3">Project</th>
              <th className="py-2 pr-3">Klant</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Aanvraag</th>
              <th className="py-2 pr-3">Opvolging</th>
              <th className="py-2">Verkoper</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-2 pr-3">
                  <Link className="underline" href={`/crm/dossiers/${row.id}`}>{row.number}</Link>
                </td>
                <td className="py-2 pr-3">{row.name}</td>
                <td className="py-2 pr-3">{row.customer}</td>
                <td className="py-2 pr-3">{row.stepLabel}</td>
                <td className="py-2 pr-3">{row.requestDate}</td>
                <td className="py-2 pr-3">{row.followUpDate ?? "—"}</td>
                <td className="py-2">{row.seller}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td className="py-4 text-muted-foreground" colSpan={7}>Nog geen offertedossiers.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Container>
  );
}
