import React, { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import AccountsView from "../components/AccountsView";
import Container from "../../components/ui/Container";
import CrmAccountsSkeleton from "@/components/skeletons/crm-accounts-skeleton";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getAccounts } from "@/actions/crm/get-accounts";
const AccountsPage = async () => {
  const crmData = await getAllCrmData();
  const accounts = await getAccounts();
  const t = await getTranslations("Sales");

  return (
    <Container bare>
      <Suspense fallback={<CrmAccountsSkeleton />}>
        <AccountsView crmData={crmData} data={accounts} title={t("customers")} />
      </Suspense>
    </Container>
  );
};

export default AccountsPage;
