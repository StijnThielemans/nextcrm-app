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
import { ListPageTitle } from "../accounts/table-components/data-table-toolbar";

import type { getAllCrmData } from "@/actions/crm/get-crm-data";

type CrmData = Awaited<ReturnType<typeof getAllCrmData>>;

interface AccountsViewProps {
  data: any[];
  crmData: CrmData;
  title?: string;
}

const AccountsView = ({ data, crmData, title }: AccountsViewProps) => {
  const [open, setOpen] = useState(false);
  const t = useTranslations("CrmPage");
  const sales = useTranslations("Sales");

  const { industries } = crmData;

  const addButton = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="h-8 rounded-full px-3 text-xs" aria-label={t("accounts.addNew")} data-testid="add-account-btn">+ {sales("newCustomer")}</Button>
      </SheetTrigger>
      <SheetContent
        data-testid="new-customer-screen"
        className="!inset-0 !h-dvh !w-screen !max-w-none overflow-y-auto border-0 p-6 sm:!max-w-none sm:p-8"
      >
        <div className="mx-auto w-full max-w-5xl">
        <SheetHeader>
          <SheetTitle>{sales("newCustomer")}</SheetTitle>
          <SheetDescription>
            {sales("customerFieldsDescription")}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <NewAccountForm onFinish={() => setOpen(false)} />
        </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  if (!data || data.length === 0) {
    return (
      <div className="tilo-frame flex items-center gap-2 px-3 py-2">
        {title ? <ListPageTitle title={title} /> : null}
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{t("accounts.empty")}</p>
        {addButton}
      </div>
    );
  }

  return (
    <AccountDataTable
      data={data}
      columns={columns}
      industries={industries}
      title={title}
      actions={addButton}
    />
  );
};

export default AccountsView;
