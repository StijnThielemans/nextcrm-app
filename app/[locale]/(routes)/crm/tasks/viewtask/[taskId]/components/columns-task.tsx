"use client";

import { ColumnDef } from "@tanstack/react-table";
import { OpenStoredFile } from "@/components/files/OpenStoredFile";

import { Badge } from "@/components/ui/badge";

import { labels } from "../data/data";
import { Task } from "../data/schema";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActionsTasks } from "./data-table-row-actions-tasks";

export const columnsTask: ColumnDef<Task>[] = [
  {
    accessorKey: "assigned_to_user",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assigned to" />
    ),

    cell: ({ row }) => (
      <div className="w-[150px]">
        {row.original.assigned_to_user?.name ?? "Unassigned"}
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "document_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Document name" />
    ),
    cell: ({ row }) => {
      const label = labels.find(
        (label) => label.value === row.original.document_name
      );

      return (
        <div className="flex space-x-2">
          {label && <Badge variant="outline">{label.label}</Badge>}
          <OpenStoredFile
            kind="document"
            id={row.original.id}
            name={row.original.document_name}
            mimeType={row.original.document_file_mimeType}
            className="max-w-[500px] truncate font-medium underline"
          >
            {row.original.document_name}
          </OpenStoredFile>
        </div>
      );
    },
  },

  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActionsTasks row={row} />,
  },
];
