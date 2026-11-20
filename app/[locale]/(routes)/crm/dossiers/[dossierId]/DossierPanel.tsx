"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, FileText, Folder, Pencil, Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DOSSIER_DOCUMENT_CATEGORIES,
  FOLLOW_UP_CHANNELS,
  followUpChannelLabel,
  type DossierDocumentCategory,
  type RequestChannel,
} from "@/lib/sales/labels";
import { OpenStoredFile } from "@/components/files/OpenStoredFile";
import { groupDocumentsIntoFolders, type DocumentFolder } from "@/lib/sales/document-folders";
import { DOSSIER_FOLLOW_UP_AFTER_DAYS, stepperForDossier } from "@/lib/sales/dossier-step";
import { MISSING_QUOTE_PRICE, quoteCanWin, quotePriceLabel } from "@/lib/sales/quote-choice";
import type { DossierDetail } from "@/lib/sales/service";
import {
  addChannelAction,
  attachDossierDocumentAction,
  attachOffertePdfAction,
  changeDossierDocumentCategoryAction,
  changeStatusAction,
  deleteDossierDocumentAction,
  deleteOfferteAction,
  markSentAction,
} from "@/actions/crm/sales/actions";
import { uploadDocumentFile, uploadPdf } from "../../sales/upload-pdf";
import { FileAttachmentsDialog } from "../../sales/FileAttachmentsDialog";
import type { PendingOfferteboxAttachment } from "@/lib/sales/offertebox-filing";
import { QuotePositionsSection } from "./QuotePositionsSection";
import { DossierProjectDialog } from "./DossierProjectDialog";
import { AddressLink } from "@/components/crm/AddressLink";

const today = new Date().toISOString().slice(0, 10);

function folderTitle(label: string, category: string | null | undefined, t: ReturnType<typeof useTranslations>) {
  if (category && t.has(`folders.${category}`)) return t(`folders.${category}`);
  return label;
}


function AcceptedQuoteName({ dossier }: { dossier: DossierDetail }) {
  const t = useTranslations("Sales");
  const quote = dossier.acceptedQuote;
  if (!quote) return null;
  const pdfId = dossier.families.flatMap((family) => family.quotes).find((item) => item.id === quote.id)?.pdfId;
  const sentence = t("wonQuote", { name: quote.name });
  const at = sentence.indexOf(quote.name);
  const name = pdfId
    ? <OpenStoredFile kind="document" id={pdfId} name={quote.name} mimeType="application/pdf" className="underline break-words">{quote.name}</OpenStoredFile>
    : quote.name;
  return (
    <p className="min-w-0 break-words text-[0.72rem] leading-snug text-muted-foreground" data-accepted-quote={quote.id}>
      {at < 0 ? sentence : sentence.slice(0, at)}
      {at < 0 ? " " : null}
      {name}
      {at < 0 ? null : sentence.slice(at + quote.name.length)}
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-medium">
      <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
      {children}
    </h2>
  );
}

function Fact({
  label,
  children,
  testId,
  status,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
  status?: string;
}) {
  return (
    <p className="flex flex-col gap-px leading-tight" data-testid={testId} data-dossier-status={status}>
      <span className="text-[0.72rem] leading-tight text-muted-foreground">{label}</span>
      <span className="text-[0.95rem] leading-tight">{children}</span>
    </p>
  );
}

function shownPrice(gross: number | null, missing: string) {
  const label = quotePriceLabel(gross);
  return label === MISSING_QUOTE_PRICE ? missing : label;
}

function asPdf(file: File): File | null {
  const looksPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksPdf || file.size === 0) return null;
  if (file.type === "application/pdf") return file;
  return new File([file], file.name, { type: "application/pdf" });
}

function followUpInDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isRaamstudioProject(name: string) {
  return name.toLowerCase().endsWith(".tc-raam");
}

function isFilingCategory(value: string | null | undefined): value is DossierDocumentCategory {
  return !!value && (DOSSIER_DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

function DocumentFileLine({
  doc,
  dossierId,
  locked,
  busy,
  onDelete,
  onCategory,
}: {
  doc: DocumentFolder["files"][number];
  dossierId: string;
  locked: boolean;
  busy: boolean;
  onDelete: (file: { id: string; name: string }) => void;
  onCategory: (documentId: string, category: DossierDocumentCategory) => void;
}) {
  const t = useTranslations("Sales");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <li data-file={doc.name} className="flex items-start gap-1">
      <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      {isRaamstudioProject(doc.name) ? (
        <Link href={`/crm/raamstudio?dossier=${dossierId}`} className="min-w-0 flex-1 underline break-all" data-testid="open-raamstudio">
          {doc.name}
        </Link>
      ) : (
        <OpenStoredFile kind="document" id={doc.id} name={doc.name} className="min-w-0 flex-1 underline break-all">{doc.name}</OpenStoredFile>
      )}
      {!locked && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              disabled={busy}
              data-edit-document={doc.name}
              aria-label={t("editDossier")}
            >
              <Pencil className="size-3.5" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 space-y-2 p-3">
            <label className="block space-y-1 text-sm">
              <span>{t("category")}</span>
              <select
                aria-label={t("category")}
                data-document-category={doc.name}
                className="flex h-8 w-full rounded-md border bg-transparent px-2 text-xs"
                value={isFilingCategory(doc.category) ? doc.category : ""}
                disabled={busy}
                onChange={(event) => {
                  const next = event.target.value as DossierDocumentCategory;
                  if (!isFilingCategory(next) || next === doc.category) return;
                  setMenuOpen(false);
                  onCategory(doc.id, next);
                }}
              >
                {!isFilingCategory(doc.category) && <option value="">{t("chooseCategory")}</option>}
                {DOSSIER_DOCUMENT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>{t(`folders.${item}`)}</option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-full text-xs"
              disabled={busy}
              data-delete-document={doc.name}
              onClick={() => {
                setMenuOpen(false);
                onDelete({ id: doc.id, name: doc.name });
              }}
            >
              {t("deleteDocument")}
            </Button>
          </PopoverContent>
        </Popover>
      )}
    </li>
  );
}

function DocumentFolderRow({
  folder,
  dossierId,
  locked,
  busy,
  onDelete,
  onCategory,
}: {
  folder: DocumentFolder;
  dossierId: string;
  locked: boolean;
  busy: boolean;
  onDelete: (file: { id: string; name: string }) => void;
  onCategory: (documentId: string, category: DossierDocumentCategory) => void;
}) {
  const t = useTranslations("Sales");
  const title = folderTitle(folder.label, folder.files[0]?.category, t);
  const [open, setOpen] = useState(true);

  return (
    <li>
      <details
        open={open}
        data-folder={folder.label}
        className="group/folder"
        onToggle={(event) => {
          const next = event.currentTarget.open;
          setOpen((current) => (current === next ? current : next));
        }}
      >
        <summary
          data-folder-toggle={folder.label}
          className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1 py-1 font-medium hover:bg-muted [&::-webkit-details-marker]:hidden"
        >
          <ChevronRight className={`size-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
          <Folder className="size-4 shrink-0 text-amber-700" aria-hidden />
          <span>{title}</span>
        </summary>
        <ul className="ml-6 space-y-1 border-l py-1 pl-3">
          {folder.files.map((doc) => (
            <DocumentFileLine
              key={doc.id}
              doc={doc}
              dossierId={dossierId}
              locked={locked}
              busy={busy}
              onDelete={onDelete}
              onCategory={onCategory}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}

function WinningQuoteChoices({ quotes }: { quotes: DossierDetail["families"][number]["quotes"] }) {
  const t = useTranslations("Sales");
  const priced = quotes.filter((quote) => quoteCanWin(quote.gross));
  const defaultId = priced.length === 1 ? priced[0]?.id : "";

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("whichQuoteWon")}</legend>
      {quotes.length === 0 && <p className="text-sm text-muted-foreground">{t("noQuotes")}</p>}
      <ul className="space-y-2">
        {quotes.map((quote) => {
          const enabled = quoteCanWin(quote.gross);
          return (
            <li key={quote.id}>
              <label
                className={cn("flex items-start gap-2 rounded-md border p-2 text-sm", !enabled && "text-muted-foreground")}
                data-winning-quote={quote.id}
                data-can-win={enabled ? "yes" : "no"}
              >
                <input
                  type="radio"
                  name="accepted"
                  value={quote.id}
                  disabled={!enabled}
                  required={enabled && quote.id === priced[0]?.id}
                  defaultChecked={quote.id === defaultId}
                  className="mt-1"
                />
                <OpenStoredFile kind="document" id={quote.pdfId} name={quote.pdfName} mimeType="application/pdf" className="min-w-0 flex-1 break-all underline">{quote.pdfName}</OpenStoredFile>
                <span className="shrink-0 tabular-nums" data-winning-price={quote.id}>{shownPrice(quote.gross, t("noPrice"))}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {quotes.length > 0 && priced.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("noPricedQuote")}</p>
      )}
    </fieldset>
  );
}

function DocumentFolders({
  documents,
  dossierId,
  locked,
  busy,
  run,
}: {
  documents: DossierDetail["documents"];
  dossierId: string;
  locked: boolean;
  busy: boolean;
  run: (work: () => Promise<{ error?: string; ok?: boolean; id?: string }>) => Promise<void>;
}) {
  const t = useTranslations("Sales");
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);
  const folders = groupDocumentsIntoFolders(documents);
  if (folders.length === 0) {
    return <p className="text-muted-foreground">{t("noDocuments")}</p>;
  }

  return (
    <>
      <ul className="space-y-1">
        {folders.map((folder) => (
          <DocumentFolderRow
            key={folder.key}
            folder={folder}
            dossierId={dossierId}
            locked={locked}
            busy={busy}
            onDelete={setFileToDelete}
            onCategory={(documentId, category) => {
              void run(() => changeDossierDocumentCategoryAction(dossierId, documentId, category));
            }}
          />
        ))}
      </ul>
      <Dialog open={fileToDelete != null} onOpenChange={(open) => { if (!open) setFileToDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteDocumentTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteDocumentPrompt", { name: fileToDelete?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" data-cancel-delete-document onClick={() => setFileToDelete(null)}>
              {t("deleteDocumentNo")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              data-confirm-delete-document
              onClick={() => {
                const target = fileToDelete;
                if (!target) return;
                void run(async () => {
                  const saved = await deleteDossierDocumentAction(dossierId, target.id);
                  if (!saved.error) setFileToDelete(null);
                  return saved;
                });
              }}
            >
              {t("deleteDocumentYes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DossierPanel({
  dossier,
  pendingAttachments = [],
  promptAttachments = false,
}: {
  dossier: DossierDetail;
  pendingAttachments?: PendingOfferteboxAttachment[];
  promptAttachments?: boolean;
}) {
  const t = useTranslations("Sales");
  const router = useRouter();
  const quoteInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<DossierDocumentCategory | "">("");
  const [dragging, setDragging] = useState(false);
  const [quoteDragging, setQuoteDragging] = useState(false);
  const [priceFile, setPriceFile] = useState<{ key: string; size: number; mimeType: string; fileName: string } | null>(null);
  const [price, setPrice] = useState("");
  const [closeMode, setCloseMode] = useState<"won" | "lost" | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<{ id: string; name: string } | null>(null);
  const [filingOpen, setFilingOpen] = useState(promptAttachments && pendingAttachments.length > 0);
  const [editingProject, setEditingProject] = useState(false);
  const versions = dossier.families.flatMap((family) => family.quotes);
  const canChooseWinner = versions.some((quote) => quoteCanWin(quote.gross));

  async function run(work: () => Promise<{ error?: string; ok?: boolean; id?: string }>) {
    setBusy(true);
    setError(null);
    const result = await work();
    setBusy(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  function queueFiles(list: FileList | readonly File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    setCategory("");
    setPendingFiles(files);
  }

  async function storeQueued() {
    const files = pendingFiles;
    if (files.length === 0 || !category) return;
    const chosen = category;
    setPendingFiles([]);
    setBusy(true);
    setError(null);
    const rejected: string[] = [];
    let saved = 0;
    for (const file of files) {
      const uploaded = await uploadDocumentFile(file);
      if ("error" in uploaded) {
        rejected.push(`${file.name}: ${uploaded.error}`);
        continue;
      }
      const attached = await attachDossierDocumentAction(dossier.id, { ...uploaded, category: chosen });
      if (attached.error) {
        rejected.push(`${file.name}: ${attached.error}`);
        continue;
      }
      saved += 1;
    }
    setBusy(false);
    if (rejected.length > 0) setError(rejected.join(" "));
    if (saved > 0) router.refresh();
  }

  async function storeOfferte(file: File | undefined) {
    if (!file) return;
    const pdf = asPdf(file);
    if (!pdf) {
      setError(t("pdfOnly"));
      return;
    }
    await run(async () => {
      const uploaded = await uploadPdf(pdf);
      if ("error" in uploaded) return uploaded;
      const saved = await attachOffertePdfAction(dossier.id, uploaded);
      if ("code" in saved && saved.code === "priceRequired") {
        setPrice("");
        setPriceFile(uploaded);
        return { ok: true };
      }
      return saved;
    });
  }

  async function storeOffertePrice() {
    const file = priceFile;
    const grossTotal = price.trim();
    if (!file || !grossTotal) return;
    await run(async () => {
      const saved = await attachOffertePdfAction(dossier.id, { ...file, grossTotal });
      if (!saved.error) {
        setPriceFile(null);
        setPrice("");
      }
      return saved;
    });
  }

  function sendQuote(quoteId: string, documentId: string) {
    void run(() => markSentAction(dossier.id, {
      quoteId,
      documentId,
      followUpDate: followUpInDays(DOSSIER_FOLLOW_UP_AFTER_DAYS),
    }));
  }

  const sentOn = new Map<string, string>();
  for (const send of dossier.sends) {
    if (!sentOn.has(send.quoteId)) sentOn.set(send.quoteId, send.sentAt.slice(0, 10));
  }
  const quoteRows = dossier.families.flatMap((family) => family.quotes.map((quote) => ({
    id: quote.id,
    pdfId: quote.pdfId,
    pdfName: quote.pdfName,
    date: quote.date,
    addedAt: quote.addedAt,
    sentAt: sentOn.get(quote.id) ?? null,
    gross: quote.gross,
  })));
  const stepper = stepperForDossier(dossier);
  const acceptedPrice = dossier.status === "GEWONNEN" && dossier.acceptedQuote
    ? shownPrice(dossier.acceptedQuote.gross, t("noPrice"))
    : null;

  return (
    <div className="space-y-4">
      <section className="@container tilo-frame min-w-0 px-3 py-2" aria-label={t("status")} data-testid="dossier-bar">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0 flex-1">
            <h2 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm font-medium leading-tight">
              <span aria-hidden className="h-3.5 w-[3px] shrink-0 self-center rounded-full bg-[hsl(var(--tilo))]" />
              <span className="min-w-0 break-words">{dossier.name || t("fallbackDossier")}</span>
              {dossier.number && (
                <span className="whitespace-nowrap text-xs font-normal text-muted-foreground">{dossier.number}</span>
              )}
              <span className="min-w-0 break-words text-xs font-normal text-muted-foreground">{dossier.customer.name}</span>
            </h2>
            {dossier.status === "GEWONNEN" && dossier.acceptedQuote && (
              <AcceptedQuoteName dossier={dossier} />
            )}
          </div>
          <div className="flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
            {acceptedPrice && (
              <span className="whitespace-nowrap text-sm font-semibold tabular-nums" data-accepted-price="">{acceptedPrice}</span>
            )}
            {!dossier.terminal && (
              <>
                <Button type="button" size="sm" className="h-7 px-2.5 text-xs" disabled={busy} onClick={() => setCloseMode("won")}>{t("won")}</Button>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={busy} onClick={() => setCloseMode("lost")}>{t("lost")}</Button>
              </>
            )}
          </div>
        </div>
        <ol className="mt-1.5 flex w-full min-w-0 flex-nowrap items-center">
          {stepper.steps.map((step, index) => (
            <li key={step.id} className={cn("flex items-center", index > 0 && "flex-1")}>
              {index > 0 && <span aria-hidden className="mx-0.5 h-px min-w-1 flex-1 bg-border @min-[640px]:mx-1.5" />}
              <span
                data-step={step.id}
                data-state={step.state}
                aria-current={step.state === "current" ? "step" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[clamp(0.68rem,1.45cqw,0.8125rem)] leading-none @min-[640px]:gap-1",
                  step.state === "current" && "font-semibold",
                  step.state === "upcoming" && "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-full border text-[0.65rem] @min-[640px]:size-4",
                    step.state === "current" && "border-transparent bg-[hsl(183_42%_38%)] text-white",
                    step.state === "complete" && "border-[hsl(183_40%_72%)] bg-[hsl(183_42%_94%)] text-[hsl(183_35%_28%)]",
                    step.state === "upcoming" && "border-dashed",
                  )}
                >
                  {step.state === "complete" ? <Check className="size-3" aria-hidden /> : index + 1}
                </span>
                {t(`steps.${step.id}`)}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <Dialog open={closeMode != null} onOpenChange={(open) => { if (!open) setCloseMode(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{closeMode === "lost" ? t("lost") : t("won")}</DialogTitle>
            <DialogDescription>
              {closeMode === "lost" ? t("lostPrompt") : t("wonPrompt")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const mode = closeMode;
              if (!mode) return;
              void run(async () => {
                const saved = await changeStatusAction(dossier.id, mode === "lost"
                  ? { status: "VERLOREN", lostReason: String(data.get("lostReason") ?? "") }
                  : { status: "GEWONNEN", acceptedQuoteId: String(data.get("accepted") ?? "") });
                if (!saved.error) setCloseMode(null);
                return saved;
              });
            }}
          >
            {closeMode === "lost" ? (
              <label className="space-y-1 text-sm">
                <span>{t("lostReason")}</span>
                <Input name="lostReason" required maxLength={500} />
              </label>
            ) : (
              <WinningQuoteChoices quotes={versions} />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCloseMode(null)}>{t("cancel")}</Button>
              <Button type="submit" disabled={busy || (closeMode === "won" && !canChooseWinner)}>{t("save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <section className="grid items-start gap-4 xl:grid-cols-2">
        <div className="tilo-frame p-3 text-sm xl:col-span-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionTitle>{t("customerAndDossier")}</SectionTitle>
            {!dossier.terminal && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                data-testid="edit-dossier-project"
                onClick={() => setEditingProject(true)}
              >
                {t("editDossier")}
              </Button>
            )}
          </div>
          <div className="grid gap-x-12 gap-y-1 lg:grid-cols-2">
          <div className="space-y-1">
          <Fact label={t("customer")}><Link className="underline-offset-4 hover:underline" href={`/crm/accounts/${dossier.customer.id}`}>{dossier.customer.name}</Link></Fact>
          <Fact label={t("contactType")}>{dossier.customer.role && t.has(`roles.${dossier.customer.role}`) ? t(`roles.${dossier.customer.role}`) : "—"}</Fact>
          <Fact label={t("email")}>{dossier.customer.email ?? "—"}</Fact>
          <Fact label={t("phone")}>{dossier.customer.phone ?? "—"}</Fact>
          <Fact label={t("gsm")}>{dossier.customer.mobile ?? "—"}</Fact>
          <Fact label={t("vat")}>{dossier.customer.vat ?? "—"}</Fact>
          <Fact label={t("address")}><AddressLink address={dossier.customer.address} /></Fact>
          </div>
          <div className="space-y-1">
          <Fact label={t("projectNumber")}>{dossier.number ?? "—"}</Fact>
          <Fact label={t("projectDescription")} testId="dossier-project-description">{dossier.name ?? "—"}</Fact>
          <Fact label={t("seller")} testId="dossier-seller">{dossier.seller ?? "—"}</Fact>
          <Fact label={t("architect")}>
            {dossier.architectName
              ? `${dossier.architectName}${dossier.architectExternalId ? ` (${dossier.architectExternalId})` : ""}`
              : "—"}
          </Fact>
          <Fact label={t("projectGroup")} testId="dossier-project-group">{dossier.projectGroup && t.has(`groups.${dossier.projectGroup}`) ? t(`groups.${dossier.projectGroup}`) : "—"}</Fact>
          <Fact label={t("priceRequestDate")}>{dossier.priceRequestDate ?? dossier.requestDate ?? "—"}</Fact>
          <Fact label={t("siteAddress")}><AddressLink address={dossier.projectAddress} /></Fact>
          <Fact label={t("status")} status={stepper.currentLabel}>{(() => { const current = stepper.steps.find((step) => step.state === "current"); return current ? t(`steps.${current.id}`) : stepper.currentLabel; })()}</Fact>
          {dossier.lostReason && <p>{t("lostReasonLine", { reason: dossier.lostReason })}</p>}
          </div>
          </div>
          {editingProject && (
            <DossierProjectDialog
              dossier={dossier}
              onClose={() => setEditingProject(false)}
              onSaved={() => {
                setEditingProject(false);
                router.refresh();
              }}
            />
          )}
        </div>

        <div
          className={`tilo-frame space-y-4 p-5 text-sm ${quoteDragging ? "bg-[hsl(183_42%_97%)]" : ""}`}
          onDragOver={(event) => {
            if (dossier.terminal) return;
            event.preventDefault();
            setQuoteDragging(true);
          }}
          onDragLeave={() => setQuoteDragging(false)}
          onDrop={(event) => {
            if (dossier.terminal) return;
            event.preventDefault();
            event.stopPropagation();
            setQuoteDragging(false);
            void storeOfferte(event.dataTransfer.files[0]);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>{t("quotes")}</SectionTitle>
            {!dossier.terminal && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                aria-label={t("addQuote")}
                disabled={busy}
                onClick={() => quoteInput.current?.click()}
              >
                <Plus />
              </Button>
            )}
            <input
              ref={quoteInput}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                void storeOfferte(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          {quoteRows.length === 0 && <p className="text-muted-foreground">{t("noQuotes")}</p>}
          {quoteRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="tilo-grid w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">{t("quote")}</th>
                    <th className="pb-2 pr-3 font-medium">{t("date")}</th>
                    <th className="pb-2 pr-3 font-medium">{t("grossTotal")}</th>
                    <th className="pb-2 font-medium">{t("sent")}</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteRows.map((quote) => (
                    <tr key={quote.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <OpenStoredFile kind="document" id={quote.pdfId} name={quote.pdfName} mimeType="application/pdf" className="font-medium underline break-all">{quote.pdfName}</OpenStoredFile>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3">{quote.date}</td>
                      <td className="whitespace-nowrap py-2.5 pr-3">
                        <span
                          className={cn("tabular-nums", quote.gross == null && "text-muted-foreground")}
                          data-quote-gross={quote.id}
                          data-total-bruto=""
                        >
                          {shownPrice(quote.gross, t("noPrice"))}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {quote.sentAt ? (
                            <p>{t("sentOn", { date: quote.sentAt })}</p>
                          ) : !dossier.terminal ? (
                            <Button type="button" size="sm" disabled={busy} onClick={() => sendQuote(quote.id, quote.pdfId)}>{t("send")}</Button>
                          ) : null}
                          {!dossier.terminal && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              data-delete-quote={quote.id}
                              onClick={() => setQuoteToDelete({ id: quote.id, name: quote.pdfName })}
                            >
                              {t("deleteQuote")}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Dialog open={quoteToDelete != null} onOpenChange={(open) => { if (!open) setQuoteToDelete(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("deleteQuoteTitle")}</DialogTitle>
                <DialogDescription>
                  {t("deleteQuotePrompt", { name: quoteToDelete?.name ?? "" })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" data-cancel-delete-quote onClick={() => setQuoteToDelete(null)}>{t("cancel")}</Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  data-confirm-delete-quote
                  onClick={() => {
                    const target = quoteToDelete;
                    if (!target) return;
                    void run(async () => {
                      const saved = await deleteOfferteAction(dossier.id, target.id);
                      if (!saved.error) setQuoteToDelete(null);
                      return saved;
                    });
                  }}
                >
                  {t("deleteQuoteConfirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog
            open={priceFile != null}
            onOpenChange={(open) => {
              if (!open) {
                setPriceFile(null);
                setPrice("");
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("grossTotal")}</DialogTitle>
                <DialogDescription>
                  {priceFile
                    ? t("grossMissingFile", { file: priceFile.fileName })
                    : t("grossMissing")}
                </DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void storeOffertePrice();
                }}
              >
                <label className="space-y-1 text-sm">
                  <span>{t("grossTotal")}</span>
                  <Input
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    inputMode="decimal"
                    placeholder="0,00"
                    required
                    autoFocus
                  />
                </label>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPriceFile(null);
                      setPrice("");
                    }}
                  >
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={busy || price.trim() === ""}>{t("save")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="tilo-frame space-y-4 p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>{t("documentsTitle")}</SectionTitle>
            {pendingAttachments.length > 0 && !dossier.terminal && (
              <Button type="button" variant="secondary" data-testid="file-attachments" onClick={() => setFilingOpen(true)}>
                {t("offertebox.fileAttachments")}
              </Button>
            )}
          </div>
          {!dossier.terminal && (
            <label
              className={`flex min-h-16 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground ${dragging ? "border-[hsl(var(--tilo))] bg-[hsl(183_42%_97%)] text-foreground" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const dropped = Array.from(event.dataTransfer.files);
                if (dropped.length === 0) {
                  for (const item of Array.from(event.dataTransfer.items)) {
                    if (item.kind !== "file") continue;
                    const file = item.getAsFile();
                    if (file) dropped.push(file);
                  }
                }
                queueFiles(dropped);
              }}
            >
              {t("dropDocument")}
              <input
                className="sr-only"
                type="file"
                multiple
                accept="application/pdf,image/*,.doc,.docx,.txt"
                onChange={(event) => {
                  queueFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          )}
          <Dialog open={pendingFiles.length > 0} onOpenChange={(open) => { if (!open) setPendingFiles([]); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("chooseCategoryTitle")}</DialogTitle>
                <DialogDescription>{pendingFiles.map((file) => file.name).join(", ")}</DialogDescription>
              </DialogHeader>
              <label className="space-y-1 block text-sm">
                <span>{t("category")}</span>
                <select
                  className="flex h-9 w-full rounded-md border bg-transparent px-2"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as DossierDocumentCategory)}
                >
                  <option value="">{t("chooseCategory")}</option>
                  {DOSSIER_DOCUMENT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>{t(`folders.${item}`)}</option>
                  ))}
                </select>
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPendingFiles([])}>{t("cancel")}</Button>
                <Button type="button" disabled={!category || busy} onClick={() => void storeQueued()}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <DocumentFolders
            documents={dossier.documents}
            dossierId={dossier.id}
            locked={dossier.terminal}
            busy={busy}
            run={run}
          />
          <FileAttachmentsDialog
            dossierId={dossier.id}
            attachments={pendingAttachments}
            open={filingOpen && pendingAttachments.length > 0}
            onOpenChange={setFilingOpen}
          />
        </div>

      </section>

      <section className="tilo-frame space-y-4 p-5" aria-label={t("followUp")}>
        <SectionTitle>{t("followUp")}</SectionTitle>
        <ul className="tilo-rows text-sm">
          {dossier.channels.map((event) => (
            <li key={event.id} className="py-2">
              {event.at} · {(event.channel === "EMAIL_OFFERTE" || event.channel === "EMAIL_SELLER") ? t("followUpChannels.EMAIL_SELLER") : t.has(`followUpChannels.${event.channel}`) ? t(`followUpChannels.${event.channel}`) : followUpChannelLabel(event.channel)} · {event.seller}
              {event.original ? ` · ${t("original")}` : ""}
              {event.note ? ` · ${event.note}` : ""}
            </li>
          ))}
        </ul>
        {!dossier.terminal && (
          <form
            className="flex flex-wrap gap-2 items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              void run(async () => {
                const saved = await addChannelAction(dossier.id, {
                  channel: String(data.get("channel")) as RequestChannel,
                  date: String(data.get("date")),
                  note: String(data.get("note") ?? ""),
                });
                if (!saved.error) form.reset();
                return saved;
              });
            }}
          >
            <select name="channel" aria-label={t("channel")} className="h-9 rounded-md border bg-transparent px-2 text-sm" defaultValue="PHONE">
              {FOLLOW_UP_CHANNELS.map((item) => <option key={item} value={item}>{t(`followUpChannels.${item}`)}</option>)}
            </select>
            <Input name="date" type="date" defaultValue={today} required className="w-40" />
            <Input name="note" placeholder={t("note")} className="w-56" />
            <Button type="submit" variant="secondary" disabled={busy}>{t("addFollowUp")}</Button>
          </form>
        )}
      </section>

      <QuotePositionsSection
        dossierId={dossier.id}
        quotes={quoteRows.map((quote) => ({ pdfId: quote.pdfId, pdfName: quote.pdfName, date: quote.date, addedAt: quote.addedAt }))}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
