"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { SELLERS } from "@/lib/sales/aanvraag-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OfferteboxRow, OfferteboxView } from "@/lib/sales/offertebox";
import { addOfferteboxRequestAction, assignOfferteboxSellerAction } from "@/actions/crm/sales/actions";
import { FileAttachmentsDialog } from "../sales/FileAttachmentsDialog";
import { OpenStoredFile } from "@/components/files/OpenStoredFile";

const IMAGE_PREVIEW_BYTES = 200_000;

const frame = "rounded-[0.9rem] border border-[hsl(215_16%_76%)] bg-white dark:border-[hsl(210_8%_26%)] dark:bg-card";
const hairline = "border-[hsl(215_14%_84%)] dark:border-[hsl(210_8%_24%)]";

export function OfferteboxBoard({ view }: { view: OfferteboxView }) {
  const t = useTranslations("Sales");
  const locale = useLocale();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filing, setFiling] = useState<OfferteboxRow | null>(null);
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
    void filesFromDrop(event).then((files) => uploadFiles(files));
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

  const mailboxMissing = t("offertebox.mailboxMissing");

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col gap-2 ${dragOver ? "rounded-[0.9rem] ring-1 ring-[hsl(var(--tilo))]" : ""}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid="offertebox-list"
    >
      {!view.mailboxLinked && (
        <p
          className="flex shrink-0 items-center gap-2 rounded-[0.9rem] border border-dashed border-[hsl(215_16%_72%)] bg-white px-3 py-1 text-xs leading-tight dark:bg-card"
          title={mailboxMissing}
        >
          <span className="min-w-0 truncate">{mailboxMissing}</span>
          <Link href="/emails" className="shrink-0 underline">
            {t("offertebox.openEmails")}
          </Link>
        </p>
      )}
      <div className="flex shrink-0 items-center gap-2">
        <div
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-[0.9rem] border border-dashed border-[hsl(215_16%_72%)] bg-white px-3 py-1.5 ${dragOver ? "border-[hsl(var(--tilo))] bg-[hsl(183_42%_97%)]" : ""}`}
          data-testid="offertebox-drop"
        >
          <p className="min-w-0 truncate text-sm leading-tight" title={t("offertebox.dropHint")}>
            <span className="font-medium">{t("offertebox.dropTitle")}</span>
            <span className="text-muted-foreground"> · {t("offertebox.dropHint")}</span>
          </p>
          <label className="shrink-0 cursor-pointer text-xs underline">
            {uploading ? t("offertebox.dropping") : t("offertebox.dropBrowse")}
            <input
              type="file"
              accept=".eml,.emlx,.msg,message/rfc822,application/vnd.ms-outlook"
              multiple
              className="hidden"
              disabled={uploading}
              data-testid="offertebox-file"
              onChange={(event) => {
                const files = event.target.files ? [...event.target.files] : [];
                event.target.value = "";
                void Promise.all(files.map(materializeDroppedFile)).then((ready) =>
                  uploadFiles(ready.filter((file) => file.size > 0)),
                );
              }}
            />
          </label>
        </div>
        <Button type="button" size="sm" className="h-8 shrink-0 rounded-full px-3 text-xs" data-testid="offertebox-add" onClick={() => setAdding((open) => !open)}>
          {t("offertebox.addRequest")}
        </Button>
      </div>
      {adding && (
        <form onSubmit={onAdd} className={`${frame} grid shrink-0 gap-2 p-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]`} data-testid="offertebox-add-form">
          <label className="space-y-1 text-xs">
            <span>{t("offertebox.addName")}</span>
            <Input className="h-8" value={fromName} onChange={(event) => setFromName(event.target.value)} data-testid="offertebox-add-name" />
          </label>
          <label className="space-y-1 text-xs">
            <span>{t("offertebox.addEmail")}</span>
            <Input className="h-8" type="email" value={fromEmail} onChange={(event) => setFromEmail(event.target.value)} data-testid="offertebox-add-email" />
          </label>
          <label className="space-y-1 text-xs">
            <span>{t("offertebox.addSubject")}</span>
            <Input className="h-8" value={subject} onChange={(event) => setSubject(event.target.value)} required data-testid="offertebox-add-subject" />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" className="h-8 rounded-full px-3" disabled={saving}>{t("offertebox.addSave")}</Button>
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-full px-3" onClick={() => setAdding(false)}>{t("offertebox.addCancel")}</Button>
          </div>
        </form>
      )}
      {error && <p className="shrink-0 text-sm text-destructive">{error}</p>}
      <div className="grid min-h-0 flex-1 items-stretch gap-2 lg:grid-cols-2">
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
          onFile={setFiling}
        />
      </div>
      {filing?.dossierId && (
        <FileAttachmentsDialog
          dossierId={filing.dossierId}
          attachments={filing.attachments.filter((attachment) => !attachment.filed)}
          open
          onOpenChange={(open) => {
            if (!open) setFiling(null);
          }}
        />
      )}
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
  onFile,
}: {
  title: string;
  empty: string;
  testId: string;
  rows: OfferteboxRow[];
  showDossier: boolean;
  pendingId: string | null;
  when: Intl.DateTimeFormat;
  onSeller: (id: string, sellerName: string) => Promise<void>;
  onFile?: (row: OfferteboxRow) => void;
}) {
  const t = useTranslations("Sales");
  return (
    <section data-testid={testId} className={`${frame} flex min-h-0 flex-col p-2 lg:h-full`}>
      <div className="flex shrink-0 items-baseline justify-between px-1 pb-1">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
          {title}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows.map((row) => (
            <MailRow
              key={row.id}
              row={row}
              showDossier={showDossier}
              pending={pendingId === row.id}
              when={when}
              onSeller={onSeller}
              onFile={onFile}
              sellerLabel={t("offertebox.seller")}
              divideLabel={t("offertebox.divide")}
              newRequestLabel={t("newRequest")}
              stepLabel={row.step ? t(`steps.${row.step}`) : ""}
              bodyLabel={t("offertebox.body")}
              attachmentsLabel={t("offertebox.attachments")}
              showAll={t("offertebox.showAll")}
              showLess={t("offertebox.showLess")}
              fileLabel={t("offertebox.fileAttachments")}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MailRow({
  row,
  showDossier,
  pending,
  when,
  onSeller,
  onFile,
  sellerLabel,
  divideLabel,
  newRequestLabel,
  stepLabel,
  bodyLabel,
  attachmentsLabel,
  showAll,
  showLess,
  fileLabel,
}: {
  row: OfferteboxRow;
  showDossier: boolean;
  pending: boolean;
  when: Intl.DateTimeFormat;
  onSeller: (id: string, sellerName: string) => Promise<void>;
  onFile?: (row: OfferteboxRow) => void;
  sellerLabel: string;
  divideLabel: string;
  newRequestLabel: string;
  stepLabel: string;
  bodyLabel: string;
  attachmentsLabel: string;
  showAll: string;
  showLess: string;
  fileLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const name = row.fromName || row.fromEmail || "—";
  const email = row.fromEmail && row.fromName ? row.fromEmail : "";
  const dossierText = `${row.dossierNumber ?? ""}${stepLabel ? ` · ${stepLabel}` : ""}`;
  const unfiled = row.attachments.some((attachment) => !attachment.filed);

  return (
    <article data-testid="offertebox-row" className={`border-b ${hairline} last:border-b-0 ${open ? "bg-[hsl(210_20%_98%)] dark:bg-[hsl(210_8%_14%)]" : ""}`}>
      <div className="px-1 py-1">
        <div className="flex items-baseline gap-2">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
            aria-expanded={open}
            data-testid="offertebox-toggle"
            title={[name, email, row.subject].filter(Boolean).join(" · ")}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="max-w-[62%] shrink truncate text-sm font-medium leading-5">{name}</span>
            {email ? <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{email}</span> : null}
          </button>
          <time className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{when.format(new Date(row.receivedAt))}</time>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <select
            className="h-7 w-[8.75rem] shrink-0 rounded-full border border-input bg-transparent px-2 text-xs"
            value={row.sellerName ?? ""}
            disabled={pending}
            aria-label={sellerLabel}
            data-testid="offertebox-seller"
            onChange={(event) => void onSeller(row.id, event.target.value)}
          >
            <option value="">{divideLabel}</option>
            {SELLERS.map((seller) => (
              <option key={seller} value={seller}>{seller}</option>
            ))}
          </select>
          {showDossier && (
            row.dossierId ? (
              <Link className="min-w-0 truncate text-xs underline" href={`/crm/dossiers/${row.dossierId}`} title={dossierText}>
                {dossierText}
              </Link>
            ) : (
              <Link className="min-w-0 truncate text-xs underline" href={`/crm/aanvraag?offertebox=${row.id}`}>
                {newRequestLabel}
              </Link>
            )
          )}
        </div>
      </div>
      {open && (
        <div className="space-y-2 px-2 pb-2" data-testid="offertebox-detail">
          {row.subject && <p className="text-sm font-medium">{row.subject}</p>}
          {(row.html || row.body) && (
            <div data-testid="offertebox-body">
              <p className="text-xs font-medium text-muted-foreground">{bodyLabel}</p>
              {row.html ? (
                <MailHtml html={row.html} showAll={showAll} showLess={showLess} />
              ) : (
                <MailText text={row.body} showAll={showAll} showLess={showLess} />
              )}
            </div>
          )}
          {row.attachments.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">{attachmentsLabel}</p>
              <ul className="mt-1 space-y-1">
                {row.attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center gap-2">
                    {attachment.isImage && attachment.size <= IMAGE_PREVIEW_BYTES && (
                      <img
                        src={`/api/crm/offertebox/attachments/${attachment.id}`}
                        alt={attachment.fileName}
                        className="h-10 w-10 rounded border object-cover"
                      />
                    )}
                    <OpenStoredFile
                      kind="attachment"
                      id={attachment.id}
                      name={attachment.fileName}
                      mimeType={attachment.contentType}
                      image={attachment.isImage}
                      className="truncate text-xs underline"
                      testId="offertebox-attachment"
                    >
                      {attachment.fileName}
                    </OpenStoredFile>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {showDossier && row.dossierId && onFile && unfiled && (
            <button type="button" className="text-xs underline" data-testid="file-attachments" onClick={() => onFile(row)}>
              {fileLabel}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function hasFiles(event: DragEvent<HTMLDivElement>) {
  return [...event.dataTransfer.types].includes("Files");
}

/** Outlook gives the browser a virtual file. The first read is often empty, so copy the bytes before upload. */
async function filesFromDrop(event: DragEvent<HTMLDivElement>): Promise<File[]> {
  const listed = [...event.dataTransfer.files];
  const incoming = listed.length > 0 ? listed : filesFromItems(event);
  const ready = (await Promise.all(incoming.map(materializeDroppedFile))).filter((file) => file.size > 0);
  if (ready.length > 0) return ready;
  const text = event.dataTransfer.getData("text/plain").trim();
  const html = event.dataTransfer.getData("text/html").trim();
  const body = text || html;
  if (!body) return [];
  const subject = body.split("\n").map((line) => line.trim()).find(Boolean)?.slice(0, 180) || "Outlook";
  const eml = `From: \r\nSubject: ${subject.replace(/[\r\n]/g, " ")}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
  return [new File([eml], "outlook.eml", { type: "message/rfc822" })];
}

function filesFromItems(event: DragEvent<HTMLDivElement>): File[] {
  const files: File[] = [];
  for (const item of event.dataTransfer.items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}

async function materializeDroppedFile(file: File): Promise<File> {
  let bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    bytes = await file.arrayBuffer();
  }
  const name = file.name.trim() || "bericht.msg";
  const type = file.type || (name.toLowerCase().endsWith(".eml") ? "message/rfc822" : "application/vnd.ms-outlook");
  return new File([bytes], name, { type });
}

function MailHtml({ html, showAll, showLess }: { html: string; showAll: string; showLess: string }) {
  const [open, setOpen] = useState(false);
  const long = html.length > 1500;
  return (
    <>
      <div
        data-testid="offertebox-html"
        className={`${open ? "mt-1" : "mt-1 max-h-48"} overflow-auto rounded border bg-white p-2 text-sm text-black break-words [&_a]:underline [&_img]:h-auto [&_img]:max-w-full [&_table]:max-w-full`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {long && (
        <button type="button" className="mt-1 text-xs underline" onClick={() => setOpen((value) => !value)}>
          {open ? showLess : showAll}
        </button>
      )}
    </>
  );
}

function MailText({ text, showAll, showLess }: { text: string; showAll: string; showLess: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420 || text.split("\n").length > 6;
  return (
    <>
      <div className={open ? "mt-1 whitespace-pre-wrap break-words text-sm" : "mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap break-words text-sm"}>
        {text}
      </div>
      {long && (
        <button type="button" className="mt-1 text-xs underline" onClick={() => setOpen((value) => !value)}>
          {open ? showLess : showAll}
        </button>
      )}
    </>
  );
}
