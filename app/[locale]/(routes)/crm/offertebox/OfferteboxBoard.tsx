"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { SELLERS } from "@/lib/sales/aanvraag-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const when = new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Brussels",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const unassigned = view.rows.filter((row) => !row.sellerName);
  const waiting = view.rows.filter((row) => row.sellerName);

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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <MailColumn
          title={t("offertebox.toAssign")}
          empty={t("offertebox.emptyAssign")}
          testId="offertebox-unassigned"
          rows={unassigned}
          showDossier={false}
          pendingId={pendingId}
          when={when}
          onSeller={onSeller}
        />
        <MailColumn
          title={t("offertebox.waitingQuote")}
          empty={t("offertebox.emptyWaiting")}
          testId="offertebox-waiting"
          rows={waiting}
          showDossier
          pendingId={pendingId}
          when={when}
          onSeller={onSeller}
        />
      </div>
    </div>
  );
}

function MailColumn({
  title,
  empty,
  testId,
  rows,
  showDossier,
  pendingId,
  when,
  onSeller,
}: {
  title: string;
  empty: string;
  testId: string;
  rows: OfferteboxRow[];
  showDossier: boolean;
  pendingId: string | null;
  when: Intl.DateTimeFormat;
  onSeller: (id: string, sellerName: string) => Promise<void>;
}) {
  const t = useTranslations("Sales");
  return (
    <section data-testid={testId} className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.id} data-testid="offertebox-row" className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{row.fromName || row.fromEmail || "—"}</p>
                  {row.fromEmail && row.fromName && <p className="text-sm text-muted-foreground">{row.fromEmail}</p>}
                </div>
                <time className="shrink-0 text-sm text-muted-foreground">{when.format(new Date(row.receivedAt))}</time>
              </div>
              <h3 className="mt-3 font-medium">{row.subject}</h3>
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
              <div className="mt-4 flex flex-wrap items-center gap-3">
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
                {showDossier && (
                  row.dossierId ? (
                    <Link className="underline" href={`/crm/dossiers/${row.dossierId}`}>
                      {row.dossierNumber}
                      {row.step ? ` · ${t(`steps.${row.step}`)}` : ""}
                    </Link>
                  ) : (
                    <Link className="underline" href={`/crm/aanvraag?offertebox=${row.id}`}>
                      {t("newRequest")}
                    </Link>
                  )
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
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
