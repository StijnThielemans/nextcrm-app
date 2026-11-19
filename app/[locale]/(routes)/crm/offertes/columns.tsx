"use client";

import { Column, ColumnDef } from "@tanstack/react-table";
import "@/components/crm/table-column-meta";
import { useTranslations } from "next-intl";

import { documentFileRoute } from "@/lib/documents/file-key";
import { Link } from "@/i18n/navigation";
import { DataTableColumnHeader } from "../accounts/table-components/data-table-column-header";
import { MISSING_OFFERTE_PRICE, offertePriceLabel, type OfferteSearchRow } from "./offerte-search";

function show(value: string) {
  return value || "—";
}

function SalesHeader({ column, label }: { column: Column<OfferteSearchRow, unknown>; label: string }) {
  const t = useTranslations("Sales");
  return <DataTableColumnHeader column={column} title={t(label)} />;
}

function PriceCell({ gross }: { gross: number | null }) {
  const t = useTranslations("Sales");
  const label = offertePriceLabel(gross);
  return <span className="tabular-nums">{label === MISSING_OFFERTE_PRICE ? t("noPrice") : label}</span>;
}

function StatusCell({ status }: { status: string | null }) {
  const t = useTranslations("Sales");
  if (status && t.has(`dossierStatus.${status}`)) return <>{t(`dossierStatus.${status}`)}</>;
  return <>—</>;
}

function WonCell({ won }: { won: boolean }) {
  const t = useTranslations("Sales");
  return <>{won ? t("won") : "—"}</>;
}

export const columns: ColumnDef<OfferteSearchRow>[] = [
  {
    id: "name",
    accessorFn: (row) => row.name,
    header: ({ column }) => <SalesHeader column={column} label="quote" />,
    cell: ({ row }) => (
      <a className="underline" href={documentFileRoute(row.original.pdfId)}>
        {show(row.original.name)}
      </a>
    ),
    enableHiding: false,
    meta: { labelKey: "quote" },
  },
  {
    id: "gross",
    accessorFn: (row) => row.gross ?? 0,
    header: ({ column }) => <SalesHeader column={column} label="grossTotal" />,
    cell: ({ row }) => <PriceCell gross={row.original.gross} />,
    meta: { labelKey: "grossTotal" },
  },
  {
    id: "date",
    accessorFn: (row) => row.date,
    header: ({ column }) => <SalesHeader column={column} label="date" />,
    cell: ({ row }) => show(row.original.date),
    meta: { labelKey: "date" },
  },
  {
    id: "sent",
    accessorFn: (row) => row.sentAt ?? "",
    header: ({ column }) => <SalesHeader column={column} label="sent" />,
    cell: ({ row }) => show(row.original.sentAt ?? ""),
    meta: { labelKey: "sent" },
  },
  {
    id: "dossier",
    accessorFn: (row) => row.dossierNumber ?? "",
    header: ({ column }) => <SalesHeader column={column} label="dossier" />,
    cell: ({ row }) => (
      <Link className="underline" href={`/crm/dossiers/${row.original.dossierId}`}>
        {show(row.original.dossierNumber?.trim() ?? "")}
      </Link>
    ),
    meta: { labelKey: "dossier" },
  },
  {
    id: "project",
    accessorFn: (row) => row.dossierName ?? "",
    header: ({ column }) => <SalesHeader column={column} label="projectDescription" />,
    cell: ({ row }) => show(row.original.dossierName?.trim() ?? ""),
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
    id: "seller",
    accessorFn: (row) => row.seller ?? "",
    header: ({ column }) => <SalesHeader column={column} label="seller" />,
    cell: ({ row }) => show(row.original.seller?.trim() ?? ""),
    meta: { labelKey: "seller" },
  },
  {
    id: "status",
    accessorFn: (row) => row.status ?? "",
    header: ({ column }) => <SalesHeader column={column} label="status" />,
    cell: ({ row }) => <StatusCell status={row.original.status} />,
    meta: { labelKey: "status" },
  },
  {
    id: "won",
    accessorFn: (row) => (row.won ? "1" : ""),
    header: ({ column }) => <SalesHeader column={column} label="won" />,
    cell: ({ row }) => <WonCell won={row.original.won} />,
    meta: { labelKey: "won" },
  },
];
