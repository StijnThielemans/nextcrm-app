import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OpenStoredFile } from "@/components/files/OpenStoredFile";
import { euro } from "@/lib/sales/labels";
import { googleMapsSearchUrl } from "@/lib/sales/maps-link";
import type { ProjectFollowUpLine, ProjectScreenAddress, ProjectScreenData } from "@/lib/sales/projects";

type SalesText = Awaited<ReturnType<typeof getTranslations>>;

function text(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function Cell({
  label,
  field,
  children,
  empty = false,
}: {
  label: string;
  field: string;
  children?: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="min-w-0 px-3 py-2" data-field={field} data-empty={empty ? "true" : "false"}>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
      <div className="mt-0.5 min-h-5 text-[13px] leading-snug">{empty ? <span className="text-muted-foreground">—</span> : children}</div>
    </div>
  );
}

function TextCell({ label, field, value, testId }: { label: string; field: string; value?: string | null; testId?: string }) {
  const shown = text(value);
  return (
    <div className="min-w-0 px-3 py-2" data-field={field} data-empty={shown ? "false" : "true"} data-testid={testId}>
      <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
      <div className="mt-0.5 min-h-5 text-[13px] leading-snug">{shown || "—"}</div>
    </div>
  );
}

function BlockTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-xs font-medium">
      <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
      {children}
    </h2>
  );
}

function choiceLabel(value: string | null | undefined, prefix: string, t: SalesText) {
  if (!value) return "";
  return t.has(`${prefix}.${value}`) ? t(`${prefix}.${value}`) : value;
}

function AddressLines({
  title,
  testId,
  lines,
}: {
  title: string;
  testId: string;
  lines: { label: string; field: string; value?: string | null; node?: ReactNode }[];
}) {
  return (
    <section className="tilo-frame p-3" data-testid={testId}>
      <BlockTitle>{title}</BlockTitle>
      <dl className="space-y-1">
        {lines.map((line) => {
          const shown = text(line.value);
          const empty = !line.node && !shown;
          return (
            <div key={line.field} className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-baseline gap-2" data-field={line.field} data-empty={empty ? "true" : "false"}>
              <dt className="text-[11px] text-muted-foreground">{line.label}</dt>
              <dd className="min-w-0 text-[13px] leading-snug">{empty ? <span className="text-muted-foreground">—</span> : line.node ?? shown}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function streetLink(address: ProjectScreenAddress | { street: string | null; postalCode: string | null; city: string | null; country: string | null }) {
  const street = text(address.street);
  if (!street) return null;
  const full = [address.street, address.postalCode, address.city, address.country].map((part) => text(part)).filter(Boolean).join(", ");
  const href = googleMapsSearchUrl(full);
  if (!href) return street;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-[hsl(var(--tilo))] underline-offset-2">
      {street}
    </a>
  );
}

function Remark({ title, field, value }: { title: string; field: string; value?: string | null }) {
  const shown = text(value);
  return (
    <section className="tilo-frame flex min-h-32 flex-col p-3" data-field={field} data-empty={shown ? "false" : "true"}>
      <BlockTitle>{title}</BlockTitle>
      <p className="whitespace-pre-wrap text-[13px] leading-snug">{shown}</p>
    </section>
  );
}

function EmptyBlock({ title, testId }: { title: string; testId: string }) {
  return (
    <section className="tilo-frame min-h-32 p-3" data-testid={testId} data-empty="true">
      <BlockTitle>{title}</BlockTitle>
    </section>
  );
}

function followUpLabel(channel: string, t: SalesText) {
  if (channel === "EMAIL_OFFERTE" || channel === "EMAIL_SELLER") return t("followUpChannels.EMAIL_SELLER");
  return t.has(`followUpChannels.${channel}`) ? t(`followUpChannels.${channel}`) : channel;
}

function FollowUps({ events, nextStep, t }: { events: ProjectFollowUpLine[]; nextStep: string | null; t: SalesText }) {
  const empty = events.length === 0 && !text(nextStep);
  return (
    <section className="tilo-frame p-3" data-testid="project-follow-up" data-empty={empty ? "true" : "false"}>
      <BlockTitle>{t("followUp")}</BlockTitle>
      <p className="text-[13px]" data-field="next-step" data-empty={text(nextStep) ? "false" : "true"}>
        <span className="text-[11px] text-muted-foreground">{t("nextAction")}</span>
        <span className="mt-0.5 block">{text(nextStep) || "—"}</span>
      </p>
      {events.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{t("noFollowUp")}</p>
      ) : (
        <ul className="tilo-rows mt-2 text-[13px]">
          {events.map((event) => (
            <li key={event.id} className="py-1.5">
              {event.at} · {followUpLabel(event.channel, t)} · {event.seller ?? "—"}
              {event.note ? ` · ${event.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SpecGrid({ project, group, customerName, t, p }: { project: ProjectScreenData; group: string; customerName: ReactNode; t: SalesText; p: SalesText }) {
  return (
    <section className="tilo-frame" aria-label={p("tabs.algemeen")}>
      <dl className="tilo-cells grid-cols-2 md:grid-cols-4 xl:grid-cols-6">
        <Cell label={t("customer")} field="customer" empty={!text(project.customerName)}>
          {customerName}
        </Cell>
        <TextCell label={p("type")} field="type" value={group} />
        <TextCell label={t("seller")} field="seller" value={project.seller} testId="project-seller" />
        <TextCell label={t("name")} field="name" value={project.name} />
        <TextCell label={t("priceRequestDate")} field="price-request-date" value={project.priceRequestDate} />
        <TextCell label={p("projectLeader")} field="project-leader" value={null} />
        {[1, 2, 3, 4].map((n) => (
          <TextCell key={`series-${n}`} label={p("series", { n })} field={`series-${n}`} value={null} />
        ))}
        <TextCell label={p("colorOutside")} field="color-outside" value={null} />
        <TextCell label={p("colorInside")} field="color-inside" value={null} />
        <TextCell label={p("preAno")} field="pre-ano" value={null} />
        {[1, 2, 3, 4].map((n) => (
          <TextCell key={`glass-${n}`} label={p("glass", { n })} field={`glass-${n}`} value={null} />
        ))}
      </dl>
    </section>
  );
}

function Flags({ p }: { p: SalesText }) {
  return (
    <section className="tilo-frame px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-[13px]" data-field="on-hold" data-empty="true">
          <input type="checkbox" disabled defaultChecked={false} className="size-3.5" />
          {p("onHold")}
        </label>
        <div className="flex flex-wrap items-center gap-1.5" data-field="file-location" data-empty="true">
          <span className="text-[11px] text-muted-foreground">{p("fileLocation")}</span>
          <span aria-pressed="false" className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{p("inCabinet")}</span>
          <span aria-pressed="false" className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{p("withMe")}</span>
        </div>
        <label className="flex items-center gap-2 text-[13px]" data-field="check-in" data-empty="true">
          <input type="checkbox" disabled defaultChecked={false} className="size-3.5" />
          {p("checkIn")}
        </label>
      </div>
      <dl className="tilo-cells -mx-3 mt-2 grid-cols-2 lg:grid-cols-4">
        <TextCell label={p("reference")} field="reference" value={null} />
        <TextCell label={p("delivery")} field="delivery" value={null} />
        <TextCell label={p("key")} field="key" value={null} />
        <TextCell label={p("processor")} field="processor" value={null} />
      </dl>
    </section>
  );
}

function ProjectTabPanels({
  label,
  tabs,
}: {
  label: string;
  tabs: { id: string; label: string; content: ReactNode }[];
}) {
  const rules = tabs
    .map((tab) => `.project-tabs:has(#project-tab-${tab.id}:checked) [data-project-panel="${tab.id}"] { display: block; }`)
    .join("\n");
  return (
    <div className="project-tabs space-y-3">
      <div className="tilo-frame overflow-hidden">
        <div role="radiogroup" aria-label={label} data-testid="project-tabs" className="flex overflow-x-auto bg-white">
          {tabs.map((tab, index) => (
            <label
              key={tab.id}
              data-testid={`project-tab-${tab.id}`}
              data-tab-index={index}
              className="inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 border-transparent bg-white px-2 py-2 text-[12.5px] font-medium text-muted-foreground has-[:checked]:border-[hsl(var(--tilo))] has-[:checked]:bg-[hsl(183_42%_96%)] has-[:checked]:text-[hsl(190_32%_22%)]"
            >
              <input
                id={`project-tab-${tab.id}`}
                className="sr-only"
                type="radio"
                name="project-screen-tab"
                value={tab.id}
                defaultChecked={index === 0}
              />
              {tab.label}
            </label>
          ))}
        </div>
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} data-testid={`project-panel-${tab.id}`} data-project-panel={tab.id}>
          {tab.content}
        </div>
      ))}
      <style>{`.project-tabs [data-project-panel] { display: none; }\n${rules}`}</style>
    </div>
  );
}

export async function ProjectScreen({ project }: { project: ProjectScreenData }) {
  const t = await getTranslations("Sales");
  const p = await getTranslations("Sales.projectScreen");
  const status = t.has(`steps.${project.status}`) ? t(`steps.${project.status}`) : project.status;
  const group = choiceLabel(project.projectGroup, "groups", t);
  const architect = project.architectName
    ? `${project.architectName}${project.architectExternalId ? ` (${project.architectExternalId})` : ""}`
    : "";
  const customer = project.customerAddress;
  const billing = project.billingAddress;
  const role = choiceLabel(customer.role, "roles", t);
  const vatChoice = choiceLabel(customer.vatChoice, "vatChoice", t);
  const customerName = project.customerId && project.customerName ? (
    <Link className="underline-offset-4 hover:underline" href={`/crm/accounts/${project.customerId}`} data-testid="project-customer">
      {project.customerName}
    </Link>
  ) : (
    project.customerName
  );
  const site = {
    street: project.siteStreet,
    postalCode: project.sitePostalCode,
    city: project.siteCity,
    country: project.siteCountry,
  };

  return (
    <div className="space-y-3" data-testid="project-screen" data-project-number={project.projectNumber}>
      <header className="tilo-frame" data-testid="project-header">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm font-medium">
            <span aria-hidden className="h-3 w-[3px] self-center rounded-full bg-[hsl(var(--tilo))]" />
            <span>{p("title")}</span>
            <span className="tabular-nums font-semibold" data-testid="project-number">{project.projectNumber}</span>
            {project.dossierNumber && (
              <span className="font-normal text-muted-foreground" data-testid="dossier-number" data-dossier-number={project.dossierNumber}>
                {project.dossierNumber}
              </span>
            )}
            {text(project.customerName) && <span className="font-normal" data-testid="project-customer-name">{project.customerName}</span>}
          </h1>
          <span className="ml-auto inline-flex items-center rounded-full bg-[hsl(183_40%_94%)] px-2.5 py-0.5 text-xs font-medium text-[hsl(190_28%_24%)]" data-testid="project-status">
            {status}
          </span>
        </div>
        <dl className="tilo-cells grid-cols-2 border-t border-[hsl(215_14%_84%)] lg:grid-cols-4">
          <TextCell label={t("seller")} field="header-seller" value={project.seller} />
          <TextCell label={p("projectLeader")} field="header-project-leader" value={null} />
          <TextCell label={p("type")} field="header-type" value={group} />
          <TextCell label={t("name")} field="header-name" value={project.name} />
        </dl>
      </header>

      <ProjectTabPanels
        label={p("title")}
        tabs={[
          {
            id: "algemeen",
            label: p("tabs.algemeen"),
            content: (
              <div className="space-y-3">
                <SpecGrid project={project} group={group} customerName={customerName} t={t} p={p} />
                <Flags p={p} />
                <div className="grid items-start gap-3 lg:grid-cols-2">
                  <AddressLines
                    title={p("customerAddress")}
                    testId="customer-address"
                    lines={[
                      { label: t("address"), field: "customer-street", node: streetLink(customer) ?? undefined, value: customer.street },
                      { label: t("postalCode"), field: "customer-postal", value: customer.postalCode },
                      { label: t("city"), field: "customer-city", value: customer.city },
                      { label: t("country"), field: "customer-country", value: customer.country },
                      { label: t("phone"), field: "customer-phone", value: customer.phone },
                      { label: t("gsm"), field: "customer-mobile", value: customer.mobile },
                    ]}
                  />
                  <AddressLines
                    title={t("siteAddress")}
                    testId="site-address"
                    lines={[
                      { label: p("siteName"), field: "site-name", value: null },
                      { label: t("address"), field: "site-street", value: project.siteStreet, node: streetLink(site) ?? undefined },
                      { label: t("postalCode"), field: "site-postal", value: project.sitePostalCode },
                      { label: t("city"), field: "site-city", value: project.siteCity },
                      { label: t("country"), field: "site-country", value: project.siteCountry },
                      { label: p("distanceKm"), field: "distance-km", value: null },
                      { label: p("travelMinutes"), field: "travel-minutes", value: null },
                    ]}
                  />
                </div>
                <div className="grid items-start gap-3 lg:grid-cols-3">
                  <Remark title={p("remarkProject")} field="remark-project" value={project.projectNotes} />
                  <Remark title={p("remarkInstallers")} field="remark-installers" />
                  <Remark title={p("remarkGlass")} field="remark-glass" />
                </div>
              </div>
            ),
          },
          {
            id: "planning",
            label: p("tabs.planning"),
            content: <Remark title={p("remarkPlanning")} field="remark-planning" />,
          },
          {
            id: "facturatie",
            label: p("tabs.facturatie"),
            content: (
              <div className="grid items-start gap-3 lg:grid-cols-2">
                <AddressLines
                  title={p("billingAddress")}
                  testId="billing-address"
                  lines={[
                    { label: t("name"), field: "billing-name", value: billing.name },
                    { label: t("address"), field: "billing-street", node: streetLink(billing) ?? undefined, value: billing.street },
                    { label: t("postalCode"), field: "billing-postal", value: billing.postalCode },
                    { label: t("city"), field: "billing-city", value: billing.city },
                    { label: t("country"), field: "billing-country", value: billing.country },
                  ]}
                />
                <Remark title={p("remarkInvoice")} field="remark-invoice" />
              </div>
            ),
          },
          {
            id: "doc",
            label: p("tabs.orders"),
            content: (
              <section className="tilo-frame p-3" data-testid="other-parties">
                <BlockTitle>{p("otherParties")}</BlockTitle>
                <dl className="space-y-1">
                  <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-2" data-field="contractor" data-empty="true">
                    <dt className="text-[11px] text-muted-foreground">{p("contractor")}</dt>
                    <dd className="text-[13px] text-muted-foreground">—</dd>
                  </div>
                  <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-2" data-field="architect" data-empty={architect ? "false" : "true"}>
                    <dt className="text-[11px] text-muted-foreground">{t("architect")}</dt>
                    <dd className="text-[13px]">{architect || "—"}</dd>
                  </div>
                </dl>
              </section>
            ),
          },
          {
            id: "bestanden",
            label: p("tabs.files"),
            content: (
              <section className="tilo-frame p-3" data-testid="project-files">
                <BlockTitle>{p("files")}</BlockTitle>
                {project.documents.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">{t("noDocuments")}</p>
                ) : (
                  <ul className="tilo-rows text-[13px]">
                    {project.documents.map((document) => (
                      <li key={document.id} className="flex items-baseline justify-between gap-3 py-1.5" data-file={document.name}>
                        {document.name.toLowerCase().endsWith(".tc-raam") ? (
                          <Link href={`/crm/raamstudio?dossier=${project.id}`} className="min-w-0 break-all underline">
                            {document.name}
                          </Link>
                        ) : (
                          <OpenStoredFile kind="document" id={document.id} name={document.name} className="min-w-0 break-all underline">
                            {document.name}
                          </OpenStoredFile>
                        )}
                        {document.category && t.has(`folders.${document.category}`) && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">{t(`folders.${document.category}`)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ),
          },
          {
            id: "dnv",
            label: p("tabs.dnv"),
            content: <Remark title={p("remarkDnv")} field="remark-dnv" />,
          },
          {
            id: "afwijkingen",
            label: p("tabs.deviations"),
            content: <EmptyBlock title={p("tabs.deviations")} testId="project-deviations" />,
          },
          {
            id: "comm",
            label: p("tabs.mail"),
            content: <FollowUps events={project.followUps} nextStep={project.nextStep} t={t} />,
          },
          {
            id: "contact",
            label: p("tabs.contact"),
            content: (
              <section className="tilo-frame" data-testid="project-contact">
                <dl className="tilo-cells grid-cols-2 lg:grid-cols-4">
                  <TextCell label={t("email")} field="customer-email" value={customer.email} />
                  <TextCell label={t("vatNumber")} field="customer-vat" value={customer.vat} />
                  <TextCell label={t("vat")} field="customer-vat-choice" value={vatChoice} />
                  <TextCell label={t("contactType")} field="customer-role" value={role} />
                </dl>
              </section>
            ),
          },
          {
            id: "subprojecten",
            label: p("tabs.subprojects"),
            content: <EmptyBlock title={p("tabs.subprojects")} testId="project-subprojects" />,
          },
          {
            id: "taken",
            label: p("tabs.tasks"),
            content: <EmptyBlock title={p("tabs.tasks")} testId="project-tasks" />,
          },
          {
            id: "inhoud",
            label: p("tabs.content"),
            content: (
              <section className="tilo-frame p-3" data-testid="project-quotes">
                <BlockTitle>{t("quotes")}</BlockTitle>
                {project.quotes.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">{t("noQuotes")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="tilo-grid w-full text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] font-medium text-muted-foreground">
                          <th className="py-1.5 font-medium">{t("quote")}</th>
                          <th className="py-1.5 font-medium">{t("date")}</th>
                          <th className="py-1.5 font-medium">{t("grossTotal")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.quotes.map((quote) => (
                          <tr key={quote.id} data-quote-name={quote.name}>
                            <td className="py-1.5 pr-3">
                              <OpenStoredFile kind="document" id={quote.pdfId} name={quote.name} mimeType="application/pdf" className="underline break-all">
                                {quote.name}
                              </OpenStoredFile>
                              {quote.won && <span className="ml-2 text-[11px] font-medium">{t("won")}</span>}
                            </td>
                            <td className="whitespace-nowrap py-1.5 pr-3">{text(quote.date) || "—"}</td>
                            <td className="whitespace-nowrap py-1.5 tabular-nums" data-quote-gross={quote.id} data-total-bruto={quote.gross ?? ""}>
                              {quote.gross == null ? t("noPrice") : euro(quote.gross)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ),
          },
        ]}
      />
    </div>
  );
}
