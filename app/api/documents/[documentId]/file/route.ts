import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import {
  requireAuthenticated,
  assertCanReadDocument,
  unauthorizedResponse,
  notFoundOrForbiddenResponse,
  AuthenticationError,
  AuthorizationError,
} from "@/lib/authz";
import { prismaBase } from "@/lib/prisma-base";
import { MINIO_BUCKET, MINIO_ENDPOINT, MINIO_PUBLIC_URL, minioClient } from "@/lib/minio";
import {
  documentContentDisposition,
  inlineDocumentType,
  isDocumentKey,
  isUploadThingUrl,
  keyFromUrl,
} from "@/lib/documents/file-key";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;
  let user;
  try {
    user = await requireAuthenticated({ partner: true });
  } catch (e) {
    if (e instanceof AuthenticationError) return unauthorizedResponse();
    throw e;
  }

  try {
    await assertCanReadDocument(user, documentId);
  } catch (e) {
    if (e instanceof AuthorizationError) return notFoundOrForbiddenResponse();
    throw e;
  }

  // prismaBase: prismadb maps document_file_url to this route for clients.
  const doc = await prismaBase.documents.findUnique({
    where: { id: documentId },
    select: { key: true, document_file_url: true, document_name: true, document_file_mimeType: true },
  });
  if (!doc) return notFoundOrForbiddenResponse();

  if (isUploadThingUrl(doc.document_file_url)) {
    // Not in our bucket: the old host still serves it.
    return NextResponse.redirect(doc.document_file_url);
  }

  const key =
    doc.key ||
    keyFromUrl(doc.document_file_url, MINIO_BUCKET!, [MINIO_PUBLIC_URL, MINIO_ENDPOINT!]);
  if (!key || !isDocumentKey(key) || !MINIO_BUCKET) return notFoundOrForbiddenResponse();

  // Same origin as the page. A redirect to the bucket host is unreachable
  // for anyone who is not on the storage machine, so the click never opens.
  let object;
  try {
    object = await minioClient.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
  } catch {
    return notFoundOrForbiddenResponse();
  }
  if (!object.Body) return notFoundOrForbiddenResponse();

  const inlineType = inlineDocumentType(doc.document_file_mimeType);
  const headers = new Headers({
    "Content-Type": inlineType ?? "application/octet-stream",
    "Content-Disposition": documentContentDisposition(doc.document_name, inlineType != null),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });
  if (object.ContentLength != null) headers.set("Content-Length", String(object.ContentLength));

  return new NextResponse(object.Body.transformToWebStream(), { headers });
}
