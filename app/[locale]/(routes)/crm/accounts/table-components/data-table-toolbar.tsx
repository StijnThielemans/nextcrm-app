"use client";

import type { ReactNode } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { DataTableViewOptions } from "./data-table-view-options";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchTestId?: string;
  onResetColumns?: () => void;
  actions?: ReactNode;
  trailing?: ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  searchTestId = "accounts-search",
  onResetColumns,
  actions,
  trailing,
}: DataTableToolbarProps<TData>) {
  const t = useTranslations("Sales");
  const globalFilter = (table.getState().globalFilter as string) ?? "";
  const isFiltered = table.getState().columnFilters.length > 0 || globalFilter.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder={t("search")}
          value={globalFilter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
          className="h-8 w-full max-w-md"
          data-testid={searchTestId}
        />
        {/*         <Input
          placeholder="Filter by assigned user ..."
          value={
            (table.getColumn("assigned_to_user")?.getFilterValue() as string) ??
            ""
          }
          onChange={(event) =>
            table
              .getColumn("assigned_to_user")
              ?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        /> */}
        {/*        {table.getColumn("priority") && (
          <DataTableFacetedFilter
            column={table.getColumn("priority")}
            title="Priority"
            options={priorities}
          />
        )} */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              table.setGlobalFilter("");
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onResetColumns && (
          <Button variant="outline" size="sm" className="h-8" data-testid="reset-columns" onClick={onResetColumns}>
            {t("resetColumns")}
          </Button>
        )}
        <DataTableViewOptions table={table} />
        {trailing}
      </div>
    </div>
  );
}
