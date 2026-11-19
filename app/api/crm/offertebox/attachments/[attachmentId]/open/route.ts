import { NextRequest, NextResponse } from "next/server";
import {
  AuthenticationError,
  notFoundOrForbiddenResponse,
  requireAuthenticated,
  unauthorizedResponse,
} from "@/lib/authz";
import { mintOpenUrl } from "@/lib/documents/open-token";
import { prismadb } from "@/lib/prisma";
import { isOfferteboxStorageKey } from "@/lib/sales/offertebox-mail";
import { MINIO_BUCKET } from "@/lib/minio";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
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
    select: { file_name: true, content_type: true, storage_key: true, is_image: true },
  });
  if (!attachment || !isOfferteboxStorageKey(attachment.storage_key) || !MINIO_BUCKET) {
    return notFoundOrForbiddenResponse();
  }

  const link = mintOpenUrl(
    request,
    `/api/crm/offertebox/attachments/${attachmentId}`,
    attachment.file_name,
    attachment.content_type,
    "attachment",
    attachmentId,
    attachment.is_image,
  );
  return NextResponse.json(link, { headers: { "Cache-Control": "private, no-store" } });
}
