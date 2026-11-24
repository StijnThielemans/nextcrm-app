import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { AuthzUser } from "@/lib/authz/session";
import { AuthorizationError } from "@/lib/authz/errors";
import { assertCanReadOpportunity } from "@/lib/authz/scopes/crm";
import { isDocumentKey, keyFromUrl } from "@/lib/documents/file-key";
import { MINIO_BUCKET, MINIO_ENDPOINT, MINIO_PUBLIC_URL, minioClient } from "@/lib/minio";
import { prismadb } from "@/lib/prisma";
import { SalesError } from "./errors";
import { positionsInQuotePdf, renderQuotePosition } from "./quote-position-pdf";
import type { QuotePositionBlock, QuotePositionView } from "./quote-positions";

export type { QuotePositionView };

function denyPartner(user: AuthzUser) {
  if (user.role === "partner") throw new SalesError("forbidden");
}

async function quotePdfBytes(user: AuthzUser, dossierId: string, documentId: string): Promise<Buffer> {
  denyPartner(user);
  try {
    await assertCanReadOpportunity(user, dossierId);
  } catch (error) {
    if (error instanceof AuthorizationError) throw new SalesError("forbidden");
    throw error;
  }
  if (!/^[0-9a-f-]{36}$/i.test(documentId)) throw new SalesError("notFound");
  const quote = await prismadb.crm_ExternalQuotes.findFirst({
    where: {
      deletedAt: null,
      pdf_document_id: documentId,
      family: { dossier_id: dossierId },
      pdf: { deletedAt: null },
    },
    select: {
      pdf: {
        select: {
          key: true,
          document_file_url: true,
          document_file_mimeType: true,
          document_name: true,
        },
      },
    },
  });
  const pdf = quote?.pdf;
  if (!pdf) throw new SalesError("notFound");
  const namedPdf = pdf.document_name.toLowerCase().endsWith(".pdf");
  if (pdf.document_file_mimeType !== "application/pdf" && !namedPdf) throw new SalesError("notFound");
  const key = pdf.key || keyFromUrl(pdf.document_file_url, MINIO_BUCKET!, [MINIO_PUBLIC_URL, MINIO_ENDPOINT!]);
  if (!key || !isDocumentKey(key) || !MINIO_BUCKET) throw new SalesError("notFound");
  const response = await minioClient.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function viewOf(block: QuotePositionBlock): QuotePositionView {
  return {
    id: block.id,
    pageNumber: block.pageNumber,
    number: block.number,
    title: block.title,
    quantity: block.quantity,
    price: block.price,
    text: block.text,
  };
}

export async function listQuotePositions(
  user: AuthzUser,
  dossierId: string,
  documentId: string,
): Promise<QuotePositionView[]> {
  const bytes = await quotePdfBytes(user, dossierId, documentId);
  const positions = await positionsInQuotePdf(documentId, bytes);
  return positions.map(viewOf);
}

export async function quotePositionPng(
  user: AuthzUser,
  dossierId: string,
  documentId: string,
  positionId: string,
): Promise<Buffer | null> {
  if (!/^\d{1,4}$/.test(positionId)) return null;
  const bytes = await quotePdfBytes(user, dossierId, documentId);
  return renderQuotePosition(documentId, bytes, positionId);
}
