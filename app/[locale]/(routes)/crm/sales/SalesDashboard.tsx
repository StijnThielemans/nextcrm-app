import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAuthenticated } from "@/lib/authz";
import { DASHBOARD_STEPS } from "@/lib/sales/dossier-step";
import { euro, percentLabel } from "@/lib/sales/labels";
import { listRecentOpens } from "@/lib/sales/recent-opens";
import { getSalesDashboard, listSalesTasks, type SalesTaskLists } from "@/lib/sales/service";
import { NewCustomerButton } from "./NewCustomerButton";

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
    <div className="space-y-6">
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
      <div className="grid gap-3 lg:grid-cols-3" data-testid="sales-tasks">
        {taskColumns.map((column) => (
          <section key={column.kind} className="rounded-md border p-4" data-testid={`sales-task-${column.kind}`}>
            <h2 className="mb-2 text-lg font-semibold">{column.title}</h2>
            {tasks[column.kind].length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tasksEmpty")}</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                {tasks[column.kind].map((task) => (
                  <li key={task.id}>
                    <Link
                      className="underline"
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
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border p-4">
          <h2 className="mb-2 text-lg font-semibold">{t("recentCustomers")}</h2>
          {recent.customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("nothingOpened")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recent.customers.map((customer) => (
                <li key={customer.id}>
                  <Link className="underline" href={`/crm/accounts/${customer.id}`}>{customer.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-md border p-4">
          <h2 className="mb-2 text-lg font-semibold">{t("recentDossiers")}</h2>
          {recent.dossiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("nothingOpened")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recent.dossiers.map((dossier) => (
                <li key={dossier.id}>
                  <Link className="underline" href={`/crm/dossiers/${dossier.id}`}>{dossier.label}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-md border p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div>
        <h2 className="mb-2 text-lg font-semibold">{t("byStatus")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2 text-sm">
          {DASHBOARD_STEPS.map((status) => (
            <li key={status} className="flex justify-between rounded-md border px-3 py-2" data-testid={`dashboard-status-${status}`}>
              <span>{t(`steps.${status}`)}</span>
              <span>{tiles.byStatus[status] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
