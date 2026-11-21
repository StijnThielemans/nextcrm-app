import { UPLOAD_EXTENSIONS } from "@/lib/upload-content-types";

async function storeOnServer(file: File) {
  const form = new FormData();
  form.set("file", file);
  const stored = await fetch("/api/upload/document", { method: "POST", body: form });
  if (!stored.ok) return { error: "Het bestand opslaan is mislukt. Controleer de opslag." };
  const body = (await stored.json()) as { key?: string; size?: number; mimeType?: string; fileName?: string };
  if (!body.key || !body.mimeType || !body.fileName || body.size == null) {
    return { error: "Het bestand opslaan is mislukt." };
  }
  return { key: body.key, size: body.size, mimeType: body.mimeType, fileName: body.fileName };
}

export async function uploadDocumentFile(file: File) {
  if (!Object.hasOwn(UPLOAD_EXTENSIONS, file.type)) return { error: "Dit bestandstype is niet toegestaan." };
  return storeOnServer(file);
}

export async function uploadPdf(file: File) {
  if (file.type !== "application/pdf") return { error: "Alleen een PDF is toegestaan." };
  return storeOnServer(file);
}
