"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { SELLERS } from "@/lib/sales/aanvraag-fields";
import { addDays, weekStartKey } from "@/lib/sales/offertebox-weeks";
import type { OfferteboxRow, OfferteboxView } from "@/lib/sales/offertebox";
import { assignOfferteboxSellerAction } from "@/actions/crm/sales/actions";

export function OfferteboxBoard({ view }: { view: OfferteboxView }) {
  const t = useTranslations("Sales");
  const locale = useLocale();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const todayStart = weekStartKey(now);
  const when = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const groups = new Map<string, OfferteboxRow[]>();
  for (const row of view.rows) {
    const start = weekStartKey(new Date(row.receivedAt));
    const list = groups.get(start) ?? [];
    list.push(row);
    groups.set(start, list);
  }
  const weeks = [...groups.entries()].sort((left, right) => (left[0] < right[0] ? 1 : -1));
  function labelFor(start: string) {
    if (start === todayStart) return t("offertebox.thisWeek");
    if (start === addDays(todayStart, -7)) return t("offertebox.lastWeek");
    const [year, month, day] = start.split("-").map(Number);
    const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, day)),
    );
    return t("offertebox.weekOf", { date });
  }
  const unassigned = view.rows.filter((row) => !row.sellerName).length;
  const waiting = view.rows.filter((row) => row.dossierId).length;

  async function onSeller(id: string, sellerName: string) {
    if (!sellerName) return;
    setPendingId(id);
    setError(null);
    const result = await assignOfferteboxSellerAction(id, sellerName);
    setPendingId(null);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {!view.mailboxLinked && (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm">
          <p>{t("offertebox.mailboxMissing")}</p>
          <Link href="/emails" className="mt-1 inline-block underline">
            {t("offertebox.openEmails")}
          </Link>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">{t("offertebox.toAssign")}</p>
          <p className="text-2xl font-semibold">{unassigned}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">{t("offertebox.waitingQuote")}</p>
          <p className="text-2xl font-semibold">{waiting}</p>
        </div>
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">{t("offertebox.sentThisWeek")}</p>
          <p className="text-2xl font-semibold">{view.sentThisWeek}</p>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {weeks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("offertebox.empty")}</p>
      ) : (
        weeks.map(([start, rows]) => (
          <section key={start}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{labelFor(start)}</h2>
              <span className="text-sm text-muted-foreground">{rows.length}</span>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[760px] text-sm" data-testid="offertebox-table">
                <thead className="bg-muted/40 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("offertebox.received")}</th>
                    <th className="px-3 py-2 font-medium">{t("offertebox.from")}</th>
                    <th className="px-3 py-2 font-medium">{t("offertebox.subject")}</th>
                    <th className="px-3 py-2 font-medium">{t("offertebox.seller")}</th>
                    <th className="px-3 py-2 font-medium">{t("dossier")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={row.sellerName ? "border-t" : "border-t border-l-2 border-l-primary"} data-testid="offertebox-row">
                      <td className="whitespace-nowrap px-3 py-3 align-top">{when.format(new Date(row.receivedAt))}</td>
                      <td className="px-3 py-3 align-top">
                        <span className="block font-medium">{row.fromName || row.fromEmail || "—"}</span>
                        {row.fromEmail && row.fromName && <span className="text-muted-foreground">{row.fromEmail}</span>}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="block">{row.subject}</span>
                        {row.preview && row.preview !== row.subject && (
                          <span className="line-clamp-1 text-muted-foreground">{row.preview}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <select
                          className="h-8 w-44 rounded-md border bg-transparent px-2 text-sm"
                          value={row.sellerName ?? ""}
                          disabled={pendingId === row.id}
                          aria-label={t("offertebox.seller")}
                          data-testid="offertebox-seller"
                          onChange={(event) => void onSeller(row.id, event.target.value)}
                        >
                          <option value="">{t("choose")}</option>
                          {SELLERS.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {row.dossierId ? (
                          <Link className="underline" href={`/crm/dossiers/${row.dossierId}`}>
                            {row.dossierNumber}
                            {row.step ? ` · ${t(`steps.${row.step}`)}` : ""}
                          </Link>
                        ) : (
                          <Link className="underline" href={`/crm/aanvraag?offertebox=${row.id}`}>
                            {t("newRequest")}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
