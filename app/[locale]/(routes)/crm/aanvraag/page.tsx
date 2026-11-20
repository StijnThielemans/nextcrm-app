import { getTranslations } from "next-intl/server";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { offerteboxPrefill } from "@/lib/sales/offertebox";
import { previewDossierNumber } from "@/lib/sales/service";
import { AanvraagForm } from "./AanvraagForm";
import { AanvraagMail } from "./AanvraagMail";

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
      {fromBox ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]">
          <AanvraagForm projectNumber={projectNumber ?? t("automatic")} fromBox={fromBox} />
          <AanvraagMail mail={fromBox.mail} />
        </div>
      ) : (
        <AanvraagForm projectNumber={projectNumber ?? t("automatic")} fromBox={fromBox} />
      )}
    </Container>
  );
}
