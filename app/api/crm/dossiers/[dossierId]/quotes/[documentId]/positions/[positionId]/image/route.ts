import { NextRequest, NextResponse } from "next/server";
import {
  AuthenticationError,
  requireAuthenticated,
  unauthorizedResponse,
  notFoundOrForbiddenResponse,
} from "@/lib/authz";
import { SalesError } from "@/lib/sales/errors";
import { quotePositionPng } from "@/lib/sales/quote-position-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dossierId: string; documentId: string; positionId: string }> },
) {
  const { dossierId, documentId, positionId } = await params;
  let user;
  try {
    user = await requireAuthenticated();
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    throw error;
  }
  try {
    const png = await quotePositionPng(user, dossierId, documentId, positionId);
    if (!png) return notFoundOrForbiddenResponse();
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof SalesError) return notFoundOrForbiddenResponse();
    console.error("[sales] quote position image failed", error instanceof Error ? error.name + ": " + error.message.slice(0, 240) : "unknown");
    return notFoundOrForbiddenResponse();
  }
}
