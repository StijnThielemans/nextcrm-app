import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAuthenticated } from "@/lib/authz";
import { euro } from "@/lib/sales/labels";
import { listProjectbox } from "@/lib/sales/projectbox-data";
import { summarizeProjectbox } from "@/lib/sales/projectbox";
import { getProjectDashboard, type ProjectBoardRow, type ProjectFollowUpLine } from "@/lib/sales/projects";

function show(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return text || "—";
}

type SalesText = Awaited<ReturnType<typeof getTranslations>>;

function followUpLabel(channel: string, t: SalesText) {
  if (channel === "EMAIL_OFFERTE" || channel === "EMAIL_SELLER") return t("followUpChannels.EMAIL_SELLER");
  return t.has(`followUpChannels.${channel}`) ? t(`followUpChannels.${channel}`) : channel;
}

function Field({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="min-w-0 px-4 py-3" data-testid={testId}>
      <dt className="text-sm text-muted-foreground md:text-[0.72rem]">{label}</dt>
      <dd className="mt-1 text-base leading-snug md:text-sm">{children}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
      <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
      {children}
    </h3>
  );
}

function FollowUpList({ events, t }: { events: ProjectFollowUpLine[]; t: SalesText }) {
  if (events.length === 0) return <p className="py-2 text-sm text-muted-foreground">{t("noFollowUp")}</p>;
  return (
    <ul className="tilo-rows max-h-72 overflow-y-auto text-sm">
      {events.map((event) => (
        <li key={event.id} className="py-2">
          {event.at} · {followUpLabel(event.channel, t)} · {event.seller ?? "—"}
          {event.original ? ` · ${t("original")}` : ""}
          {event.note ? ` · ${event.note}` : ""}
        </li>
      ))}
    </ul>
  );
}

function ProjectCard({ project, t }: { project: ProjectBoardRow; t: SalesText }) {
  const architect = project.architectName
    ? `${project.architectName}${project.architectExternalId ? ` (${project.architectExternalId})` : ""}`
    : null;
  const group = project.projectGroup && t.has(`groups.${project.projectGroup}`)
    ? t(`groups.${project.projectGroup}`)
    : project.projectGroup;
  const channel = project.channel && t.has(`channels.${project.channel}`)
    ? t(`channels.${project.channel}`)
    : project.channel;
  const status = t.has(`steps.${project.status}`) ? t(`steps.${project.status}`) : project.status;

  return (
    <article
      className="tilo-frame"
      data-testid="project-board-card"
      data-project-number={project.projectNumber}
      data-dossier-number={project.dossierNumber ?? ""}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-3">
        <h2 className="flex min-w-0 flex-wrap items-center gap-x-2 text-base font-medium md:text-sm">
          <span aria-hidden className="h-3 w-[3px] shrink-0 rounded-full bg-[hsl(var(--tilo))]" />
          <Link className="tabular-nums underline-offset-4 hover:underline" href={`/projectleiding/projecten/${project.id}`} data-testid="project-number">
            {project.projectNumber}
          </Link>
          <span>{show(project.name)}</span>
          {project.dossierNumber && (
            <Link className="font-normal text-muted-foreground underline-offset-4 hover:underline" href={`/crm/dossiers/${project.id}`} data-testid="project-dossier-number">
              {project.dossierNumber}
            </Link>
          )}
        </h2>
        <span className="ml-auto inline-flex items-center rounded-full bg-[hsl(183_40%_94%)] px-2.5 py-0.5 text-xs font-medium text-[hsl(190_28%_24%)]" data-testid="project-status">
          {status}
        </span>
      </header>
      <dl className="tilo-cells grid-cols-2 lg:grid-cols-4">
        <Field label={t("executionProjectNumber")}>{project.projectNumber}</Field>
        <Field label={t("projectNumber")} testId="board-dossier-number">{project.dossierNumber ?? "—"}</Field>
        <Field label={t("status")}>{status}</Field>
        <Field label={t("seller")} testId="project-seller">{show(project.seller)}</Field>
        <Field label={t("customer")}>
          {project.customerId && project.customer ? (
            <Link className="underline-offset-4 hover:underline" href={`/crm/accounts/${project.customerId}`}>{project.customer}</Link>
          ) : show(project.customer)}
        </Field>
        <Field label={t("projectDescription")}>{show(project.name)}</Field>
        <Field label={t("projectGroup")}>{show(group)}</Field>
        <Field label={t("architect")}>{show(architect)}</Field>
        <Field label={t("email")}>{show(project.email)}</Field>
        <Field label={t("phone")}>{show(project.phone)}</Field>
        <Field label={t("gsm")}>{show(project.mobile)}</Field>
        <Field label={t("vatNumber")}>{show(project.vat)}</Field>
        <Field label={t("address")}>{show(project.customerAddress)}</Field>
        <Field label={t("siteAddress")}>{show(project.siteAddress)}</Field>
        <Field label={t("priceRequestDate")}>{show(project.priceRequestDate ?? project.requestDate)}</Field>
        <Field label={t("channel")}>{show(channel)}</Field>
        <Field label={t("followUp")}>{show(project.followUpDate)}</Field>
        <Field label={t("nextAction")}>{show(project.nextStep)}</Field>
      </dl>
      {project.notes?.trim() && (
        <p className="border-t border-border px-4 py-3 text-sm">
          <span className="text-[0.72rem] text-muted-foreground">{t("internalNote")}</span>
          <span className="mt-1 block">{project.notes}</span>
        </p>
      )}
      <div className="border-t border-border px-4 py-3">
        <SectionTitle>{t("quotes")}</SectionTitle>
        {project.quotes.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t("noQuotes")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tilo-grid w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-muted-foreground">
                  <th className="py-2 font-medium">{t("quote")}</th>
                  <th className="py-2 font-medium">{t("date")}</th>
                  <th className="py-2 font-medium">{t("grossTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {project.quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td className="py-2 pr-3">
                      {quote.name}
                      {quote.won && <span className="ml-2 text-xs font-medium">{t("won")}</span>}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">{show(quote.date)}</td>
                    <td className="whitespace-nowrap py-2 tabular-nums" data-quote-gross={quote.id} data-total-bruto="">
                      {quote.gross == null ? t("noPrice") : euro(quote.gross)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="grid border-t border-border lg:grid-cols-2">
        <section className="min-w-0 px-4 py-3 lg:border-r lg:border-border">
          <SectionTitle>{t("followUp")}</SectionTitle>
          <FollowUpList events={project.followUps} t={t} />
        </section>
        <section className="min-w-0 border-t border-border px-4 py-3 lg:border-t-0">
          <SectionTitle>{t("documentsTitle")}</SectionTitle>
          {project.documents.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{t("noDocuments")}</p>
          ) : (
            <ul className="tilo-rows max-h-72 overflow-y-auto text-sm">
              {project.documents.map((document) => (
                <li key={document.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0 break-all">{document.name}</span>
                  {document.category && t.has(`folders.${document.category}`) && (
                    <span className="shrink-0 text-xs text-muted-foreground">{t(`folders.${document.category}`)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}

export async function ProjectBoard() {
  const user = await requireAuthenticated();
  const t = await getTranslations("Sales");
  const board = await getProjectDashboard(user);
  const box = summarizeProjectbox(await listProjectbox(user));
  const cards = [
    [t("projectCount"), String(board.projectCount)],
    [t("projectsThisMonth"), String(board.newThisMonth)],
    [t("wonWithoutProject"), String(board.wonWithoutProjectCount)],
  ];
  return (
    <div className="space-y-4" data-testid="project-dashboard">
      <dl className="tilo-frame tilo-cells grid-cols-1 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="min-w-0 px-5 py-4">
            <dt className="text-[0.75rem] text-muted-foreground">{label}</dt>
            <dd className="mt-1.5 text-[1.65rem] font-medium tabular-nums leading-none tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="tilo-frame px-5 py-4" data-testid="projectbox-summary">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
            {t("projectboxCount")}
          </h2>
          <Link href="/projectleiding/projectbox" className="text-sm underline-offset-4 hover:underline" data-testid="projectbox-count">
            {box.count}
          </Link>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="projectbox-assignment">
          {box.leaders.map((leader) => (
            <li key={leader.name} data-leader={leader.name}>
              <span>{leader.name}</span>{" "}
              <span className="tabular-nums">{leader.count}</span>
            </li>
          ))}
          <li data-leader="unassigned">
            <span>{t("projectboxUnassigned")}</span>{" "}
            <span className="tabular-nums">{box.unassigned}</span>
          </li>
        </ul>
      </section>
      <section className="space-y-4" aria-label={t("recentProjects")}>
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
          {t("recentProjects")}
        </h2>
        {board.projects.length === 0 ? (
          <p className="tilo-frame px-4 py-6 text-sm text-muted-foreground">{t("noProjects")}</p>
        ) : (
          board.projects.map((project) => <ProjectCard key={project.id} project={project} t={t} />)
        )}
      </section>
      <section className="tilo-frame p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-medium">
          <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
          {t("wonWithoutProject")}
        </h2>
        {board.wonWithoutProject.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">{t("wonWaitingEmpty")}</p>
        ) : (
          <ul className="tilo-rows text-sm">
            {board.wonWithoutProject.map((dossier) => (
              <li key={dossier.id}>
                <Link className="flex min-h-12 items-center gap-3 hover:text-[hsl(183_35%_28%)]" href={`/crm/dossiers/${dossier.id}`}>
                  <span className="tabular-nums">{dossier.number}</span>
                  <span className="min-w-0 flex-1">{dossier.name || dossier.customer}</span>
                  <span className="text-muted-foreground">{dossier.seller}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
