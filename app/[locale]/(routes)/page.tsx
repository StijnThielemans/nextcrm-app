import { getTranslations } from "next-intl/server";
import Container from "./components/ui/Container";
import { SalesDashboard, SalesHeaderActions } from "./crm/sales/SalesDashboard";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: Props) {
  const t = await getTranslations("Sales");
  const query = await searchParams;
  return (
    <Container
      title={t("sales")}
      description={t("homeDescription")}
      actions={<SalesHeaderActions />}
    >
      <SalesDashboard query={query} />
    </Container>
  );
}
