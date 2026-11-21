import { getTranslations } from "next-intl/server";
import Container from "@/app/[locale]/(routes)/components/ui/Container";
import { Link } from "@/i18n/navigation";
import { requireAuthenticated } from "@/lib/authz";
import { getProjectDashboard } from "@/lib/sales/projects";

export default async function ProjectleidingDashboardPage() {
  const user = await requireAuthenticated();
  const t = await getTranslations("Sales");
  const board = await getProjectDashboard(user);
  const cards = [
    [t("projectCount"), String(board.projectCount)],
    [t("projectsThisMonth"), String(board.newThisMonth)],
    [t("wonWithoutProject"), String(board.wonWithoutProjectCount)],
  ];
  return (
    <Container title={t("projectleiding")} description={t("projectDashboardDescription")}>
      <div className="space-y-4">
        <dl className="tilo-frame tilo-cells grid-cols-1 sm:grid-cols-3">
          {cards.map(([label, value]) => (
            <div key={label} className="min-w-0 px-5 py-4">
              <dt className="text-[0.75rem] text-muted-foreground">{label}</dt>
              <dd className="mt-1.5 text-[1.65rem] font-medium tabular-nums leading-none tracking-tight">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="tilo-frame p-4">
            <h2 className="mb-1 text-sm font-medium">{t("recentProjects")}</h2>
            {board.recent.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">{t("noProjects")}</p>
            ) : (
              <ul className="tilo-rows text-sm">
                {board.recent.map((project) => (
                  <li key={project.id}>
                    <Link className="flex h-12 items-center gap-2 hover:text-[hsl(183_35%_28%)]" href={`/projectleiding/projecten/${project.id}`}>
                      <span className="tabular-nums">{project.projectNumber}</span>
                      <span>{project.name || project.customer}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="tilo-frame p-4">
            <h2 className="mb-1 text-sm font-medium">{t("wonWithoutProject")}</h2>
            {board.wonWithoutProject.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">{t("wonWaitingEmpty")}</p>
            ) : (
              <ul className="tilo-rows text-sm">
                {board.wonWithoutProject.map((dossier) => (
                  <li key={dossier.id}>
                    <Link className="flex h-12 items-center gap-2 hover:text-[hsl(183_35%_28%)]" href={`/crm/dossiers/${dossier.id}`}>
                      <span>{dossier.number}</span>
                      <span>{dossier.name || dossier.customer}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Container>
  );
}
