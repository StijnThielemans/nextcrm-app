"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { stepMessageKey } from "@/lib/sales/step-text";
import {
  dossierAddress,
  dossierArchitect,
  dossierContactType,
  dossierMatchesSearch,
  dossierPriceRequestDate,
  dossierProjectGroup,
  dossierSiteAddress,
  dossierStatusText,
  type DossierSearchRow,
} from "./dossier-search";

const HEADER_KEYS = [
  "projectNumber",
  "projectDescription",
  "customer",
  "contactType",
  "email",
  "phone",
  "gsm",
  "vat",
  "address",
  "seller",
  "architect",
  "projectGroup",
  "priceRequestDate",
  "siteAddress",
  "status",
  "followUp",
] as const;

function show(value: string) {
  return value || "—";
}

export function DossierList({ rows }: { rows: DossierSearchRow[] }) {
  const t = useTranslations("Sales");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => rows.filter((row) => dossierMatchesSearch(row, query)), [rows, query]);
  const headers = HEADER_KEYS.map((key) => t(key));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/crm/aanvraag"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground"
        >
          {t("newRequestPlus")}
        </Link>
        <Input
          placeholder={t("search")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
          data-testid="dossiers-search"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm" data-testid="dossiers-table">
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
              <tr key={row.id} className="border-b" data-testid="dossier-row" data-dossier-number={row.number ?? ""}>
                <td className="whitespace-nowrap py-2 pr-3">
                  <Link className="underline" href={`/crm/dossiers/${row.id}`}>
                    {show(row.number?.trim() ?? "")}
                  </Link>
                </td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.name?.trim() ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.customer?.trim() ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.contactType && t.has(`roles.${row.contactType}`) ? t(`roles.${row.contactType}`) : dossierContactType(row.contactType))}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.email?.trim() ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.phone?.trim() ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.mobile?.trim() ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.vat?.trim() ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(dossierAddress(row))}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.seller?.trim() ?? "")}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(dossierArchitect(row))}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(row.projectGroup && t.has(`groups.${row.projectGroup}`) ? t(`groups.${row.projectGroup}`) : dossierProjectGroup(row.projectGroup))}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(dossierPriceRequestDate(row))}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show(dossierSiteAddress(row))}</td>
                <td className="whitespace-nowrap py-2 pr-3">{show((() => { const key = stepMessageKey(dossierStatusText(row)); return key && t.has(key) ? t(key) : dossierStatusText(row); })())}</td>
                <td className="whitespace-nowrap py-2">{show(row.followUpDate?.trim() ?? "")}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="py-4 text-muted-foreground" colSpan={HEADER_KEYS.length}>
                  {rows.length === 0 ? t("noDossiers") : t("noDossiersFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
