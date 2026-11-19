import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { listOfferteOverview } from "@/lib/sales/offerte-list";
import { OfferteList } from "./OfferteList";

export default async function OffertesPage() {
  const user = await requireAuthenticated();
  const rows = serializeDecimalsList(await listOfferteOverview(user));
  return (
    <Container
      title="Offertes"
      description="Offertes van de offertedossiers, met totaal bruto, verzending en of de offerte gewonnen is."
    >
      <OfferteList rows={rows} />
    </Container>
  );
}
