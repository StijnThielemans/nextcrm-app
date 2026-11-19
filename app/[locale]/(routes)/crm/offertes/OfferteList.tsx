"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import {
  MISSING_OFFERTE_PRICE,
  offerteMatchesSearch,
  offertePriceLabel,
  type OfferteSearchRow,
} from "./offerte-search";

function show(value: string) {
  return value || "—";
}

export function OfferteList({ rows }: { rows: OfferteSearchRow[] }) {
  const t = useTranslations("Sales");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => rows.filter((row) => offerteMatchesSearch(row, query)), [rows, query]);
  const headers = [
    t("quote"),
    t("grossTotal"),
    t("date"),
    t("sent"),
    t("dossier"),
    t("projectDescription"),
    t("customer"),
    t("seller"),
    t("status"),
    t("won"),
  ];

  return (
    <>
      <Input
        placeholder={t("search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="mb-4 h-8 w-[150px] lg:w-[250px]"
        data-testid="offertes-search"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm" data-testid="offertes-table">
          <thead>
            <tr className="border-b text-left">
              {headers.map((header) => (
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
                <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{offertePriceLabel(row.gross) === MISSING_OFFERTE_PRICE ? t("noPrice") : offertePriceLabel(row.gross)}</td>
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
                <td className="whitespace-nowrap py-2 pr-3">{show(row.status && t.has(`dossierStatus.${row.status}`) ? t(`dossierStatus.${row.status}`) : "")}</td>
                <td className="whitespace-nowrap py-2">{row.won ? t("won") : "—"}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="py-4 text-muted-foreground" colSpan={headers.length}>
                  {rows.length === 0 ? t("noQuotes") : t("noQuotesFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
