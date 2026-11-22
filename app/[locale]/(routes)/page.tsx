import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireAuthenticated } from "@/lib/authz";
import { projectLeaderNameForUser } from "@/lib/sales/projectbox";
import Container from "./components/ui/Container";
import { SalesDashboard, SalesHeaderActions } from "./crm/sales/SalesDashboard";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function HomePage({ searchParams }: Props) {
  const user = await requireAuthenticated();
  if (projectLeaderNameForUser(user)) {
    redirect({ href: "/projectleiding/dashboard", locale: await getLocale() });
  }
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
