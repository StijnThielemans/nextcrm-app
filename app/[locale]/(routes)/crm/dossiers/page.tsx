import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { listDossiers } from "@/lib/sales/service";
import { DossierList } from "./DossierList";

export default async function DossiersPage() {
  const user = await requireAuthenticated();
  const rows = serializeDecimalsList(await listDossiers(user));
  return (
    <Container title="Offertedossiers" description="Eén klant kan meerdere dossiers hebben.">
      <DossierList rows={rows} />
    </Container>
  );
}
