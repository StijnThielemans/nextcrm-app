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
  title?: string;
  searchTestId?: string;
  onResetColumns?: () => void;
  actions?: ReactNode;
  trailing?: ReactNode;
}

export function ListPageTitle({ title }: { title: string }) {
  return (
    <h2 className="flex shrink-0 items-center gap-2 text-base font-medium leading-none tracking-[-0.02em]">
      <span aria-hidden className="h-4 w-[3px] shrink-0 rounded-full bg-[hsl(var(--tilo))]" />
      {title}
    </h2>
  );
}

export function DataTableToolbar<TData>({
  table,
  title,
  searchTestId = "accounts-search",
  onResetColumns,
  actions,
  trailing,
}: DataTableToolbarProps<TData>) {
  const t = useTranslations("Sales");
  const globalFilter = (table.getState().globalFilter as string) ?? "";
  const isFiltered = table.getState().columnFilters.length > 0 || globalFilter.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {title ? <ListPageTitle title={title} /> : null}
      <div className="flex w-full items-center gap-2 md:w-auto md:shrink-0">
        <Input
          placeholder={t("search")}
          value={globalFilter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
          className="h-11 w-full min-w-0 rounded-full bg-[hsl(var(--canvas))] px-3 text-base sm:w-64 md:h-8 md:w-52 md:text-xs"
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
            className="h-8 px-2 text-xs lg:px-3"
          >
            Reset
            <Cross2Icon className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {actions}
        {onResetColumns && (
          <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs font-normal" data-testid="reset-columns" onClick={onResetColumns}>
            {t("resetColumns")}
          </Button>
        )}
        <DataTableViewOptions table={table} />
        {trailing}
      </div>
    </div>
  );
}
