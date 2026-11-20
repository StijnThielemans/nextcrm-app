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
    <section className="tilo-frame space-y-3 p-4" aria-label={t("positions.title")} data-quote-positions="">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
            {t("positions.title")}
          </h2>
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
        <ul className="grid w-full grid-cols-1 items-start justify-items-start gap-2">
          {positions.map((position) => {
            const title = position.title !== position.number ? position.title : "";
            return (
              <li key={position.id} className="grid w-max max-w-full justify-self-start gap-y-1 rounded-lg border border-[hsl(215_14%_84%)] px-2.5 py-2" data-quote-position={position.number}>
                <p className="flex w-0 min-w-full flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs leading-tight">
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
                  <p className="w-[min(100%,26rem)] whitespace-pre-wrap text-xs leading-snug">{position.text}</p>
                ) : (
                  // The crop is a rendered slice of the uploaded quote, not a remote image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/crm/dossiers/${dossierId}/quotes/${pdfId}/positions/${position.id}/image`}
                    alt={t("positions.drawing", { name: position.number })}
                    className="h-auto w-auto max-w-full justify-self-start rounded border bg-white sm:max-w-[26rem]"
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
