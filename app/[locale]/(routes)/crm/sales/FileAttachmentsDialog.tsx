"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { fileOfferteboxAttachmentsAction } from "@/actions/crm/sales/actions";
import {
  DOSSIER_DOCUMENT_CATEGORIES,
  type DossierDocumentCategory,
} from "@/lib/sales/labels";
import type { PendingOfferteboxAttachment } from "@/lib/sales/offertebox-filing";

export function FileAttachmentsDialog({
  dossierId,
  attachments,
  open,
  onOpenChange,
}: {
  dossierId: string;
  attachments: PendingOfferteboxAttachment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Sales");
  const router = useRouter();
  const signature = attachments.map((file) => file.id).join("\n");
  const [seen, setSeen] = useState(signature);
  const [choices, setChoices] = useState<Record<string, DossierDocumentCategory | "">>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (seen !== signature) {
    setSeen(signature);
    setChoices({});
    setError(null);
  }

  const ready = attachments.length > 0 && attachments.every((file) => choices[file.id]);

  async function onSave() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const result = await fileOfferteboxAttachmentsAction(
      dossierId,
      attachments.map((file) => ({
        attachmentId: file.id,
        category: choices[file.id] as DossierDocumentCategory,
      })),
    );
    setBusy(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" data-testid="file-attachments-dialog">
        <DialogHeader>
          <DialogTitle>{t("offertebox.fileAttachments")}</DialogTitle>
          <DialogDescription>{t("offertebox.fileAttachmentsLead")}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {attachments.map((file) => (
            <li key={file.id} className="space-y-1">
              <p className="break-all text-sm font-medium">{file.fileName}</p>
              <label className="block space-y-1 text-sm">
                <span>{t("category")}</span>
                <select
                  className="flex h-9 w-full rounded-md border bg-transparent px-2"
                  value={choices[file.id] ?? ""}
                  data-testid="attachment-category"
                  data-file-name={file.fileName}
                  aria-label={`${t("category")} ${file.fileName}`}
                  onChange={(event) =>
                    setChoices((current) => ({
                      ...current,
                      [file.id]: event.target.value as DossierDocumentCategory | "",
                    }))
                  }
                >
                  <option value="">{t("chooseCategory")}</option>
                  {DOSSIER_DOCUMENT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>{t(`folders.${item}`)}</option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" disabled={!ready || busy} data-testid="file-attachments-save" onClick={() => void onSave()}>
            {busy ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
