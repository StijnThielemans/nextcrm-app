"use client";

import { useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SELLERS } from "@/lib/sales/aanvraag-fields";
import type { PeriodPreset } from "@/lib/sales/dashboard-period";

const PERIODS: { id: PeriodPreset; label: string }[] = [
  { id: "vandaag", label: "Vandaag" },
  { id: "week", label: "Deze week" },
  { id: "maand", label: "Deze maand" },
  { id: "vorige-maand", label: "Vorige maand" },
  { id: "kwartaal", label: "Dit kwartaal" },
  { id: "jaar", label: "Dit jaar" },
  { id: "vorig-jaar", label: "Vorig jaar" },
  { id: "aangepast", label: "Aangepaste periode" },
];

export function DashboardFilters({
  preset,
  from,
  to,
  seller,
  canFilter,
}: {
  preset: PeriodPreset;
  from: string;
  to: string;
  seller: string;
  canFilter: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [van, setVan] = useState(from);
  const [tot, setTot] = useState(to);

  function go(next: { periode?: PeriodPreset; van?: string; tot?: string; verkoper?: string }) {
    const params = new URLSearchParams();
    const periode = next.periode ?? preset;
    if (periode !== "maand") params.set("periode", periode);
    if (periode === "aangepast") {
      const start = next.van ?? van;
      const end = next.tot ?? tot;
      if (start) params.set("van", start);
      if (end) params.set("tot", end);
    }
    const verkoper = next.verkoper === undefined ? seller : next.verkoper;
    if (canFilter && verkoper) params.set("verkoper", verkoper);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="dashboard-filters">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Periode">
        {PERIODS.map((period) => {
          const active = preset === period.id;
          return (
            <button
              key={period.id}
              type="button"
              aria-pressed={active}
              data-testid={`period-${period.id}`}
              className={`h-8 rounded-full px-3 text-xs ${active ? "bg-[hsl(var(--tilo))] text-[hsl(190_28%_14%)]" : "border border-border text-foreground hover:bg-accent"}`}
              onClick={() => go({ periode: period.id })}
            >
              {period.label}
            </button>
          );
        })}
      </div>
      {preset === "aangepast" && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            go({ periode: "aangepast", van, tot });
          }}
        >
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Van
            <input
              type="date"
              value={van}
              onChange={(event) => setVan(event.target.value)}
              className="h-8 rounded-full border border-border bg-transparent px-2 text-sm text-foreground"
              data-testid="period-from"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Tot
            <input
              type="date"
              value={tot}
              onChange={(event) => setTot(event.target.value)}
              className="h-8 rounded-full border border-border bg-transparent px-2 text-sm text-foreground"
              data-testid="period-to"
            />
          </label>
          <button type="submit" className="h-8 rounded-full border border-border px-3 text-xs">
            Toon
          </button>
        </form>
      )}
      {canFilter && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Verkoper
          <select
            value={seller}
            data-testid="seller-filter"
            className="h-8 rounded-full border border-border bg-transparent px-2 text-sm text-foreground"
            onChange={(event) => go({ verkoper: event.target.value })}
          >
            <option value="">Alle verkopers</option>
            {SELLERS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="geen">Geen verkoper</option>
          </select>
        </label>
      )}
    </div>
  );
}
