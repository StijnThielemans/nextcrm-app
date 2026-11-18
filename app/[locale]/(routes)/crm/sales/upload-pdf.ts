export async function uploadPdf(file: File) {
  if (file.type !== "application/pdf") return { error: "Alleen een PDF is toegestaan." };
  const prepared = await fetch("/api/upload/presigned-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: "application/pdf",
      folder: "documents",
    }),
  });
  if (!prepared.ok) return { error: "Het bestand kon niet worden voorbereid. Controleer de opslag." };
  const body = (await prepared.json()) as { presignedUrl?: string; key?: string };
  if (!body.presignedUrl || !body.key) return { error: "Het bestand kon niet worden voorbereid." };
  const put = await fetch(body.presignedUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": "application/pdf" },
  });
  if (!put.ok) return { error: "Het bestand opslaan is mislukt." };
  return { key: body.key, size: file.size, mimeType: "application/pdf", fileName: file.name };
}
