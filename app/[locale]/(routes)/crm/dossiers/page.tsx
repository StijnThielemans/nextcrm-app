import { getTranslations } from "next-intl/server";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { serializeDecimalsList } from "@/lib/serialize-decimals";
import { listDossiers } from "@/lib/sales/service";
import { DossierList } from "./DossierList";

export default async function DossiersPage() {
  const user = await requireAuthenticated();
  const t = await getTranslations("Sales");
  const rows = serializeDecimalsList(await listDossiers(user));
  return (
    <Container title={t("dossiers")} description={t("dossiersDescription")}>
      <DossierList rows={rows} />
    </Container>
  );
}
