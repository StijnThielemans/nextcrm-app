import { getTranslations } from "next-intl/server";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { listOffertebox } from "@/lib/sales/offertebox";
import { OfferteboxBoard } from "./OfferteboxBoard";

export default async function OfferteboxPage() {
  const user = await requireAuthenticated();
  const t = await getTranslations("Sales");
  const view = await listOffertebox(user);
  return (
    <Container title={t("offertebox.title")} description={t("offertebox.description")}>
      <OfferteboxBoard view={view} />
    </Container>
  );
}
