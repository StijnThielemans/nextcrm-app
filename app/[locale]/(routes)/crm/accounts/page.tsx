import React, { Suspense } from "react";

import AccountsView from "../components/AccountsView";
import Container from "../../components/ui/Container";
import CrmAccountsSkeleton from "@/components/skeletons/crm-accounts-skeleton";
import { getAllCrmData } from "@/actions/crm/get-crm-data";
import { getAccounts } from "@/actions/crm/get-accounts";
const AccountsPage = async () => {
  const crmData = await getAllCrmData();
  const accounts = await getAccounts();

  return (
    <Container
      title="Klanten"
      description="Naam, contacttype, adres, telefoon, e-mail, belastingstarief en btw."
    >
      <Suspense fallback={<CrmAccountsSkeleton />}>
        <AccountsView crmData={crmData} data={accounts} />
      </Suspense>
    </Container>
  );
};

export default AccountsPage;
