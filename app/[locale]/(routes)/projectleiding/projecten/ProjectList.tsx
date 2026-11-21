"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { CrmListTable } from "@/components/crm/CrmListTable";
import type { ProjectListRow } from "@/lib/sales/projects";

function show(value: string | null | undefined) {
  return value?.trim() ? value : "—";
}

export function projectMatchesSearch(row: ProjectListRow, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.projectNumber, row.dossierNumber, row.name, row.customer, row.seller]
    .some((value) => (value ?? "").toLowerCase().includes(needle));
}

export function ProjectList({ rows }: { rows: ProjectListRow[] }) {
  const t = useTranslations("Sales");
  const columns: ColumnDef<ProjectListRow>[] = [
    {
      id: "projectNumber",
      accessorFn: (row) => row.projectNumber,
      header: t("executionProjectNumber"),
      cell: ({ row }) => (
        <Link className="font-medium underline-offset-4 hover:underline" href={`/projectleiding/projecten/${row.original.id}`}>
          {row.original.projectNumber}
        </Link>
      ),
      enableHiding: false,
    },
    {
      id: "dossierNumber",
      accessorFn: (row) => row.dossierNumber ?? "",
      header: t("projectNumber"),
      cell: ({ row }) => (
        <Link className="underline-offset-4 hover:underline" href={`/crm/dossiers/${row.original.id}`}>
          {show(row.original.dossierNumber)}
        </Link>
      ),
    },
    {
      id: "name",
      accessorFn: (row) => row.name ?? "",
      header: t("projectDescription"),
      cell: ({ row }) => show(row.original.name),
    },
    {
      id: "customer",
      accessorFn: (row) => row.customer ?? "",
      header: t("customer"),
      cell: ({ row }) => show(row.original.customer),
    },
    {
      id: "seller",
      accessorFn: (row) => row.seller ?? "",
      header: t("seller"),
      cell: ({ row }) => show(row.original.seller),
    },
  ];
  return (
    <CrmListTable
      tableId="projects"
      columns={columns}
      data={rows}
      title={t("projects")}
      globalFilterFn={(row, _columnId, filterValue) => projectMatchesSearch(row.original, filterValue)}
      searchTestId="projects-search"
      tableTestId="projects-table"
      emptyMessage={rows.length === 0 ? t("noProjects") : t("noProjectsFound")}
    />
  );
}
