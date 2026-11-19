import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAuthenticated } from "@/lib/authz";
import { DASHBOARD_STEPS } from "@/lib/sales/dossier-step";
import { euro, percentLabel } from "@/lib/sales/labels";
import { listRecentOpens } from "@/lib/sales/recent-opens";
import { getSalesDashboard, listSalesTasks, type SalesTaskLists } from "@/lib/sales/service";
import { NewCustomerButton } from "./NewCustomerButton";

export async function SalesHeaderActions() {
  const t = await getTranslations("Sales");
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/crm/aanvraag" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground">
        {t("newRequestPlus")}
      </Link>
      <NewCustomerButton
        label={`+ ${t("newCustomer")}`}
        title={t("newCustomer")}
        description={t("customerFieldsDescription")}
      />
      <Link href="/crm/dossiers" className="inline-flex h-9 items-center rounded-md border px-4 text-sm">
        {t("dossiers")}
      </Link>
    </div>
  );
}

export async function SalesDashboard() {
  const user = await requireAuthenticated();
  const t = await getTranslations("Sales");
  const [tiles, recent, tasks] = await Promise.all([getSalesDashboard(user), listRecentOpens(user), listSalesTasks(user)]);
  const taskColumns: { kind: keyof SalesTaskLists; title: string }[] = [
    { kind: "toMake", title: t("tasksToMake") },
    { kind: "inProgress", title: t("tasksInProgress") },
    { kind: "followUp", title: t("tasksFollowUp") },
  ];
  const cards = [
    [t("tiles.openDossiers"), String(tiles.openCount)],
    [t("tiles.toFollowUp"), String(tiles.followUpCount)],
    [t("tiles.newThisMonth"), String(tiles.newThisMonth)],
    [t("tiles.wonThisMonth"), String(tiles.wonCount)],
    [t("tiles.lostThisMonth"), String(tiles.lostCount)],
    [t("tiles.openSell"), euro(tiles.openSell)],
    [t("tiles.openMargin"), euro(tiles.openMargin)],
    [t("tiles.openMarginPercent"), percentLabel(tiles.openMarginPercent)],
    [t("tiles.wonSell"), euro(tiles.wonSell)],
    [t("tiles.wonMargin"), euro(tiles.wonMargin)],
    [t("tiles.lostSell"), euro(tiles.lostSell)],
  ];
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-px overflow-hidden rounded-md border bg-border">
        {cards.map(([label, value]) => (
          <div key={label} className="bg-background px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums leading-none">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-3" data-testid="sales-tasks">
        {taskColumns.map((column) => (
          <section key={column.kind} className="bg-background p-3" data-testid={`sales-task-${column.kind}`}>
            <h2 className="mb-2 text-sm font-bold">{column.title}</h2>
            {tasks[column.kind].length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tasksEmpty")}</p>
            ) : (
              <ul className="max-h-64 space-y-0.5 overflow-y-auto text-sm">
                {tasks[column.kind].map((task) => (
                  <li key={task.id}>
                    <Link
                      className="flex min-h-10 items-center rounded-sm px-1 hover:bg-muted/70"
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
        <section className="overflow-hidden rounded-md border">
          <h2 className="border-b bg-muted/50 px-3 py-2 text-sm font-bold">{t("recentCustomers")}</h2>
          {recent.customers.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">{t("nothingOpened")}</p>
          ) : (
            <ul className="text-sm">
              {recent.customers.map((customer) => (
                <li key={customer.id} className="border-b last:border-0">
                  <Link className="flex h-11 items-center px-3 hover:bg-muted/50" href={`/crm/accounts/${customer.id}`}>{customer.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="overflow-hidden rounded-md border">
          <h2 className="border-b bg-muted/50 px-3 py-2 text-sm font-bold">{t("recentDossiers")}</h2>
          {recent.dossiers.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">{t("nothingOpened")}</p>
          ) : (
            <ul className="text-sm">
              {recent.dossiers.map((dossier) => (
                <li key={dossier.id} className="border-b last:border-0">
                  <Link className="flex h-11 items-center px-3 hover:bg-muted/50" href={`/crm/dossiers/${dossier.id}`}>{dossier.label}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section>
        <h2 className="mb-2 text-sm font-bold">{t("byStatus")}</h2>
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3 xl:grid-cols-4">
          {DASHBOARD_STEPS.map((status) => (
            <li key={status} className="flex items-center justify-between gap-3 bg-background px-3 py-2 text-sm" data-testid={`dashboard-status-${status}`}>
              <span>{t(`steps.${status}`)}</span>
              <span className="tabular-nums font-semibold">{tiles.byStatus[status] ?? 0}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
