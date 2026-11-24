import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { raamstudioPlansForDossier } from "@/lib/raamstudio/dossier-plans";
import { listDossiers } from "@/lib/sales/service";
import { Raamstudio2Panel } from "./Raamstudio2Panel";

export default async function Raamstudio2Page({
  searchParams,
}: {
  searchParams: Promise<{ dossier?: string }>;
}) {
  const user = await requireAuthenticated();
  const { dossier: dossierId } = await searchParams;
  const rows = await listDossiers(user);
  const selected = dossierId ? await raamstudioPlansForDossier(user, dossierId) : null;
  const intro = "Raamstudio 2.0 — dossier, plannen en calculatie controleren.";
  return (
    <Container bare title="Raamstudio 2.0" description={intro}>
      <Raamstudio2Panel
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