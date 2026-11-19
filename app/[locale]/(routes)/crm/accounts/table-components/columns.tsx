"use client";

import { Column, ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Account } from "../table-data/schema";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";

type CustomerRow = Account & {
  account_role?: string | null;
  office_phone?: string | null;
  mobile_phone?: string | null;
  email?: string | null;
  vat?: string | null;
  vat_choice?: string | null;
  billing_street?: string | null;
  billing_postal_code?: string | null;
  billing_city?: string | null;
};

function text(value: string | null | undefined) {
  return value?.trim() ? value : "—";
}

function SalesHeader({ column, label }: { column: Column<CustomerRow, unknown>; label: string }) {
  const t = useTranslations("Sales");
  return <DataTableColumnHeader column={column} title={t(label)} />;
}

function RoleCell({ value }: { value: string | null | undefined }) {
  const t = useTranslations("Sales");
  if (value && t.has(`roles.${value}`)) return <>{t(`roles.${value}`)}</>;
  return <>—</>;
}

function VatCell({ value }: { value: string | null | undefined }) {
  const t = useTranslations("Sales");
  if (value && t.has(`vatChoice.${value}`)) return <>{t(`vatChoice.${value}`)}</>;
  return <>—</>;
}

export const columns: ColumnDef<CustomerRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SalesHeader column={column} label="name" />,
    cell: ({ row }) => (
      <Link href={`/crm/accounts/${row.original.id}`} data-testid="account-row-name" className="font-medium">
        {row.original.name}
      </Link>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "account_role",
    header: ({ column }) => <SalesHeader column={column} label="contactType" />,
    cell: ({ row }) => <RoleCell value={row.original.account_role} />,
  },
  {
    accessorKey: "office_phone",
    header: ({ column }) => <SalesHeader column={column} label="phone" />,
    cell: ({ row }) => text(row.original.office_phone),
  },
  {
    accessorKey: "mobile_phone",
    header: ({ column }) => <SalesHeader column={column} label="gsm" />,
    cell: ({ row }) => text(row.original.mobile_phone),
  },
  {
    accessorKey: "email",
    header: ({ column }) => <SalesHeader column={column} label="email" />,
    cell: ({ row }) => text(row.original.email),
  },
  {
    accessorKey: "vat_choice",
    header: ({ column }) => <SalesHeader column={column} label="vat" />,
    cell: ({ row }) => <VatCell value={row.original.vat_choice} />,
  },
  {
    accessorKey: "vat",
    header: ({ column }) => <SalesHeader column={column} label="vatNumber" />,
    cell: ({ row }) => text(row.original.vat),
  },
  {
    id: "address",
    header: ({ column }) => <SalesHeader column={column} label="address" />,
    cell: ({ row }) => text([row.original.billing_street, row.original.billing_postal_code, row.original.billing_city].filter(Boolean).join(", ")),
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
