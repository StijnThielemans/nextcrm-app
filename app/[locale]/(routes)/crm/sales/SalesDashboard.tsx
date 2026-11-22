import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAuthenticated } from "@/lib/authz";
import { sellerFilterParam, type AmountStat, type CountStat } from "@/lib/sales/dashboard-view";
import { euro } from "@/lib/sales/labels";
import { listRecentOpens } from "@/lib/sales/recent-opens";
import { getSalesDashboardView, listSalesTasks, type SalesTaskLists } from "@/lib/sales/service";
import { DashboardFilters } from "./DashboardFilters";
import { NewCustomerButton } from "./NewCustomerButton";
import { RevenueChart } from "./SalesCharts";

export async function SalesHeaderActions() {
  const t = await getTranslations("Sales");
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/crm/aanvraag" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm text-primary-foreground">
        {t("newRequestPlus")}
      </Link>
      <NewCustomerButton
        label={`+ ${t("newCustomer")}`}
        title={t("newCustomer")}
        description={t("customerFieldsDescription")}
      />
      <Link href="/crm/dossiers" className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm">
        {t("dossiers")}
      </Link>
    </div>
  );
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function dayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function signedPct(value: number | null): string | null {
  if (value == null) return null;
  const text = new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(value);
  return `${text} %`;
}

function moneyCompare(stat: AmountStat): string {
  const previous = stat.previousAmount == null ? "geen" : euro(stat.previousAmount);
  const delta = signedPct(stat.delta);
  return delta ? `Vorige periode: ${previous} (${delta})` : `Vorige periode: ${previous}`;
}

function countCompare(stat: CountStat): string {
  const delta = signedPct(stat.delta);
  return delta ? `Vorige periode: ${stat.previousCount} (${delta})` : `Vorige periode: ${stat.previousCount}`;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
      <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
      {children}
    </h2>
  );
}

function Kpi({
  testId,
  label,
  value,
  detail,
  compare,
}: {
  testId: string;
  label: string;
  value: string;
  detail: string;
  compare: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5" data-testid={testId}>
      <dt className="text-[0.72rem] text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 text-[1.45rem] font-medium tabular-nums leading-none tracking-tight">{value}</dd>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">{detail}</p>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">{compare}</p>
    </div>
  );
}

function amountValue(stat: AmountStat): string {
  if (stat.amount != null) return euro(stat.amount);
  if (stat.count === 0) return "—";
  return "geen prijs";
}

function unpricedNote(count: number): string {
  if (count <= 0) return "";
  return count === 1 ? " · 1 zonder totaal bruto" : ` · ${count} zonder totaal bruto`;
}

const MEDALS = ["#c6a15b", "#9aa3ad", "#a97142"];

export async function SalesDashboard({
  query = {},
}: {
  query?: Record<string, string | string[] | undefined>;
}) {
  const user = await requireAuthenticated();
  const t = await getTranslations("Sales");
  const periode = one(query.periode);
  const van = one(query.van);
  const tot = one(query.tot);
  const verkoper = one(query.verkoper);
  const [model, recent, tasks] = await Promise.all([
    getSalesDashboardView(user, { periode, van, tot, verkoper }),
    listRecentOpens(user),
    listSalesTasks(user),
  ]);
  const selectedSeller = sellerFilterParam(user, verkoper);
  const taskColumns: { kind: keyof SalesTaskLists; title: string }[] = [
    { kind: "toMake", title: t("tasksToMake") },
    { kind: "inProgress", title: t("tasksInProgress") },
    { kind: "followUp", title: t("tasksFollowUp") },
  ];
  const maxOutcome = Math.max(model.wonLost.wonCount, model.wonLost.lostCount, 1);

  return (
    <div className="space-y-4" data-testid="sales-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DashboardFilters
          preset={model.preset}
          from={model.preset === "aangepast" ? model.start : (van ?? model.start)}
          to={model.preset === "aangepast" ? model.end : (tot ?? model.end)}
          seller={selectedSeller === "none" ? "geen" : (selectedSeller ?? "")}
          canFilter={model.canSeeOthers}
        />
        <p className="text-xs text-muted-foreground" data-testid="dashboard-range">
          {dayLabel(model.start)} – {dayLabel(model.end)}
          <span className="mx-1.5">·</span>
          {model.amountLabel}
        </p>
      </div>

      <dl className="tilo-frame tilo-cells grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" data-testid="dashboard-kpis">
        <Kpi
          testId="kpi-sold"
          label="Gewonnen omzet"
          value={amountValue(model.sold)}
          detail={
            model.sold.count === 0
              ? "Geen gewonnen dossiers"
              : `${model.sold.count} gewonnen ${model.sold.count === 1 ? "dossier" : "dossiers"}${unpricedNote(model.sold.unpriced)}`
          }
          compare={moneyCompare(model.sold)}
        />
        <Kpi
          testId="kpi-open"
          label="Open offertes"
          value={amountValue(model.open)}
          detail={
            model.open.count === 0
              ? "Geen offerte verstuurd in deze periode die nog openstaat"
              : `${model.open.count} verstuurd en nog open${unpricedNote(model.open.unpriced)}`
          }
          compare={moneyCompare(model.open)}
        />
        <Kpi
          testId="kpi-won"
          label="Gewonnen dossiers"
          value={String(model.won.count)}
          detail="Dossiers op gewonnen gezet"
          compare={countCompare(model.won)}
        />
        <Kpi
          testId="kpi-conversion"
          label="Conversie"
          value={model.conversion.percent == null ? "—" : `${new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 1 }).format(model.conversion.percent)} %`}
          detail={
            model.conversion.closed === 0
              ? "Geen afgesloten dossiers"
              : `${model.conversion.won} van ${model.conversion.closed} afgesloten (gewonnen + verloren)`
          }
          compare={
            model.conversion.previousClosed === 0 || model.conversion.previousPercent == null
              ? "Vorige periode: geen afgesloten dossiers"
              : `Vorige periode: ${new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 1 }).format(model.conversion.previousPercent)} %`
          }
        />
        <Kpi
          testId="kpi-average"
          label="Gemiddeld dossier"
          value={model.average.amount == null ? "—" : euro(model.average.amount)}
          detail={
            model.average.priced === 0
              ? "Geen gewonnen dossier met een totaal bruto"
              : `Op ${model.average.priced} ${model.average.priced === 1 ? "dossier" : "dossiers"} met een totaal bruto`
          }
          compare={
            model.average.previousAmount == null
              ? "Vorige periode: geen"
              : `Vorige periode: ${euro(model.average.previousAmount)}${signedPct(model.average.delta) ? ` (${signedPct(model.average.delta)})` : ""}`
          }
        />
        <Kpi
          testId="kpi-new"
          label="Nieuwe offertes"
          value={amountValue(model.fresh)}
          detail={
            model.fresh.count === 0
              ? "Geen nieuwe offerte in deze periode"
              : `${model.fresh.count} ${model.fresh.count === 1 ? "dossier met een actuele offerte" : "dossiers met een actuele offerte"}${unpricedNote(model.fresh.unpriced)}`
          }
          compare={moneyCompare(model.fresh)}
        />
      </dl>

      <section className="tilo-frame px-4 py-3" data-testid="dashboard-momentum">
        <SectionTitle>Wat de cijfers zeggen</SectionTitle>
        <ul className="space-y-1 text-sm">
          {model.momentum.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="tilo-frame p-4" data-testid="revenue-chart">
        <SectionTitle>Gewonnen omzet</SectionTitle>
        <p className="mb-3 text-xs text-muted-foreground">Som van het totaal bruto van de gewonnen offertes per dossier, op de dag dat het dossier gewonnen is.</p>
        {model.chart.empty ? (
          <p className="py-8 text-sm text-muted-foreground">Geen gewonnen omzet in deze periode.</p>
        ) : (
          <RevenueChart points={model.chart.points} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="tilo-frame p-4" data-testid="dashboard-ranking">
          <SectionTitle>Top verkopers</SectionTitle>
          {model.ranking.empty ? (
            <p className="py-3 text-sm text-muted-foreground">{model.ranking.empty}</p>
          ) : (
            <ol className="space-y-2">
              {model.ranking.rows.map((row, index) => (
                <li key={row.seller} className="flex items-center gap-3 text-sm" data-testid={`rank-${index + 1}`}>
                  <span
                    aria-hidden
                    className="inline-flex size-6 items-center justify-center rounded-full text-xs font-medium text-white"
                    style={{ background: MEDALS[index] ?? MEDALS[2] }}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row.seller}</span>
                  <span className="tabular-nums">{euro(row.amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="tilo-frame p-4" data-testid="dashboard-won-lost">
          <SectionTitle>Gewonnen en verloren</SectionTitle>
          {model.wonLost.wonCount === 0 && model.wonLost.lostCount === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Geen afgesloten dossiers in deze periode.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <Outcome label="Gewonnen" count={model.wonLost.wonCount} amount={model.wonLost.wonAmount} unpriced={model.wonLost.wonUnpriced} width={(model.wonLost.wonCount / maxOutcome) * 100} />
              <Outcome label="Verloren" count={model.wonLost.lostCount} amount={model.wonLost.lostAmount} unpriced={model.wonLost.lostUnpriced} width={(model.wonLost.lostCount / maxOutcome) * 100} />
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="tilo-frame p-4" data-testid="dashboard-record">
          <SectionTitle>Record</SectionTitle>
          {model.record ? (
            <p className="text-sm">
              Hoogste gewonnen dossier: <span className="tabular-nums font-medium">{euro(model.record.amount)}</span>
              {model.record.number ? ` · ${model.record.number}` : ""}
              {model.record.customer ? ` · ${model.record.customer}` : ""}
              {model.record.date ? ` · ${dayLabel(model.record.date)}` : ""}
            </p>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">{model.recordEmpty}</p>
          )}
        </section>
        <section className="tilo-frame p-4" data-testid="dashboard-region">
          <SectionTitle>Plaats</SectionTitle>
          <p className="mb-2 text-xs text-muted-foreground">Gemeente of postcode van het werfadres. Het bedrag is gewonnen totaal bruto.</p>
          {model.region.empty ? (
            <p className="py-3 text-sm text-muted-foreground">{model.region.empty}</p>
          ) : (
            <ul className="tilo-rows text-sm">
              {model.region.rows.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 py-2" data-testid={`region-${row.label}`}>
                  <span>{row.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.count} {row.count === 1 ? "dossier" : "dossiers"}
                    {row.wonAmount != null ? ` · ${euro(row.wonAmount)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="tilo-frame p-4" data-testid="dashboard-seller-bars">
        <SectionTitle>Omzet per verkoper</SectionTitle>
        {model.bars.empty ? (
          <p className="py-3 text-sm text-muted-foreground">{model.bars.empty}</p>
        ) : (
          <>
            {model.bars.mode === "self" && (
              <p className="mb-2 text-xs text-muted-foreground">Alleen jouw gewonnen omzet. Cijfers van andere verkopers staan hier niet.</p>
            )}
            <SellerBarList rows={model.bars.rows} />
          </>
        )}
      </section>

      <section className="tilo-frame p-4" data-testid="dashboard-follow-up">
        <SectionTitle>Op te volgen</SectionTitle>
        <p className="mb-2 text-xs text-muted-foreground">Open dossiers met een verstuurde offerte. Niet beperkt tot de gekozen periode.</p>
        {model.followUp.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">Geen open verstuurde offertes.</p>
        ) : (
          <ul className="tilo-rows text-sm">
            {model.followUp.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/crm/dossiers/${row.id}`}
                  className="grid gap-1 px-1 py-2.5 hover:text-[hsl(183_35%_28%)] sm:grid-cols-[1.1fr_1.4fr_auto_auto_auto_auto] sm:items-center sm:gap-3"
                  data-testid="follow-up-row"
                >
                  <span className="truncate">{row.customer}</span>
                  <span className="truncate">{row.number}</span>
                  <span className="tabular-nums">{row.amount == null ? "geen prijs" : euro(row.amount)}</span>
                  <span className="tabular-nums text-muted-foreground">{dayLabel(row.date)}</span>
                  <span className="tabular-nums text-muted-foreground">{row.daysOpen} d</span>
                  <span className="truncate text-muted-foreground">{row.seller?.trim() || "—"}</span>
                  {row.notes.length > 0 && <span className="text-xs text-muted-foreground sm:col-span-6">{row.notes.join(" ")}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3" data-testid="sales-tasks">
        {taskColumns.map((column) => (
          <section key={column.kind} className="tilo-frame min-w-0 p-4" data-testid={`sales-task-${column.kind}`}>
            <SectionTitle>{column.title}</SectionTitle>
            {tasks[column.kind].length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">{t("tasksEmpty")}</p>
            ) : (
              <ul className="tilo-rows max-h-72 overflow-y-auto text-sm">
                {tasks[column.kind].map((task) => (
                  <li key={task.id}>
                    <Link
                      className="flex min-h-11 items-center hover:text-[hsl(183_35%_28%)]"
                      href={task.href}
                      data-testid={task.request ? "sales-task-request" : "sales-task-row"}
                    >
                      {task.request
                        ? t("tasksDistributed", { sender: task.request.sender, subject: task.request.subject })
                        : task.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="tilo-frame p-4">
          <SectionTitle>{t("recentCustomers")}</SectionTitle>
          {recent.customers.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">{t("nothingOpened")}</p>
          ) : (
            <ul className="tilo-rows text-sm">
              {recent.customers.map((customer) => (
                <li key={customer.id}>
                  <Link className="flex h-12 items-center hover:text-[hsl(183_35%_28%)]" href={`/crm/accounts/${customer.id}`}>{customer.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="tilo-frame p-4">
          <SectionTitle>{t("recentDossiers")}</SectionTitle>
          {recent.dossiers.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">{t("nothingOpened")}</p>
          ) : (
            <ul className="tilo-rows text-sm">
              {recent.dossiers.map((dossier) => (
                <li key={dossier.id}>
                  <Link className="flex h-12 items-center hover:text-[hsl(183_35%_28%)]" href={`/crm/dossiers/${dossier.id}`}>{dossier.label}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SellerBarList({ rows }: { rows: { seller: string; amount: number }[] }) {
  const list = Array.isArray(rows) ? rows.filter((row) => row != null && Number.isFinite(row.amount)) : [];
  let max = 1;
  for (const row of list) if (row.amount > max) max = row.amount;
  return (
    <ul className="space-y-2.5">
      {list.map((row) => (
        <li key={row.seller} className="grid grid-cols-[9.5rem_1fr_auto] items-center gap-3 text-sm" data-testid="seller-bar">
          <span className="truncate">{row.seller}</span>
          <span className="h-2 overflow-hidden rounded-full bg-[hsl(215_16%_90%)] dark:bg-[hsl(210_8%_24%)]">
            <span
              className="block h-full rounded-full bg-[hsl(183_53%_36%)] dark:bg-[hsl(183_53%_68%)]"
              style={{ width: `${Math.max(4, (row.amount / max) * 100)}%` }}
            />
          </span>
          <span className="tabular-nums">{euro(row.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function Outcome({
  label,
  count,
  amount,
  unpriced,
  width,
}: {
  label: string;
  count: number;
  amount: number | null;
  unpriced: number;
  width: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span>{label}</span>
        <span className="tabular-nums">
          {count} {count === 1 ? "dossier" : "dossiers"}
          {amount != null ? ` · ${euro(amount)}` : ""}
          {unpriced > 0 ? (amount == null ? " · geen totaal bruto" : ` · ${unpriced} zonder totaal bruto`) : ""}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(215_16%_90%)] dark:bg-[hsl(210_8%_24%)]">
        <div className="h-full rounded-full bg-[hsl(var(--tilo))]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
