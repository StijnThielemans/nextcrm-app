import { NextRequest, NextResponse } from "next/server";
import {
  AuthenticationError,
  AuthorizationError,
  assertCanReadDocument,
  notFoundOrForbiddenResponse,
  requireAuthenticated,
  unauthorizedResponse,
} from "@/lib/authz";
import { mintOpenUrl } from "@/lib/documents/open-token";
import { prismaBase } from "@/lib/prisma-base";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  let user;
  try {
    user = await requireAuthenticated({ partner: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    throw error;
  }

  try {
    await assertCanReadDocument(user, documentId);
  } catch (error) {
    if (error instanceof AuthorizationError) return notFoundOrForbiddenResponse();
    throw error;
  }

  const doc = await prismaBase.documents.findUnique({
    where: { id: documentId },
    select: { document_name: true, document_file_mimeType: true },
  });
  if (!doc) return notFoundOrForbiddenResponse();

  const link = mintOpenUrl(
    request,
    `/api/documents/${documentId}/file`,
    doc.document_name,
    doc.document_file_mimeType,
    "document",
    documentId,
  );
  return NextResponse.json(link, { headers: { "Cache-Control": "private, no-store" } });
}
