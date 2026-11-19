import { NextRequest, NextResponse } from "next/server";
import {
  AuthenticationError,
  AuthorizationError,
  notFoundOrForbiddenResponse,
  requireAuthenticated,
  unauthorizedResponse,
} from "@/lib/authz";
import { assertCanReadOpportunity } from "@/lib/authz/scopes/crm";
import { prismadb } from "@/lib/prisma";
import { logikalDrawingStore } from "@/lib/sales/logikal/drawings";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dossierId: string; positionId: string }> },
) {
  const { dossierId, positionId } = await params;
  let user;
  try {
    user = await requireAuthenticated();
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    throw error;
  }
  if (user.role === "partner") return notFoundOrForbiddenResponse();
  try {
    await assertCanReadOpportunity(user, dossierId);
  } catch (error) {
    if (error instanceof AuthorizationError) return notFoundOrForbiddenResponse();
    throw error;
  }

  const position = await prismadb.crm_LogikalPositions.findFirst({
    where: {
      id: positionId,
      dossier_id: dossierId,
      dossier: { is_dossier: true, deletedAt: null },
    },
    select: { drawing_key: true, drawing_mime: true, drawing_name: true },
  });
  const key = position?.drawing_key;
  if (!key || !key.startsWith(`logikal/${dossierId}/`)) return notFoundOrForbiddenResponse();

  try {
    const bytes = await logikalDrawingStore.read(key);
    const fileName = (position.drawing_name ?? "drawing").replace(/["\r\n]/g, "");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": position.drawing_mime || "application/octet-stream",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFoundOrForbiddenResponse();
  }
}
