"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { saveProjectboxAction } from "@/actions/crm/sales/actions";
import { PROJECT_LEADERS, type ProjectLeaderName, type ProjectboxRow } from "@/lib/sales/projectbox";

function show(value: string | null | undefined) {
  return value?.trim() ? value : "—";
}

export function ProjectboxList({ rows }: { rows: ProjectboxRow[] }) {
  const t = useTranslations("Sales");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [leaders, setLeaders] = useState<Record<string, ProjectLeaderName | null>>(
    () => Object.fromEntries(rows.map((row) => [row.id, row.projectLeader])),
  );

  function choose(row: ProjectboxRow, value: string) {
    const next = (PROJECT_LEADERS as readonly string[]).includes(value) ? (value as ProjectLeaderName) : null;
    setLeaders((current) => ({ ...current, [row.id]: next }));
    setError(null);
  }

  async function save(row: ProjectboxRow) {
    const next = leaders[row.id] ?? null;
    if (!next) return;
    setPendingId(row.id);
    setError(null);
    const saved = await saveProjectboxAction(row.id, next);
    setPendingId(null);
    if (saved.error) {
      setError(saved.error);
      return;
    }
    router.refresh();
  }

  if (rows.length === 0) {
    return <p className="tilo-frame px-4 py-6 text-sm text-muted-foreground" data-testid="projectbox-empty">{t("projectboxEmpty")}</p>;
  }

  return (
    <div className="tilo-frame overflow-x-auto" data-testid="projectbox">
      {error && <p className="px-4 pt-3 text-sm text-destructive" role="alert">{error}</p>}
      <table className="tilo-grid w-full min-w-[52rem] text-base md:min-w-0 md:text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-2 font-medium">{t("executionProjectNumber")}</th>
            <th className="px-4 py-2 font-medium">{t("projectNumber")}</th>
            <th className="px-4 py-2 font-medium">{t("projectDescription")}</th>
            <th className="px-4 py-2 font-medium">{t("customer")}</th>
            <th className="px-4 py-2 font-medium">{t("seller")}</th>
            <th className="px-4 py-2 font-medium">{t("projectScreen.projectLeader")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid="projectbox-row" data-project-number={row.projectNumber} data-dossier-number={row.dossierNumber ?? ""}>
              <td className="px-4 py-2">
                <Link className="tabular-nums font-medium underline-offset-4 hover:underline" href={`/projectleiding/projecten/${row.id}`}>
                  {row.projectNumber}
                </Link>
              </td>
              <td className="px-4 py-2">
                <Link className="underline-offset-4 hover:underline" href={`/crm/dossiers/${row.id}`}>
                  {show(row.dossierNumber)}
                </Link>
              </td>
              <td className="px-4 py-2">{show(row.name)}</td>
              <td className="px-4 py-2">{show(row.customer)}</td>
              <td className="px-4 py-2" data-testid="projectbox-seller">{show(row.seller)}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`leader-${row.id}`}>{t("projectScreen.projectLeader")}</label>
                  <select
                    id={`leader-${row.id}`}
                    className="h-11 max-w-full rounded-full border border-border bg-white px-3 text-base md:h-8 md:text-sm"
                    data-testid="projectbox-leader"
                    value={leaders[row.id] ?? ""}
                    disabled={pendingId === row.id}
                    onChange={(event) => {
                      choose(row, event.target.value);
                    }}
                  >
                    <option value="">{t("projectboxUnassigned")}</option>
                    {PROJECT_LEADERS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="h-11 shrink-0 rounded-full bg-[hsl(var(--tilo))] px-3 text-base font-medium text-[hsl(190_28%_14%)] disabled:opacity-50 md:h-8 md:text-sm"
                    data-testid="projectbox-save"
                    disabled={pendingId === row.id || !leaders[row.id]}
                    onClick={() => {
                      void save(row);
                    }}
                  >
                    {t("projectboxSave")}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
