import { GetObjectCommand } from "@aws-sdk/client-s3";
import { isDocumentKey } from "@/lib/documents/file-key";
import { MINIO_BUCKET, minioClient } from "@/lib/minio";
import { extractGrossTotal } from "./gross-total";

async function pdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

/** Gross total from a PDF already stored by the upload route, or null. */
export async function grossTotalFromStoredPdf(key: string): Promise<string | null> {
  if (!isDocumentKey(key) || !MINIO_BUCKET) return null;
  const response = await minioClient.send(
    new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }),
  );
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const text = await pdfText(Buffer.concat(chunks));
  return extractGrossTotal(text);
}
