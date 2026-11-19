import Container from "@/app/[locale]/(routes)/components/ui/Container";
import React from "react";
import { BasicView } from "./components/BasicView";
import { requireAuthenticated } from "@/lib/authz";
import { getAccountTabs, getAccountPanels } from "@/lib/plugins/slots";
import { PluginSlot } from "@/lib/plugins/ui/PluginSlot";
import { FindSimilarButton } from "@/components/crm/find-similar-button";

import { getAccount } from "@/actions/crm/get-account";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getContactsByAccountId } from "@/actions/crm/get-contacts-by-accountId";
import { getDocumentsByAccountId } from "@/actions/documents/get-documents-by-accountId";
import { getAccountsTasks } from "@/actions/crm/account/get-tasks";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import ContactsView from "../../components/ContactsView";
import DocumentsView from "../../components/DocumentsView";

import {
  Documents,
  crm_Accounts,
  crm_Accounts_Tasks,
  crm_Contacts,
} from "@prisma/client";

import AccountsTasksView from "./components/TasksView";
import { ActivitiesSection } from "./components/ActivitiesSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistoryTab } from "./components/HistoryTab";
import { listDossiersForAccount } from "@/lib/sales/service";
import { stepMessageKey } from "@/lib/sales/step-text";
import { recordRecentOpen } from "@/lib/sales/recent-opens";
import {
  serializeDecimals,
  serializeDecimalsList,
} from "@/lib/serialize-decimals";

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
  const contacts: crm_Contacts[] = serializeDecimalsList(
    await getContactsByAccountId(accountId)
  );
  const documents: Documents[] = serializeDecimalsList(
    await getDocumentsByAccountId(accountId)
  );
  const tasks: crm_Accounts_Tasks[] = serializeDecimalsList(
    await getAccountsTasks(accountId)
  );
  const dossiers = actorUser.role === "partner" ? [] : await listDossiersForAccount(actorUser, accountId);
  const crmData = await getAllCrmData();

  const sales = await getTranslations("Sales");
  if (!account) return <div>{sales("customerNotFound")}</div>;
  await recordRecentOpen(actorUser.id, "ACCOUNT", account.id);

  return (
    <Container
      title={sales("customerTitle", { name: account.name })}
      description={sales("customersDescription")}
    >
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{sales("overview")}</TabsTrigger>
          <TabsTrigger value="history">{sales("history")}</TabsTrigger>
          {await Promise.all(pluginTabs.map(async ({ plugin, tab }) => {
            const tp = await getTranslations(`plugins.${plugin.definition.id}` as never);
            return <TabsTrigger key={`${plugin.definition.id}:${tab.id}`} value={`plugin-${plugin.definition.id}-${tab.id}`}>{tp(tab.title as never)}</TabsTrigger>;
          }))}
        </TabsList>
        <TabsContent value="overview">
          <div className="space-y-5">
            <BasicView data={account} />
            {pluginPanels.map(({ plugin, panel }) => (
              <PluginSlot key={`${plugin.definition.id}:${panel.id}`} plugin={plugin} actor={actor} render={(ctx) => panel.component({ accountId: account.id, ctx })} />
            ))}
            <ActivitiesSection accountId={account.id} />
            <FindSimilarButton entityType="account" recordId={accountId} />
            <section className="overflow-hidden rounded-md border">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <h2 className="text-sm font-bold">{sales("dossiers")}</h2>
                <Link href="/crm/aanvraag" className="text-sm underline">{sales("newRequestPlus")}</Link>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{sales("number")}</th>
                    <th className="px-3 py-2 font-medium">{sales("name")}</th>
                    <th className="px-3 py-2 font-medium">{sales("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dossiers.map((row) => {
                    const stepKey = stepMessageKey(row.stepLabel);
                    return (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2.5">
                          <Link className="font-medium underline" href={`/crm/dossiers/${row.id}`}>{row.number}</Link>
                        </td>
                        <td className="px-3 py-2.5">{row.name}</td>
                        <td className="px-3 py-2.5">{stepKey ? sales(stepKey) : row.stepLabel}</td>
                      </tr>
                    );
                  })}
                  {dossiers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-3 text-muted-foreground">{sales("noDossiers")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
            <AccountsTasksView data={tasks} account={account} />
            <ContactsView data={contacts} crmData={crmData} accountId={accountId} />
            <DocumentsView data={documents} accountId={accountId} />
          </div>
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab accountId={accountId} />
        </TabsContent>
        {pluginTabs.map(({ plugin, tab }) => (
          <TabsContent key={`${plugin.definition.id}:${tab.id}`} value={`plugin-${plugin.definition.id}-${tab.id}`}>
            <PluginSlot plugin={plugin} actor={actor} render={(ctx) => tab.component({ accountId, ctx })} />
          </TabsContent>
        ))}
      </Tabs>
    </Container>
  );
};

export default AccountDetailPage;
