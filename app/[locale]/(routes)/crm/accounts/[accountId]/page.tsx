import Container from "@/app/[locale]/(routes)/components/ui/Container";
import React from "react";
import { BasicView } from "./components/BasicView";
import { requireAuthenticated } from "@/lib/authz";
import { getAccountPanels, getAccountTabs } from "@/lib/plugins/slots";
import { PluginSlot } from "@/lib/plugins/ui/PluginSlot";

import { getAccount } from "@/actions/crm/get-account";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { crm_Accounts } from "@prisma/client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listDossiersForAccount } from "@/lib/sales/service";
import { stepMessageKey } from "@/lib/sales/step-text";
import { recordRecentOpen } from "@/lib/sales/recent-opens";
import { serializeDecimals } from "@/lib/serialize-decimals";

interface AccountDetailPageProps {
  params: Promise<{
    accountId: string;
  }>;
}

const AccountDetailPage = async (props: AccountDetailPageProps) => {
  const params = await props.params;
  const { accountId } = params;
  const actorUser = await requireAuthenticated({ partner: true });
  const actor = { type: "user" as const, userId: actorUser.id, role: actorUser.role };
  const [pluginTabs, pluginPanels] = await Promise.all([getAccountTabs(actorUser.role), getAccountPanels(actorUser.role)]);
  // getAccount includes opportunities, whose budget, expected_revenue, and
  // snapshot_rate are Prisma Decimals. Client views cannot receive those.
  const account: crm_Accounts | null = serializeDecimals(await getAccount(accountId));
  const dossiers = actorUser.role === "partner" ? [] : await listDossiersForAccount(actorUser, accountId);

  const sales = await getTranslations("Sales");
  if (!account) return <div>{sales("customerNotFound")}</div>;
  await recordRecentOpen(actorUser.id, "ACCOUNT", account.id);

  return (
    <Container bare>
      <div className="space-y-4">
        <BasicView data={account} />
        {pluginPanels.map(({ plugin, panel }) => (
          <PluginSlot key={`${plugin.definition.id}:${panel.id}`} plugin={plugin} actor={actor} render={(ctx) => panel.component({ accountId: account.id, ctx })} />
        ))}
        <section className="tilo-frame p-3 text-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
              {sales("dossiers")}
            </h2>
            <Link href="/crm/aanvraag" className="text-sm underline underline-offset-4">{sales("newRequestPlus")}</Link>
          </div>
          <table className="tilo-grid w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="py-2 font-medium">{sales("number")}</th>
                <th className="py-2 font-medium">{sales("name")}</th>
                <th className="py-2 font-medium">{sales("status")}</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((row) => {
                const stepKey = stepMessageKey(row.stepLabel);
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2.5">
                      <Link className="font-medium underline underline-offset-4" href={`/crm/dossiers/${row.id}`}>{row.number}</Link>
                    </td>
                    <td className="py-2.5">{row.name}</td>
                    <td className="py-2.5">{stepKey ? sales(stepKey) : row.stepLabel}</td>
                  </tr>
                );
              })}
              {dossiers.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-2.5 text-muted-foreground">{sales("noDossiers")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        {pluginTabs.length > 0 && (
          <Tabs defaultValue={`plugin-${pluginTabs[0].plugin.definition.id}-${pluginTabs[0].tab.id}`}>
            <TabsList>
              {await Promise.all(pluginTabs.map(async ({ plugin, tab }) => {
                const tp = await getTranslations(`plugins.${plugin.definition.id}` as never);
                return <TabsTrigger key={`${plugin.definition.id}:${tab.id}`} value={`plugin-${plugin.definition.id}-${tab.id}`}>{tp(tab.title as never)}</TabsTrigger>;
              }))}
            </TabsList>
            {pluginTabs.map(({ plugin, tab }) => (
              <TabsContent key={`${plugin.definition.id}:${tab.id}`} value={`plugin-${plugin.definition.id}-${tab.id}`}>
                <PluginSlot plugin={plugin} actor={actor} render={(ctx) => tab.component({ accountId, ctx })} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </Container>
  );
};

export default AccountDetailPage;
