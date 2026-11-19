import { notFound } from "next/navigation";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { getDossier } from "@/lib/sales/service";
import { recordRecentOpen } from "@/lib/sales/recent-opens";
import { DossierPanel } from "./DossierPanel";

export default async function DossierPage(props: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await props.params;
  const user = await requireAuthenticated();
  const dossier = await getDossier(user, dossierId);
  if (!dossier) notFound();
  await recordRecentOpen(user.id, "DOSSIER", dossier.id);
  return (
    <Container title={dossier.name || "Offertedossier"} description={dossier.number ?? ""}>
      <DossierPanel dossier={dossier} />
    </Container>
  );
}
