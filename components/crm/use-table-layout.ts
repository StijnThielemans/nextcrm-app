"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OnChangeFn, Updater, VisibilityState } from "@tanstack/react-table";
import { loadTableLayout, saveTableLayout } from "@/actions/crm/table-layout";
import { TABLE_COLUMNS, type TableId } from "@/lib/sales/table-layout";

function apply<T>(updater: Updater<T>, previous: T): T {
  return typeof updater === "function" ? (updater as (old: T) => T)(previous) : updater;
}

function hiddenFrom(visibility: VisibilityState) {
  return Object.entries(visibility)
    .filter(([, visible]) => visible === false)
    .map(([id]) => id);
}

export function useTableLayout(tableId: TableId) {
  const defaults = TABLE_COLUMNS[tableId];
  const [columnOrder, setOrder] = useState<string[]>([...defaults]);
  const [columnVisibility, setVisibility] = useState<VisibilityState>({});
  const orderRef = useRef(columnOrder);
  const visibilityRef = useRef(columnVisibility);
  const ready = useRef(false);

  useEffect(() => {
    let cancel = false;
    ready.current = false;
    void loadTableLayout(tableId).then((saved) => {
      if (cancel) return;
      const order = saved?.order ?? [...defaults];
      const visibility: VisibilityState = {};
      for (const id of saved?.hidden ?? []) visibility[id] = false;
      orderRef.current = order;
      visibilityRef.current = visibility;
      setOrder(order);
      setVisibility(visibility);
      ready.current = true;
    });
    return () => {
      cancel = true;
    };
  }, [defaults, tableId]);

  const persist = useCallback(
    (order: string[], visibility: VisibilityState) => {
      if (!ready.current) return;
      void saveTableLayout(tableId, { order, hidden: hiddenFrom(visibility) });
    },
    [tableId],
  );

  const setColumnOrder: OnChangeFn<string[]> = useCallback(
    (updater) => {
      const next = apply(updater, orderRef.current);
      orderRef.current = next;
      setOrder(next);
      persist(next, visibilityRef.current);
    },
    [persist],
  );

  const setColumnVisibility: OnChangeFn<VisibilityState> = useCallback(
    (updater) => {
      const next = apply(updater, visibilityRef.current);
      visibilityRef.current = next;
      setVisibility(next);
      persist(orderRef.current, next);
    },
    [persist],
  );

  const reset = useCallback(() => {
    const order = [...defaults];
    orderRef.current = order;
    visibilityRef.current = {};
    setOrder(order);
    setVisibility({});
    if (ready.current) void saveTableLayout(tableId, null);
  }, [defaults, tableId]);

  return { columnOrder, columnVisibility, setColumnOrder, setColumnVisibility, reset };
}
