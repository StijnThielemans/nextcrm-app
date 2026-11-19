"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { euro } from "@/lib/sales/labels";
import { newestQuotePdf, type QuotePositionView } from "@/lib/sales/quote-positions";

type QuotePdf = { pdfId: string; pdfName: string; date?: string | null; addedAt?: string | null };

export function QuotePositionsSection({ dossierId, quotes }: { dossierId: string; quotes: QuotePdf[] }) {
  const t = useTranslations("Sales");
  const pdfs = quotes.filter((quote, index) => quotes.findIndex((item) => item.pdfId === quote.pdfId) === index);
  const quoteKey = pdfs.map((quote) => `${quote.pdfId}\t${quote.date ?? ""}\t${quote.addedAt ?? ""}`).join("\n");
  const [pdfId, setPdfId] = useState(() => newestQuotePdf(pdfs)?.pdfId ?? "");
  const [positions, setPositions] = useState<QuotePositionView[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (pdfId && pdfs.some((quote) => quote.pdfId === pdfId)) return;
    setPdfId(newestQuotePdf(pdfs)?.pdfId ?? "");
  }, [quoteKey, pdfId]);

  useEffect(() => {
    if (!pdfId) {
      setPositions([]);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setBroken({});
    void fetch(`/api/crm/dossiers/${dossierId}/quotes/${pdfId}/positions`)
      .then(async (response) => {
        if (!response.ok) throw new Error("positions");
        return response.json() as Promise<{ positions?: QuotePositionView[] }>;
      })
      .then((result) => {
        if (cancelled) return;
        const next = result.positions ?? [];
        setPositions(next);
        setStatus(next.length === 0 ? "empty" : "ready");
      })
      .catch(() => {
        if (!cancelled) {
          setPositions([]);
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dossierId, pdfId]);

  return (
    <section className="space-y-3 rounded-md border p-4" aria-label={t("positions.title")} data-quote-positions="">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold">{t("positions.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("positions.lead")}</p>
        </div>
        {pdfs.length > 0 && (
          <label className="w-full max-w-sm space-y-1 text-sm">
            <span>{t("positions.choose")}</span>
            <select
              className="flex h-9 w-full rounded-md border bg-transparent px-2"
              value={pdfId}
              data-quote-pdf=""
              onChange={(event) => setPdfId(event.target.value)}
            >
              <option value="">{t("positions.placeholder")}</option>
              {pdfs.map((quote) => (
                <option key={quote.pdfId} value={quote.pdfId}>{quote.pdfName}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {pdfs.length === 0 && (
        <p className="text-sm" data-quote-positions-empty="">{t("positions.noQuotePdf")}</p>
      )}
      {status === "loading" && <p className="text-sm">{t("positions.loading")}</p>}
      {status === "empty" && <p className="text-sm" data-quote-positions-none="">{t("positions.noPositions")}</p>}
      {status === "error" && <p className="text-sm text-destructive" role="status">{t("positions.loadFailed")}</p>}
      {status === "ready" && (
        <ul className="grid items-start gap-4 xl:grid-cols-2">
          {positions.map((position) => {
            const title = position.title !== position.number ? position.title : "";
            return (
              <li key={position.id} className="space-y-2 rounded-md border p-3" data-quote-position={position.number}>
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold">{t("positions.position")} {position.number}</span>
                  {position.quantity && (
                    <span><span className="text-muted-foreground">{t("positions.quantity")} </span>{position.quantity}</span>
                  )}
                  {title && <span className="min-w-0 flex-1">{title}</span>}
                  {position.price != null && (
                    <span className="ml-auto tabular-nums" data-position-price={position.number}>{euro(position.price)}</span>
                  )}
                </p>
                {broken[position.id] ? (
                  <p className="whitespace-pre-wrap text-sm">{position.text}</p>
                ) : (
                  // The crop is a rendered slice of the uploaded quote, not a remote image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/crm/dossiers/${dossierId}/quotes/${pdfId}/positions/${position.id}/image`}
                    alt={t("positions.drawing", { name: position.number })}
                    className="h-auto w-full rounded border bg-white"
                    onError={() => setBroken((current) => ({ ...current, [position.id]: true }))}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
