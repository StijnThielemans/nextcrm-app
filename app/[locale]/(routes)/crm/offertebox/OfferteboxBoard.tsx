"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent, type MouseEvent } from "react";
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
  const [openId, setOpenId] = useState<string | null>(null);

  function toggleRow(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }
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
    event.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
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
    // Read the drop while the event is still active. After the first await the
    // browser clears dataTransfer, so an Outlook drop that is only HTML would
    // look like an empty drop.
    const listed = [...event.dataTransfer.files];
    const incoming = listed.length > 0 ? listed : filesFromItems(event);
    const offeredText = Boolean(event.dataTransfer.getData("text/html").trim() || event.dataTransfer.getData("text/plain").trim());
    const offeredFile = incoming.length > 0 || [...event.dataTransfer.types].includes("Files");
    void (async () => {
      const ready = (await Promise.all(incoming.map(materializeDroppedFile))).filter((file) => file.size > 0);
      if (ready.length > 0) {
        await uploadFiles(ready);
        return;
      }
      if (offeredFile || offeredText) setError(t("errors.mailNoFile"));
    })();
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
          openId={openId}
          when={when}
          onSeller={onSeller}
          onToggle={toggleRow}
        />
        <MailColumn
          title={t("offertebox.waitingQuote")}
          empty={t("offertebox.emptyWaiting")}
          testId="offertebox-waiting"
          rows={waiting}
          showDossier
          pendingId={pendingId}
          openId={openId}
          when={when}
          onSeller={onSeller}
          onToggle={toggleRow}
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
  openId,
  when,
  onSeller,
  onToggle,
  onFile,
}: {
  title: string;
  empty: string;
  testId: string;
  rows: OfferteboxRow[];
  showDossier: boolean;
  pendingId: string | null;
  openId: string | null;
  when: Intl.DateTimeFormat;
  onSeller: (id: string, sellerName: string) => Promise<void>;
  onToggle: (id: string) => void;
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
              open={openId === row.id}
              showDossier={showDossier}
              pending={pendingId === row.id}
              when={when}
              onSeller={onSeller}
              onToggle={() => onToggle(row.id)}
              onFile={onFile}
              sellerLabel={t("offertebox.seller")}
              divideLabel={t("offertebox.divide")}
              newRequestLabel={t("newRequest")}
              stepLabel={row.step ? t(`steps.${row.step}`) : ""}
              bodyLabel={t("offertebox.body")}
              emptyBody={t("offertebox.noBody")}
              attachmentsLabel={t("offertebox.attachments")}
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
  open,
  showDossier,
  pending,
  when,
  onSeller,
  onToggle,
  onFile,
  sellerLabel,
  divideLabel,
  newRequestLabel,
  stepLabel,
  bodyLabel,
  emptyBody,
  attachmentsLabel,
  fileLabel,
}: {
  row: OfferteboxRow;
  open: boolean;
  showDossier: boolean;
  pending: boolean;
  when: Intl.DateTimeFormat;
  onSeller: (id: string, sellerName: string) => Promise<void>;
  onToggle: () => void;
  onFile?: (row: OfferteboxRow) => void;
  sellerLabel: string;
  divideLabel: string;
  newRequestLabel: string;
  stepLabel: string;
  bodyLabel: string;
  emptyBody: string;
  attachmentsLabel: string;
  fileLabel: string;
}) {
  const articleRef = useRef<HTMLElement>(null);
  const name = row.fromName || row.fromEmail || "—";
  const email = row.fromEmail && row.fromName ? row.fromEmail : "";
  const dossierText = `${row.dossierNumber ?? ""}${stepLabel ? ` · ${stepLabel}` : ""}`;
  const unfiled = row.attachments.some((attachment) => !attachment.filed);

  useEffect(() => {
    if (!open) return;
    articleRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  function onRowClick(event: MouseEvent<HTMLElement>) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("a, button, select, input, textarea, label, [data-testid='offertebox-detail']")) return;
    onToggle();
  }

  return (
    <article
      ref={articleRef}
      data-testid="offertebox-row"
      data-open={open ? "true" : "false"}
      onClick={onRowClick}
      className={open
        ? "my-1 rounded-[0.7rem] border border-[hsl(215_16%_70%)] bg-[hsl(210_33%_98%)] dark:border-[hsl(210_8%_32%)] dark:bg-[hsl(210_8%_13%)]"
        : `border-b ${hairline} last:border-b-0`}
    >
      <div className={open ? "px-3 py-3" : "px-1 py-1"}>
        <div className="flex items-start gap-3">
          <button
            type="button"
            className={open ? "min-w-0 flex-1 text-left" : "flex min-w-0 flex-1 items-baseline gap-2 text-left"}
            aria-expanded={open}
            data-testid="offertebox-toggle"
            title={[name, email, row.subject].filter(Boolean).join(" · ")}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            {open ? (
              <span className="block">
                <span className="block text-lg font-medium leading-6">{name}</span>
                {email ? <span className="mt-0.5 block truncate text-sm text-muted-foreground">{email}</span> : null}
                {row.subject ? <span className="mt-2 block text-base font-medium leading-6">{row.subject}</span> : null}
              </span>
            ) : (
              <>
                <span className="max-w-[62%] shrink truncate text-sm font-medium leading-5">{name}</span>
                {email ? <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{email}</span> : null}
              </>
            )}
          </button>
          <time className={`shrink-0 whitespace-nowrap text-muted-foreground ${open ? "pt-1 text-sm" : "text-xs"}`}>
            {when.format(new Date(row.receivedAt))}
          </time>
        </div>
        <div className={open ? "mt-3 flex items-center gap-3" : "mt-0.5 flex items-center gap-2"}>
          <select
            className="h-7 w-[8.75rem] shrink-0 rounded-full border border-input bg-transparent px-2 text-xs"
            value={row.sellerName ?? ""}
            disabled={pending}
            aria-label={sellerLabel}
            data-testid="offertebox-seller"
            onClick={(event) => event.stopPropagation()}
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
        <div className="space-y-3 px-3 pb-3" data-testid="offertebox-detail">
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
                        className="h-12 w-12 rounded border object-cover"
                      />
                    )}
                    <OpenStoredFile
                      kind="attachment"
                      id={attachment.id}
                      name={attachment.fileName}
                      mimeType={attachment.contentType}
                      image={attachment.isImage}
                      className="truncate text-sm underline"
                      testId="offertebox-attachment"
                    >
                      {attachment.fileName}
                    </OpenStoredFile>
                  </li>
                ))}
              </ul>
              {showDossier && row.dossierId && onFile && unfiled && (
                <button
                  type="button"
                  className="mt-2 text-sm underline"
                  data-testid="file-attachments"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFile(row);
                  }}
                >
                  {fileLabel}
                </button>
              )}
            </div>
          )}
          <div data-testid="offertebox-body">
            <p className="text-xs font-medium text-muted-foreground">{bodyLabel}</p>
            <div className="mt-1 min-h-72 max-h-[32rem] overflow-auto rounded-md border border-[hsl(215_14%_84%)] bg-white p-4 text-base leading-7 break-words text-black dark:border-[hsl(210_8%_24%)] dark:bg-card dark:text-foreground">
              {row.html ? (
                <div
                  data-testid="offertebox-html"
                  className="[&_a]:underline [&_img]:h-auto [&_img]:max-w-full [&_table]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: row.html }}
                />
              ) : row.body ? (
                <div className="whitespace-pre-wrap">{row.body}</div>
              ) : (
                <p className="text-muted-foreground">{emptyBody}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
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

/** Outlook gives the browser a virtual file. The first read is often empty, so copy the bytes before upload. */
async function materializeDroppedFile(file: File): Promise<File> {
  let bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    bytes = await file.arrayBuffer();
  }
  const name = file.name.trim() || "bericht";
  const type = file.type || sniffedMailType(name, bytes);
  return new File([bytes], name, { type });
}

/** Outlook sometimes drops message/rfc822, or a file whose name has no extension. */
function sniffedMailType(name: string, bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  if (view.length >= 4 && view[0] === 0xd0 && view[1] === 0xcf && view[2] === 0x11 && view[3] === 0xe0) {
    return "application/vnd.ms-outlook";
  }
  const lower = name.toLowerCase();
  if (lower.endsWith(".eml") || lower.endsWith(".emlx") || lower.endsWith(".mime")) return "message/rfc822";
  if (lower.endsWith(".msg")) return "application/vnd.ms-outlook";
  return "";
}
