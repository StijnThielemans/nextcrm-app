import { notFound } from "next/navigation";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { DossierPanel } from "@/app/[locale]/(routes)/crm/dossiers/[dossierId]/DossierPanel";
import { requireAuthenticated } from "@/lib/authz";
import { listPendingOfferteboxAttachments } from "@/lib/sales/offertebox-filing";
import { getDossier } from "@/lib/sales/service";

export default async function ProjectPage(props: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await props.params;
  const user = await requireAuthenticated();
  const dossier = await getDossier(user, projectId);
  if (!dossier?.executionProjectNumber) notFound();
  const pendingAttachments = await listPendingOfferteboxAttachments(user, dossier.id);
  return (
    <Container bare>
      <DossierPanel dossier={dossier} pendingAttachments={pendingAttachments} surface="project" />
    </Container>
  );
}
