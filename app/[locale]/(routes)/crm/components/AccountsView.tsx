"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";

import { columns } from "../accounts/table-components/columns";
import { NewAccountForm } from "../accounts/components/NewAccountForm";
import { AccountDataTable } from "../accounts/table-components/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

import type { getAllCrmData } from "@/actions/crm/get-crm-data";

type CrmData = Awaited<ReturnType<typeof getAllCrmData>>;

interface AccountsViewProps {
  data: any[];
  crmData: CrmData;
}

const AccountsView = ({ data, crmData }: AccountsViewProps) => {
  const [open, setOpen] = useState(false);
  const t = useTranslations("CrmPage");
  const sales = useTranslations("Sales");

  const { industries } = crmData;

  const addButton = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="h-8" aria-label={t("accounts.addNew")} data-testid="add-account-btn">+</Button>
      </SheetTrigger>
      <SheetContent
        data-testid="new-customer-screen"
        className="!inset-0 !h-dvh !w-screen !max-w-none overflow-y-auto border-0 p-8 sm:!max-w-none"
      >
        <SheetHeader>
          <SheetTitle>{sales("newCustomer")}</SheetTitle>
          <SheetDescription>
            {sales("customerFieldsDescription")}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-8">
          <NewAccountForm onFinish={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("accounts.empty")}</p>
        {addButton}
      </div>
    );
  }

  return (
    <AccountDataTable
      data={data}
      columns={columns}
      industries={industries}
      actions={addButton}
    />
  );
};

export default AccountsView;
