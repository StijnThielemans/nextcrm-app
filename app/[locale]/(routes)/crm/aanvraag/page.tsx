import { getTranslations } from "next-intl/server";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { offerteboxPrefill } from "@/lib/sales/offertebox";
import { previewDossierNumber } from "@/lib/sales/service";
import { AanvraagForm } from "./AanvraagForm";

export default async function AanvraagPage({
  searchParams,
}: {
  searchParams: Promise<{ offertebox?: string }>;
}) {
  const t = await getTranslations("Sales");
  const { offertebox } = await searchParams;
  const projectNumber = await previewDossierNumber();
  const fromBox = offertebox ? await offerteboxPrefill(await requireAuthenticated(), offertebox) : null;
  return (
    <Container
      title={t("newRequest")}
      description={t("newRequestDescription")}
    >
      <AanvraagForm projectNumber={projectNumber ?? t("automatic")} fromBox={fromBox} />
    </Container>
  );
}
