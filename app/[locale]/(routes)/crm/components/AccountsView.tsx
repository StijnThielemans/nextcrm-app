"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between">
          <div>
            <CardTitle>
              <Link href="/crm/accounts" className="hover:underline">
                {sales("customers")}
              </Link>
            </CardTitle>
          </div>
          <div className="flex space-x-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm" aria-label={t("accounts.addNew")} data-testid="add-account-btn">+</Button>
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
          </div>
        </div>
        <Separator />
      </CardHeader>
      {!data ||
        (data.length === 0 ? (
          <CardContent>{t("accounts.empty")}</CardContent>
        ) : (
          <CardContent>
            <AccountDataTable
              data={data}
              columns={columns}
              industries={industries}
            />
          </CardContent>
        ))}
    </Card>
  );
};

export default AccountsView;
