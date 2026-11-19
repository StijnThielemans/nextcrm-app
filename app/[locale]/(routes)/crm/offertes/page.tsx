import { getTranslations } from "next-intl/server";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { listOfferteOverview } from "@/lib/sales/offerte-list";
import { OfferteList } from "./OfferteList";

export default async function OffertesPage() {
  const user = await requireAuthenticated();
  const t = await getTranslations("Sales");
  const rows = serializeDecimalsList(await listOfferteOverview(user));
  return (
    <Container
      title={t("quotes")}
      description={t("quotesOverviewDescription")}
    >
      <OfferteList rows={rows} />
    </Container>
  );
}
