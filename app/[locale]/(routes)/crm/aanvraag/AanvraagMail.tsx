"use client";

import { useLocale, useTranslations } from "next-intl";
import { OpenStoredFile } from "@/components/files/OpenStoredFile";
import { mailPanelBody } from "@/lib/sales/aanvraag-mail";
import type { OfferteboxMailAside } from "@/lib/sales/offertebox";

const DATE_LOCALE: Record<string, string> = { cz: "cs" };

export function AanvraagMail({ mail }: { mail: OfferteboxMailAside }) {
  const t = useTranslations("Sales");
  const locale = useLocale();
  const when = new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
    timeZone: "Europe/Brussels",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const body = mailPanelBody(mail.html, mail.body);
  const sender = mail.fromName || mail.fromEmail || "—";

  return (
    <aside
      aria-label={t("offertebox.originalMail")}
      data-testid="aanvraag-mail"
      className="tilo-frame flex select-text flex-col p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-hidden [&_*]:select-text"
    >
      <div className="shrink-0">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        <span aria-hidden className="size-1.5 rounded-full bg-[hsl(var(--tilo))]" />
        {t("offertebox.originalMail")}
      </h2>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium" data-testid="aanvraag-mail-from">{sender}</p>
          {mail.fromEmail && mail.fromEmail !== mail.fromName && (
            <p className="text-sm text-muted-foreground">{mail.fromEmail}</p>
          )}
        </div>
        <time className="shrink-0 text-sm text-muted-foreground" dateTime={mail.receivedAt}>
          {when.format(new Date(mail.receivedAt))}
        </time>
      </div>
      <h3 className="mt-3 font-medium" data-testid="aanvraag-mail-subject">{mail.subject}</h3>
      {mail.attachments.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">{t("offertebox.attachments")}</p>
          <ul className="mt-1 space-y-1">
            {mail.attachments.map((attachment) => (
              <li key={attachment.id}>
                <OpenStoredFile
                  kind="attachment"
                  id={attachment.id}
                  name={attachment.fileName}
                  mimeType={attachment.contentType}
                  image={attachment.isImage}
                  className="underline"
                  testId="aanvraag-mail-attachment"
                >
                  {attachment.fileName}
                </OpenStoredFile>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
      {body.kind === "html" ? (
        <div
          className="mt-3 break-words text-sm leading-relaxed lg:min-h-0 lg:flex-1 lg:overflow-y-auto [&_a]:underline [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_p]:mb-2 [&_table]:max-w-full"
          data-testid="aanvraag-mail-body"
          dangerouslySetInnerHTML={{ __html: body.value }}
        />
      ) : body.kind === "text" ? (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed lg:min-h-0 lg:flex-1 lg:overflow-y-auto" data-testid="aanvraag-mail-body">
          {body.value}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="aanvraag-mail-body">{t("offertebox.noBody")}</p>
      )}
    </aside>
  );
}
