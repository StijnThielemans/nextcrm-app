"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { documentFileRoute } from "@/lib/documents/file-key";
import { fileLaunch, fileOpenDestination, fileUrlOnPage, isFileLaunch, isHttpUrl } from "@/lib/documents/open-file";

type OpenKind = "document" | "attachment";

function mintPath(kind: OpenKind, id: string): string {
  return kind === "document"
    ? `/api/documents/${id}/open`
    : `/api/crm/offertebox/attachments/${id}/open`;
}

function fallbackHref(kind: OpenKind, id: string, name: string, mimeType: string | null | undefined, image: boolean): string {
  if (kind === "document") return documentFileRoute(id);
  const launch = fileLaunch(name, mimeType, image);
  const base = `/api/crm/offertebox/attachments/${id}`;
  // PDF, images and Office open in the browser or in Office. Only an unknown type downloads.
  return launch === "download" ? `${base}?download=1` : base;
}

function showInNewTab(url: string, tab: Window | null) {
  if (tab && !tab.closed) {
    try {
      tab.location.replace(url);
      return;
    } catch {
      tab.close();
    }
  }
  window.open(url, "_blank");
}

export function OpenStoredFile({
  kind,
  id,
  name,
  mimeType,
  image = false,
  className,
  testId,
  children,
}: {
  kind: OpenKind;
  id: string;
  name: string;
  mimeType?: string | null;
  image?: boolean;
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const href = fallbackHref(kind, id, name, mimeType, image);

  async function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (pending) {
      event.preventDefault();
      return;
    }
    // Open the tab in this click. A later window.open is blocked, and this page must stay.
    const tab = window.open("about:blank", "_blank");
    if (!tab) return;
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch(mintPath(kind, id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("open failed");
      const body = (await response.json()) as { url?: unknown; launch?: unknown };
      if (typeof body.url !== "string" || !isHttpUrl(body.url) || !isFileLaunch(body.launch)) {
        throw new Error("open failed");
      }
      const onPage = fileUrlOnPage(body.url, window.location.origin);
      showInNewTab(fileOpenDestination(body.launch, onPage), tab);
    } catch {
      showInNewTab(fileUrlOnPage(href, window.location.origin), tab);
    } finally {
      setPending(false);
    }
  }

  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      onClick={(event) => void onClick(event)}
    >
      {children}
    </a>
  );
}
