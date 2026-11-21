import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import {
  AuthenticationError,
  requireAuthenticated,
  unauthorizedResponse,
  notFoundOrForbiddenResponse,
} from "@/lib/authz";
import { prismadb } from "@/lib/prisma";
import { MINIO_BUCKET, minioClient } from "@/lib/minio";
import { desktopOpenHeaders } from "@/lib/documents/open-file";
import { verifyOpenToken } from "@/lib/documents/open-token";
import { inlineAttachmentType } from "@/lib/sales/aanvraag-mail";
import { attachmentDisposition, imageContentType, isOfferteboxStorageKey } from "@/lib/sales/offertebox-mail";

export async function GET(request: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await params;
  const open = request.nextUrl.searchParams.get("open");
  let openedByToken = false;
  if (open) {
    try {
      openedByToken = verifyOpenToken(open, "attachment", attachmentId);
    } catch {
      openedByToken = false;
    }
  }
  if (!openedByToken) {
    try {
      const user = await requireAuthenticated();
      if (user.role === "partner") return notFoundOrForbiddenResponse();
    } catch (error) {
      if (error instanceof AuthenticationError) return unauthorizedResponse();
      throw error;
    }
  }

  const attachment = await prismadb.crm_OfferteboxAttachments.findUnique({
    where: { id: attachmentId },
    select: { file_name: true, content_type: true, storage_key: true, is_image: true },
  });
  if (!attachment || !isOfferteboxStorageKey(attachment.storage_key) || !MINIO_BUCKET) {
    return notFoundOrForbiddenResponse();
  }

  const object = await minioClient.send(
    new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: attachment.storage_key }),
  );
  if (!object.Body) return notFoundOrForbiddenResponse();
  const bytes = Buffer.from(await object.Body.transformToByteArray());
  const image = attachment.is_image ? imageContentType(bytes) : null;
  const desktop = openedByToken
    ? desktopOpenHeaders(attachment.file_name, image ?? attachment.content_type, { isImage: image !== null })
    : null;
  const inlineType = inlineAttachmentType(image, bytes);
  const download = request.nextUrl.searchParams.get("download") === "1";
  const inline = desktop ? true : inlineType !== null && !download;
  const headers: Record<string, string> = {
    "Content-Type": desktop?.contentType ?? inlineType ?? "application/octet-stream",
    "Content-Disposition": attachmentDisposition(attachment.file_name, inline),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
  if (openedByToken) headers["Referrer-Policy"] = "no-referrer";

  return new NextResponse(new Uint8Array(bytes), { headers });
}
