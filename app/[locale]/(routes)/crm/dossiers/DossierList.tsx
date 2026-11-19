"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CrmListTable } from "@/components/crm/CrmListTable";
import { dossierMatchesSearch, type DossierSearchRow } from "./dossier-search";
import { columns } from "./columns";

export function DossierList({ rows }: { rows: DossierSearchRow[] }) {
  const t = useTranslations("Sales");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between">
          <div>
            <CardTitle>{t("dossiers")}</CardTitle>
          </div>
          <div className="flex space-x-2">
            <Button size="sm" asChild>
              <Link href="/crm/aanvraag">{t("newRequestPlus")}</Link>
            </Button>
          </div>
        </div>
        <Separator />
      </CardHeader>
      <CardContent>
        <CrmListTable
          tableId="dossiers"
          columns={columns}
          data={rows}
          globalFilterFn={(row, _columnId, filterValue) => dossierMatchesSearch(row.original, filterValue)}
          searchTestId="dossiers-search"
          tableTestId="dossiers-table"
          emptyMessage={rows.length === 0 ? t("noDossiers") : t("noDossiersFound")}
        />
      </CardContent>
    </Card>
  );
}
