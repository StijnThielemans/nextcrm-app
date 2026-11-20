import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { raamstudioPlansForDossier } from "@/lib/raamstudio/dossier-plans";
import { listDossiers } from "@/lib/sales/service";
import { RaamstudioPanel } from "./RaamstudioPanel";

export default async function RaamstudioPage({
  searchParams,
}: {
  searchParams: Promise<{ dossier?: string }>;
}) {
  const user = await requireAuthenticated();
  const { dossier: dossierId } = await searchParams;
  const rows = await listDossiers(user);
  const selected = dossierId ? await raamstudioPlansForDossier(user, dossierId) : null;
  return (
    <Container
      title="RaamStudio"
      description="Kies een offertedossier. RaamStudio opent daarna met de plannen van dat dossier. De projectgegevens komen uit het dossier."
    >
      <RaamstudioPanel
        dossiers={rows.map((row) => ({
          id: row.id,
          number: row.number,
          name: row.name,
          customer: row.customer,
        }))}
        selected={selected}
        missing={Boolean(dossierId) && !selected}
      />
    </Container>
  );
}
