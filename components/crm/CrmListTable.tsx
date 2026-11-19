"use client";

import { useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, PanelTopClose, PanelTopOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/app/[locale]/(routes)/crm/accounts/table-components/data-table-pagination";
import { DataTableToolbar } from "@/app/[locale]/(routes)/crm/accounts/table-components/data-table-toolbar";
import { useTableLayout } from "@/components/crm/use-table-layout";
import type { TableId } from "@/lib/sales/table-layout";

function SortableHead({ id, children }: { id: string; children: React.ReactNode }) {
  const t = useTranslations("Sales");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <TableHead
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="relative z-10 cursor-grab text-muted-foreground"
          aria-label={t("moveColumn")}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        {children}
      </div>
    </TableHead>
  );
}

export function CrmListTable<TData>({
  tableId,
  columns,
  data,
  globalFilterFn,
  searchTestId,
  tableTestId,
  emptyMessage,
  actions,
}: {
  tableId: TableId;
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  globalFilterFn: (row: Row<TData>, columnId: string, filterValue: string) => boolean;
  searchTestId: string;
  tableTestId: string;
  emptyMessage: string;
  actions?: ReactNode;
}) {
  const layout = useTableLayout(tableId);
  const [rowSelection, setRowSelection] = useState({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [hide, setHide] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility: layout.columnVisibility,
      columnOrder: layout.columnOrder,
      rowSelection,
      columnFilters,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: layout.setColumnVisibility,
    onColumnOrderChange: layout.setColumnOrder,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => globalFilterFn(row, columnId, String(filterValue ?? "")),
    getColumnCanGlobalFilter: () => true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const order = table.getState().columnOrder.length ? table.getState().columnOrder : layout.columnOrder;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    layout.setColumnOrder(arrayMove(order, from, to));
  }

  const panelToggle = (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
      onClick={() => setHide((current) => !current)}
      aria-label={hide ? "Show table" : "Hide table"}
    >
      {hide ? <PanelTopOpen className="h-4 w-4" /> : <PanelTopClose className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="space-y-5">
      {hide ? (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>This content is hidden now.</span>
          {panelToggle}
        </div>
      ) : (
        <>
          <DataTableToolbar
            table={table}
            searchTestId={searchTestId}
            onResetColumns={layout.reset}
            actions={actions}
            trailing={panelToggle}
          />
          <div className="overflow-x-auto">
            <DndContext id={`${tableId}-columns`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <Table data-testid={tableTestId}>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      <SortableContext items={headerGroup.headers.map((header) => header.column.id)} strategy={horizontalListSortingStrategy}>
                        {headerGroup.headers.map((header) => (
                          <SortableHead key={header.id} id={header.column.id}>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </SortableHead>
                        ))}
                      </SortableContext>
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        data-testid={tableId === "dossiers" ? "dossier-row" : tableId === "quotes" ? "offerte-row" : undefined}
                        data-dossier-number={tableId === "dossiers" ? String((row.original as { number?: string | null }).number ?? "") : undefined}
                        data-offerte-name={tableId === "quotes" ? String((row.original as { name?: string }).name ?? "") : undefined}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="whitespace-nowrap px-3 py-3.5 text-[0.92rem]">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        {emptyMessage}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </DndContext>
          </div>
          <DataTablePagination table={table} />
        </>
      )}
    </div>
  );
}
