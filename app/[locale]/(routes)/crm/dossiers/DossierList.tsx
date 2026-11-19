"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CrmListTable } from "@/components/crm/CrmListTable";
import { dossierMatchesSearch, type DossierSearchRow } from "./dossier-search";
import { columns } from "./columns";

export function DossierList({ rows }: { rows: DossierSearchRow[] }) {
  const t = useTranslations("Sales");

  return (
    <CrmListTable
      tableId="dossiers"
      columns={columns}
      data={rows}
      actions={
        <Button size="sm" className="h-8" asChild>
          <Link href="/crm/aanvraag">{t("newRequestPlus")}</Link>
        </Button>
      }
      globalFilterFn={(row, _columnId, filterValue) => dossierMatchesSearch(row.original, filterValue)}
      searchTestId="dossiers-search"
      tableTestId="dossiers-table"
      emptyMessage={rows.length === 0 ? t("noDossiers") : t("noDossiersFound")}
    />
  );
}
