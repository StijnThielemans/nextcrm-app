import { getTranslations } from "next-intl/server";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Link } from "@/i18n/navigation";
import { ProjectBoard } from "./ProjectBoard";

export default async function ProjectleidingDashboardPage() {
  const t = await getTranslations("Sales");
  return (
    <Container
      title={t("projectleiding")}
      description={t("projectDashboardDescription")}
      actions={
        <Link href="/projectleiding/projecten" className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm">
          {t("projects")}
        </Link>
      }
    >
      <ProjectBoard />
    </Container>
  );
}
