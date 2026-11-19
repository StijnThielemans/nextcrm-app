"use client";

import { ColumnDef, type Row } from "@tanstack/react-table";

import { CrmListTable } from "@/components/crm/CrmListTable";
import { accountMatchesSearch, type AccountSearchRow } from "./account-search";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  industries: any[];
}

export function AccountDataTable<TData, TValue>({
  columns,
  data,
  industries,
}: DataTableProps<TData, TValue>) {
  void industries;
  return (
    <CrmListTable
      tableId="customers"
      columns={columns as ColumnDef<TData, unknown>[]}
      data={data}
      globalFilterFn={(row: Row<TData>, _columnId, filterValue) =>
        accountMatchesSearch(row.original as AccountSearchRow, filterValue)
      }
      searchTestId="accounts-search"
      tableTestId="accounts-table"
      emptyMessage="No results."
    />
  );
}
