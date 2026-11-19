import { getTranslations } from "next-intl/server";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { previewDossierNumber } from "@/lib/sales/service";
import { AanvraagForm } from "./AanvraagForm";

export default async function AanvraagPage() {
  const t = await getTranslations("Sales");
  const projectNumber = await previewDossierNumber();
  return (
    <Container
      title={t("newRequest")}
      description={t("newRequestDescription")}
    >
      <AanvraagForm projectNumber={projectNumber ?? t("automatic")} />
    </Container>
  );
}
