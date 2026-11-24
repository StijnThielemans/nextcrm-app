import { getTranslations } from "next-intl/server";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { requireAuthenticated } from "@/lib/authz";
import { listProjectbox } from "@/lib/sales/projectbox-data";
import { ProjectboxList } from "./ProjectboxList";

export default async function ProjectboxPage() {
  const user = await requireAuthenticated();
  const t = await getTranslations("Sales");
  const rows = await listProjectbox(user);
  return (
    <Container title={t("projectbox")} description={t("projectboxDescription")}>
      <ProjectboxList rows={rows} />
    </Container>
  );
}
