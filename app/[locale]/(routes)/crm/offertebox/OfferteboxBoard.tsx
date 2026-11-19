"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { SELLERS } from "@/lib/sales/aanvraag-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, weekStartKey } from "@/lib/sales/offertebox-weeks";
import type { OfferteboxRow, OfferteboxView } from "@/lib/sales/offertebox";
import { addOfferteboxRequestAction, assignOfferteboxSellerAction } from "@/actions/crm/sales/actions";

const IMAGE_PREVIEW_BYTES = 200_000;

export function OfferteboxBoard({ view }: { view: OfferteboxView }) {
  const t = useTranslations("Sales");
  const locale = useLocale();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [subject, setSubject] = useState("");
  const dragDepth = useRef(0);
  const uploadingRef = useRef(false);
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

  function errorText(code: string) {
    const key = `errors.${code}`;
    return t.has(key) ? t(key) : t("errors.generic");
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const body = new FormData();
        body.set("file", file);
        const response = await fetch("/api/crm/offertebox/import", { method: "POST", body });
        const data = (await response.json().catch(() => ({}))) as { code?: string };
        if (!response.ok) {
          setError(errorText(typeof data.code === "string" ? data.code : "generic"));
          return;
        }
      }
      router.refresh();
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    void uploadFiles([...event.dataTransfer.files]);
  }

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

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await addOfferteboxRequestAction({ fromName, fromEmail, subject });
    setSaving(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setFromName("");
    setFromEmail("");
    setSubject("");
    setAdding(false);
    router.refresh();
  }

  return (
    <div
      className={`space-y-6 rounded-md ${dragOver ? "ring-2 ring-primary ring-offset-2" : ""}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid="offertebox-list"
    >
      {!view.mailboxLinked && (
        <div className="rounded-md border border-dashed px-4 py-3 text-sm">
          <p>{t("offertebox.mailboxMissing")}</p>
          <Link href="/emails" className="mt-1 inline-block underline">
            {t("offertebox.openEmails")}
          </Link>
        </div>
      )}
      <div
        className={`rounded-md border border-dashed px-4 py-8 text-center ${dragOver ? "border-primary bg-primary/5" : ""}`}
        data-testid="offertebox-drop"
      >
        <p className="font-medium">{t("offertebox.dropTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("offertebox.dropHint")}</p>
        <label className="mt-3 inline-block cursor-pointer text-sm underline">
          {uploading ? t("offertebox.dropping") : t("offertebox.dropBrowse")}
          <input
            type="file"
            accept=".eml,.emlx,message/rfc822"
            multiple
            className="hidden"
            disabled={uploading}
            data-testid="offertebox-file"
            onChange={(event) => {
              const files = event.target.files ? [...event.target.files] : [];
              event.target.value = "";
              void uploadFiles(files);
            }}
          />
        </label>
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" className="h-8" data-testid="offertebox-add" onClick={() => setAdding((open) => !open)}>
          {t("offertebox.addRequest")}
        </Button>
      </div>
      {adding && (
        <form onSubmit={onAdd} className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto]" data-testid="offertebox-add-form">
          <label className="space-y-1 text-sm">
            <span>{t("offertebox.addName")}</span>
            <Input value={fromName} onChange={(event) => setFromName(event.target.value)} className="h-8" data-testid="offertebox-add-name" />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("offertebox.addEmail")}</span>
            <Input type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} className="h-8" data-testid="offertebox-add-email" />
          </label>
          <label className="space-y-1 text-sm">
            <span>{t("offertebox.addSubject")}</span>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} className="h-8" required data-testid="offertebox-add-subject" />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" className="h-8" disabled={saving}>{t("offertebox.addSave")}</Button>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setAdding(false)}>{t("offertebox.addCancel")}</Button>
          </div>
        </form>
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
                      <td className="min-w-[280px] px-3 py-3 align-top">
                        <span className="block font-medium">{row.subject}</span>
                        {row.body && (
                          <div data-testid="offertebox-body">
                            <p className="mt-2 text-xs font-medium text-muted-foreground">{t("offertebox.body")}</p>
                            <MailText text={row.body} showAll={t("offertebox.showAll")} showLess={t("offertebox.showLess")} />
                          </div>
                        )}
                        {row.attachments.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground">{t("offertebox.attachments")}</p>
                            <ul className="mt-1 space-y-2">
                              {row.attachments.map((attachment) => (
                                <li key={attachment.id} className="flex items-center gap-2">
                                  {attachment.isImage && attachment.size <= IMAGE_PREVIEW_BYTES && (
                                    <img
                                      src={`/api/crm/offertebox/attachments/${attachment.id}`}
                                      alt={attachment.fileName}
                                      className="h-14 w-14 rounded border object-cover"
                                    />
                                  )}
                                  <a
                                    className="underline"
                                    href={`/api/crm/offertebox/attachments/${attachment.id}?download=1`}
                                    data-testid="offertebox-attachment"
                                  >
                                    {attachment.fileName}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
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
                          <option value="">{t("offertebox.divide")}</option>
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

function hasFiles(event: DragEvent<HTMLDivElement>) {
  return [...event.dataTransfer.types].includes("Files");
}

function MailText({ text, showAll, showLess }: { text: string; showAll: string; showLess: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420 || text.split("\n").length > 6;
  return (
    <>
      <div className={open ? "mt-1 whitespace-pre-wrap break-words" : "mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words"}>
        {text}
      </div>
      {long && (
        <button type="button" className="mt-1 underline" onClick={() => setOpen((value) => !value)}>
          {open ? showLess : showAll}
        </button>
      )}
    </>
  );
}
