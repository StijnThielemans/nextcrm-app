"use client";

import { Column, ColumnDef } from "@tanstack/react-table";
import "@/components/crm/table-column-meta";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { stepMessageKey } from "@/lib/sales/step-text";
import { DataTableColumnHeader } from "../accounts/table-components/data-table-column-header";
import {
  dossierAddress,
  dossierArchitect,
  dossierContactType,
  dossierPriceRequestDate,
  dossierProjectGroup,
  dossierSiteAddress,
  dossierStatusText,
  type DossierSearchRow,
} from "./dossier-search";

function show(value: string) {
  return value || "—";
}

function SalesHeader({ column, label }: { column: Column<DossierSearchRow, unknown>; label: string }) {
  const t = useTranslations("Sales");
  return <DataTableColumnHeader column={column} title={t(label)} />;
}

function ContactTypeCell({ value }: { value: string | null | undefined }) {
  const t = useTranslations("Sales");
  if (value && t.has(`roles.${value}`)) return <>{t(`roles.${value}`)}</>;
  return <>{show(dossierContactType(value))}</>;
}

function ProjectGroupCell({ value }: { value: string | null | undefined }) {
  const t = useTranslations("Sales");
  if (value && t.has(`groups.${value}`)) return <>{t(`groups.${value}`)}</>;
  return <>{show(dossierProjectGroup(value))}</>;
}

function StatusCell({ row }: { row: DossierSearchRow }) {
  const t = useTranslations("Sales");
  const text = dossierStatusText(row);
  const key = stepMessageKey(text);
  const label = show(key && t.has(key) ? t(key) : text);
  return (
    <span className="inline-flex items-center rounded-full bg-[hsl(183_40%_94%)] px-2.5 py-0.5 text-xs font-medium text-[hsl(190_28%_24%)]">
      {label}
    </span>
  );
}

export const columns: ColumnDef<DossierSearchRow>[] = [
  {
    id: "number",
    accessorFn: (row) => row.number ?? "",
    header: ({ column }) => <SalesHeader column={column} label="offerteDossierNumber" />,
    cell: ({ row }) => (
      <Link className="font-medium underline-offset-4 hover:underline" href={`/crm/dossiers/${row.original.id}`}>
        {show(row.original.number?.trim() ?? "")}
      </Link>
    ),
    enableHiding: false,
    meta: { labelKey: "offerteDossierNumber" },
  },
  {
    id: "executionProjectNumber",
    accessorFn: (row) => row.executionProjectNumber ?? "",
    header: ({ column }) => <SalesHeader column={column} label="executionProjectNumber" />,
    enableHiding: false,
    cell: ({ row }) => (
      <span className="tabular-nums" data-testid="execution-project-number">
        {row.original.executionProjectNumber?.trim() ?? ""}
      </span>
    ),
    meta: { labelKey: "executionProjectNumber" },
  },
  {
    id: "name",
    accessorFn: (row) => row.name ?? "",
    header: ({ column }) => <SalesHeader column={column} label="projectDescription" />,
    cell: ({ row }) => show(row.original.name?.trim() ?? ""),
    meta: { labelKey: "projectDescription" },
  },
  {
    id: "customer",
    accessorFn: (row) => row.customer ?? "",
    header: ({ column }) => <SalesHeader column={column} label="customer" />,
    cell: ({ row }) => show(row.original.customer?.trim() ?? ""),
    meta: { labelKey: "customer" },
  },
  {
    id: "contactType",
    accessorFn: (row) => row.contactType ?? "",
    header: ({ column }) => <SalesHeader column={column} label="contactType" />,
    cell: ({ row }) => <ContactTypeCell value={row.original.contactType} />,
    meta: { labelKey: "contactType" },
  },
  {
    id: "email",
    accessorFn: (row) => row.email ?? "",
    header: ({ column }) => <SalesHeader column={column} label="email" />,
    cell: ({ row }) => show(row.original.email?.trim() ?? ""),
    meta: { labelKey: "email" },
  },
  {
    id: "phone",
    accessorFn: (row) => row.phone ?? "",
    header: ({ column }) => <SalesHeader column={column} label="phone" />,
    cell: ({ row }) => show(row.original.phone?.trim() ?? ""),
    meta: { labelKey: "phone" },
  },
  {
    id: "mobile",
    accessorFn: (row) => row.mobile ?? "",
    header: ({ column }) => <SalesHeader column={column} label="gsm" />,
    cell: ({ row }) => show(row.original.mobile?.trim() ?? ""),
    meta: { labelKey: "gsm" },
  },
  {
    id: "vat",
    accessorFn: (row) => row.vat ?? "",
    header: ({ column }) => <SalesHeader column={column} label="vat" />,
    cell: ({ row }) => show(row.original.vat?.trim() ?? ""),
    meta: { labelKey: "vat" },
  },
  {
    id: "address",
    accessorFn: (row) => dossierAddress(row),
    header: ({ column }) => <SalesHeader column={column} label="address" />,
    cell: ({ row }) => show(dossierAddress(row.original)),
    meta: { labelKey: "address" },
  },
  {
    id: "seller",
    accessorFn: (row) => row.seller ?? "",
    header: ({ column }) => <SalesHeader column={column} label="seller" />,
    cell: ({ row }) => show(row.original.seller?.trim() ?? ""),
    meta: { labelKey: "seller" },
  },
  {
    id: "architect",
    accessorFn: (row) => dossierArchitect(row),
    header: ({ column }) => <SalesHeader column={column} label="architect" />,
    cell: ({ row }) => show(dossierArchitect(row.original)),
    meta: { labelKey: "architect" },
  },
  {
    id: "projectGroup",
    accessorFn: (row) => row.projectGroup ?? "",
    header: ({ column }) => <SalesHeader column={column} label="projectGroup" />,
    cell: ({ row }) => <ProjectGroupCell value={row.original.projectGroup} />,
    meta: { labelKey: "projectGroup" },
  },
  {
    id: "priceRequestDate",
    accessorFn: (row) => dossierPriceRequestDate(row),
    header: ({ column }) => <SalesHeader column={column} label="priceRequestDate" />,
    cell: ({ row }) => show(dossierPriceRequestDate(row.original)),
    meta: { labelKey: "priceRequestDate" },
  },
  {
    id: "siteAddress",
    accessorFn: (row) => dossierSiteAddress(row),
    header: ({ column }) => <SalesHeader column={column} label="siteAddress" />,
    cell: ({ row }) => show(dossierSiteAddress(row.original)),
    meta: { labelKey: "siteAddress" },
  },
  {
    id: "status",
    accessorFn: (row) => dossierStatusText(row),
    header: ({ column }) => <SalesHeader column={column} label="status" />,
    cell: ({ row }) => <StatusCell row={row.original} />,
    meta: { labelKey: "status" },
  },
  {
    id: "followUp",
    accessorFn: (row) => row.followUpDate ?? "",
    header: ({ column }) => <SalesHeader column={column} label="followUp" />,
    cell: ({ row }) => show(row.original.followUpDate?.trim() ?? ""),
    meta: { labelKey: "followUp" },
  },
];
