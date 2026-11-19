"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { documentFileRoute } from "@/lib/documents/file-key";
import { fileLaunch, isFileLaunch, isHttpUrl, officeProtocol } from "@/lib/documents/open-file";

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
  return launch === "pdf" || launch === "image" ? base : `${base}?download=1`;
}

function handoff(launch: ReturnType<typeof fileLaunch>, url: string, tab: Window | null) {
  const protocol = officeProtocol(launch, url);
  if (protocol) {
    tab?.close();
    const anchor = document.createElement("a");
    anchor.href = protocol;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }
  if (launch === "download") {
    tab?.close();
    window.location.assign(url);
    return;
  }
  if (tab) {
    tab.location.replace(url);
    return;
  }
  window.location.assign(url);
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
    event.preventDefault();
    if (pending) return;
    const predicted = fileLaunch(name, mimeType, image);
    const tab = predicted === "word" || predicted === "excel" || predicted === "powerpoint"
      ? null
      : window.open("about:blank", "_blank");
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
      handoff(body.launch, body.url, tab);
    } catch {
      tab?.close();
      window.location.assign(href);
    } finally {
      setPending(false);
    }
  }

  return (
    <a className={className} href={href} data-testid={testId} onClick={(event) => void onClick(event)}>
      {children}
    </a>
  );
}
