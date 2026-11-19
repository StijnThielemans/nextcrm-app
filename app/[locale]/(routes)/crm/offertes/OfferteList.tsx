"use client";

import { useMemo, useState } from "react";

import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import {
  offerteMatchesSearch,
  offertePriceLabel,
  offerteStatusText,
  offerteWonText,
  type OfferteSearchRow,
} from "./offerte-search";

const HEADERS = [
  "Offerte",
  "Totaal bruto",
  "Datum",
  "Verstuurd",
  "Dossier",
  "Projectbeschrijving",
  "Klant",
  "Verkoper",
  "Status",
  "Gewonnen",
] as const;

function show(value: string) {
  return value || "—";
}

export function OfferteList({ rows }: { rows: OfferteSearchRow[] }) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => rows.filter((row) => offerteMatchesSearch(row, query)), [rows, query]);

  return (
    <>
      <Input
        placeholder="Zoeken …"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mb-4 h-8 w-[150px] lg:w-[250px]"
        data-testid="offertes-search"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm" data-testid="offertes-table">
          <thead>
            <tr className="border-b text-left">
              {HEADERS.map((header) => (
                <th key={header} className="whitespace-nowrap py-2 pr-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-b" data-testid="offerte-row" data-offerte-name={row.name}>
                <td className="whitespace-nowrap py-2 pr-3">
                  <a className="underline" href={`/api/documents/${row.pdfId}/file`}>
                    {show(row.name)}
                  </a>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{offertePriceLabel(row.gross)}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.date)}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.sentAt ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">
                  <Link className="underline" href={`/crm/dossiers/${row.dossierId}`}>
                    {show(row.dossierNumber?.trim() ?? "")}
                  </Link>
                </td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.dossierName?.trim() ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.customer?.trim() ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.seller?.trim() ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(offerteStatusText(row.status))}</td>
                <td className="whitespace-nowrap py-2">{show(offerteWonText(row.won))}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="py-4 text-muted-foreground" colSpan={HEADERS.length}>
                  {rows.length === 0 ? "Nog geen offertes." : "Geen offertes gevonden."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
