"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Link } from "@/i18n/navigation";
import { Account } from "../table-data/schema";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import { ACCOUNT_ROLE_LABELS, vatChoiceLabel, type AccountRole } from "@/lib/sales/aanvraag-fields";

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

function roleLabel(value: string | null | undefined) {
  if (value && value in ACCOUNT_ROLE_LABELS) return ACCOUNT_ROLE_LABELS[value as AccountRole];
  return "—";
}

export const columns: ColumnDef<CustomerRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Naam" />,
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
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contacttype" />,
    cell: ({ row }) => roleLabel(row.original.account_role),
  },
  {
    accessorKey: "office_phone",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Telefoon" />,
    cell: ({ row }) => text(row.original.office_phone),
  },
  {
    accessorKey: "mobile_phone",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Gsm" />,
    cell: ({ row }) => text(row.original.mobile_phone),
  },
  {
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} title="E-mail" />,
    cell: ({ row }) => text(row.original.email),
  },
  {
    accessorKey: "vat_choice",
    header: ({ column }) => <DataTableColumnHeader column={column} title="BTW" />,
    cell: ({ row }) => text(vatChoiceLabel(row.original.vat_choice)),
  },
  {
    accessorKey: "vat",
    header: ({ column }) => <DataTableColumnHeader column={column} title="BTW-nummer" />,
    cell: ({ row }) => text(row.original.vat),
  },
  {
    id: "address",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Adres" />,
    cell: ({ row }) => text([row.original.billing_street, row.original.billing_postal_code, row.original.billing_city].filter(Boolean).join(", ")),
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
