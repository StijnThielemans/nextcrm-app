import { getTranslations } from "next-intl/server";
import Container from "../../components/ui/Container";
import { SalesDashboard, SalesHeaderActions } from "../sales/SalesDashboard";

export default async function CrmDashboardPage() {
  const t = await getTranslations("Sales");
  return (
    <Container
      title={t("sales")}
      description={t("dashboardDescription")}
      actions={<SalesHeaderActions />}
    >
      <SalesDashboard />
    </Container>
  );
}
