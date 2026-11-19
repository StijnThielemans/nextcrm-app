import { getTranslations } from "next-intl/server";
import Container from "./components/ui/Container";
import { SalesDashboard } from "./crm/sales/SalesDashboard";

export default async function HomePage() {
  const t = await getTranslations("Sales");
  return (
    <Container
      title={t("sales")}
      description={t("homeDescription")}
    >
      <SalesDashboard />
    </Container>
  );
}
