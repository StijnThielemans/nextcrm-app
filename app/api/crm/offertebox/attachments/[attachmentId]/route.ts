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
import { inlineAttachmentType } from "@/lib/sales/aanvraag-mail";
import { attachmentDisposition, imageContentType, isOfferteboxStorageKey } from "@/lib/sales/offertebox-mail";

export async function GET(request: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  try {
    const user = await requireAuthenticated();
    if (user.role === "partner") return notFoundOrForbiddenResponse();
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    throw error;
  }

  const { attachmentId } = await params;
  const attachment = await prismadb.crm_OfferteboxAttachments.findUnique({
    where: { id: attachmentId },
    select: { file_name: true, storage_key: true, is_image: true },
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
  const inlineType = inlineAttachmentType(image, bytes);
  const download = request.nextUrl.searchParams.get("download") === "1";
  const inline = inlineType !== null && !download;

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": inlineType ?? "application/octet-stream",
      "Content-Disposition": attachmentDisposition(attachment.file_name, inline),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
