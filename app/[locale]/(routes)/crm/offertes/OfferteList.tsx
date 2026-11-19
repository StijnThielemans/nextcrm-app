"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CrmListTable } from "@/components/crm/CrmListTable";
import { columns } from "./columns";
import { offerteMatchesSearch, type OfferteSearchRow } from "./offerte-search";

export function OfferteList({ rows }: { rows: OfferteSearchRow[] }) {
  const t = useTranslations("Sales");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{t("quotes")}</CardTitle>
        <Separator />
      </CardHeader>
      <CardContent>
        <CrmListTable
          tableId="quotes"
          columns={columns}
          data={rows}
          globalFilterFn={(row, _columnId, filterValue) => offerteMatchesSearch(row.original, filterValue)}
          searchTestId="offertes-search"
          tableTestId="offertes-table"
          emptyMessage={rows.length === 0 ? t("noQuotes") : t("noQuotesFound")}
        />
      </CardContent>
    </Card>
  );
}
