"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DossierDetail } from "@/lib/sales/service";
import {
  confirmLogikalImportAction,
  createLogikalProjectAction,
  previewLogikalExportAction,
} from "@/actions/crm/sales/actions";

type Preview = {
  projectName: string | null;
  reference: string | null;
  count: number;
  verdict: "match" | "mismatch" | "uncertain";
};

function brussels(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Brussels",
  }).format(new Date(iso));
}

export function LogikalSection({ dossier }: { dossier: DossierDetail }) {
  const t = useTranslations("Sales");
  const locale = useLocale();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [guidance, setGuidance] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const logikal = dossier.logikal;
  const quantity = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  async function createProject() {
    setBusy(true);
    setMessage(null);
    setGuidance(false);
    const result = await createLogikalProjectAction(dossier.id);
    setBusy(false);
    if ("unavailable" in result && result.unavailable) {
      setGuidance(true);
      return;
    }
    if ("error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    if ("already" in result && result.already) setMessage(t("logikal.alreadyLinked"));
    router.refresh();
  }

  async function inspect(next: File) {
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("file", next);
    const result = await previewLogikalExportAction(dossier.id, form);
    setBusy(false);
    if ("error" in result && result.error) {
      setMessage(result.error);
      setPreview(null);
      setFile(null);
      return;
    }
    if (!("verdict" in result)) return;
    setFile(next);
    setPreview({
      projectName: result.projectName,
      reference: result.reference,
      count: result.count,
      verdict: result.verdict,
    });
  }

  async function confirm() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("file", file);
    const result = await confirmLogikalImportAction(dossier.id, form);
    setBusy(false);
    if ("error" in result && result.error) {
      setMessage(result.error);
      return;
    }
    setPreview(null);
    setFile(null);
    router.refresh();
  }

  const reference = logikal.projectName
    ? `${logikal.projectName}${logikal.projectId ? ` (${logikal.projectId})` : ""}`
    : logikal.projectId;

  return (
    <section className="space-y-3 rounded-md border p-4" aria-label={t("logikal.title")} data-logikal-section="">
      <h2 className="text-lg font-semibold">{t("logikal.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("logikal.lead")}</p>
      <p className="text-sm" data-logikal-link={logikal.projectId ?? ""} data-logikal-state={logikal.linkState ?? ""}>
        <span className="text-muted-foreground">{t("logikal.linkedProject")} </span>
        {reference || t("logikal.notLinked")}
      </p>
      {logikal.linkState === "NEEDS_CHECK" && <p className="text-sm">{t("logikal.needsCheck")}</p>}
      <p className="text-sm" data-logikal-imported={logikal.importedAt ?? ""}>
        <span className="text-muted-foreground">{t("logikal.lastImport")} </span>
        {logikal.importedAt ? brussels(logikal.importedAt, locale) : "—"}
      </p>
      {!dossier.terminal && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void createProject()}>{t("logikal.create")}</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {t("logikal.importPositions")}
          </Button>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => {
              const next = event.target.files?.[0];
              event.target.value = "";
              if (next) void inspect(next);
            }}
          />
        </div>
      )}
      {busy && <p className="text-sm">{t("logikal.working")}</p>}
      {guidance && (
        <p className="text-sm text-muted-foreground" role="status">
          {t("logikal.notConfigured", {
            name: dossier.name?.trim() || dossier.number || "—",
            number: dossier.number || "—",
          })}
        </p>
      )}
      {message && <p className="text-sm text-destructive" role="status">{message}</p>}
      {logikal.positions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("logikal.noPositions")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">{t("logikal.position")}</th>
              <th className="py-2 pr-3 font-medium">{t("logikal.quantity")}</th>
              <th className="py-2 pr-3 font-medium">{t("logikal.quoteText")}</th>
              <th className="py-2 font-medium">{t("logikal.drawing")}</th>
            </tr>
          </thead>
          <tbody>
            {logikal.positions.map((position) => {
              const text = position.quoteText?.trim() || position.description?.trim() || "—";
              const src = `/api/crm/dossiers/${dossier.id}/logikal/positions/${position.id}/drawing`;
              return (
                <tr key={position.id} className="border-b align-top" data-position={position.name}>
                  <td className="py-2 pr-3">{position.name}</td>
                  <td className="py-2 pr-3 tabular-nums">{quantity.format(position.quantity)}</td>
                  <td className="py-2 pr-3 whitespace-pre-wrap">{text}</td>
                  <td className="py-2">
                    {position.hasDrawing ? (
                      <a href={src} target="_blank" rel="noreferrer" aria-label={t("logikal.openDrawing", { name: position.name })}>
                        <Image src={src} alt={position.name} width={64} height={64} unoptimized className="h-16 w-16 rounded border object-contain bg-muted" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground" data-drawing-missing={position.name}>{t("logikal.drawingMissing")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <Dialog open={preview != null} onOpenChange={(open) => { if (!open && !busy) { setPreview(null); setFile(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("logikal.previewTitle")}</DialogTitle>
            <DialogDescription>
              {preview ? t("logikal.previewCount", { count: preview.count }) : ""}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-2 text-sm" data-logikal-verdict={preview.verdict}>
              <p><span className="text-muted-foreground">{t("logikal.projectInFile")} </span>{preview.projectName || "—"}</p>
              <p><span className="text-muted-foreground">{t("logikal.referenceInFile")} </span>{preview.reference || t("logikal.noReference")}</p>
              <p>
                {preview.verdict === "match" && t("logikal.match")}
                {preview.verdict === "uncertain" && t("logikal.uncertain")}
                {preview.verdict === "mismatch" && t("logikal.mismatch", { reference: preview.reference || t("logikal.noReference") })}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setPreview(null); setFile(null); }}>{t("cancel")}</Button>
            {preview && preview.verdict !== "mismatch" && (
              <Button type="button" disabled={busy} onClick={() => void confirm()}>{t("logikal.confirmImport")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
