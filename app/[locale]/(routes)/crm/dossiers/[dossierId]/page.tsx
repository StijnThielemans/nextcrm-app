import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { getDossier } from "@/lib/sales/service";
import { listPendingOfferteboxAttachments } from "@/lib/sales/offertebox-filing";
import { recordRecentOpen } from "@/lib/sales/recent-opens";
import { DossierPanel } from "./DossierPanel";

export default async function DossierPage(props: {
  params: Promise<{ dossierId: string }>;
  searchParams: Promise<{ bijlagen?: string }>;
}) {
  const { dossierId } = await props.params;
  const { bijlagen } = await props.searchParams;
  const user = await requireAuthenticated();
  const t = await getTranslations("Sales");
  const dossier = await getDossier(user, dossierId);
  if (!dossier) notFound();
  await recordRecentOpen(user.id, "DOSSIER", dossier.id);
  const pendingAttachments = await listPendingOfferteboxAttachments(user, dossier.id);
  return (
    <Container title={dossier.name || t("fallbackDossier")} description={dossier.number ?? ""}>
      <DossierPanel
        dossier={dossier}
        pendingAttachments={pendingAttachments}
        promptAttachments={bijlagen === "1"}
      />
    </Container>
  );
}
