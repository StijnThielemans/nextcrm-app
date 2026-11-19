import { NextRequest, NextResponse } from "next/server";
import {
  AuthenticationError,
  requireAuthenticated,
  unauthorizedResponse,
  notFoundOrForbiddenResponse,
} from "@/lib/authz";
import { SalesError } from "@/lib/sales/errors";
import { listQuotePositions } from "@/lib/sales/quote-position-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dossierId: string; documentId: string }> },
) {
  const { dossierId, documentId } = await params;
  let user;
  try {
    user = await requireAuthenticated();
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    throw error;
  }
  try {
    const positions = await listQuotePositions(user, dossierId, documentId);
    return NextResponse.json({ positions });
  } catch (error) {
    if (error instanceof SalesError) return notFoundOrForbiddenResponse();
    console.error("[sales] quote positions failed", error instanceof Error ? error.name + ": " + error.message.slice(0, 240) : "unknown");
    return NextResponse.json({ positions: [] }, { status: 500 });
  }
}
