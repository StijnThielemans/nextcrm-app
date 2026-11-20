import { createHash } from "node:crypto";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

import {
  AuthenticationError,
  AuthorizationError,
  assertCanReadDocument,
  notFoundOrForbiddenResponse,
  requireAuthenticated,
  unauthorizedResponse,
} from "@/lib/authz";
import { isDocumentKey, isUploadThingUrl, keyFromUrl } from "@/lib/documents/file-key";
import { MINIO_BUCKET, MINIO_ENDPOINT, MINIO_PUBLIC_URL, minioClient } from "@/lib/minio";
import { prismaBase } from "@/lib/prisma-base";
import { renderPlanPage } from "@/lib/raamstudio/render-plan-page";

export const runtime = "nodejs";

const cache = new Map<string, { png: Buffer; pages: number }>();

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuthenticated();
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    throw error;
  }

  const documentId = request.nextUrl.searchParams.get("documentId") ?? "";
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  if (!documentId || !Number.isInteger(page) || page < 1 || page > 400) {
    return NextResponse.json({ error: "Die pagina bestaat niet." }, { status: 400 });
  }

  try {
    await assertCanReadDocument(user, documentId);
  } catch (error) {
    if (error instanceof AuthorizationError) return notFoundOrForbiddenResponse();
    throw error;
  }

  const doc = await prismaBase.documents.findUnique({
    where: { id: documentId },
    select: { key: true, document_file_url: true, document_name: true, document_file_mimeType: true },
  });
  if (!doc) return notFoundOrForbiddenResponse();
  const pdf = doc.document_file_mimeType === "application/pdf" || doc.document_name.toLowerCase().endsWith(".pdf");
  if (!pdf) return NextResponse.json({ error: "Dit is geen PDF-plan." }, { status: 415 });

  let bytes: Buffer;
  try {
    bytes = await documentBytes(doc);
  } catch {
    return notFoundOrForbiddenResponse();
  }

  const key = `${documentId}:${page}:${createHash("sha1").update(bytes).digest("hex").slice(0, 16)}`;
  const cached = cache.get(key);
  const rendered = cached ?? await renderPlanPage(bytes, page).catch(() => null);
  if (!rendered) return NextResponse.json({ error: "De tekening kon niet worden geopend." }, { status: 422 });
  if (!cached) {
    cache.set(key, rendered);
    while (cache.size > 8) {
      const oldest = cache.keys().next().value;
      if (!oldest) break;
      cache.delete(oldest);
    }
  }

  return new NextResponse(new Uint8Array(rendered.png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
      "X-Plan-Pages": String(rendered.pages),
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function documentBytes(doc: {
  key: string | null;
  document_file_url: string;
  document_name: string;
}): Promise<Buffer> {
  if (isUploadThingUrl(doc.document_file_url)) {
    const response = await fetch(doc.document_file_url);
    if (!response.ok) throw new Error("missing");
    return Buffer.from(await response.arrayBuffer());
  }
  const key = doc.key || keyFromUrl(doc.document_file_url, MINIO_BUCKET!, [MINIO_PUBLIC_URL, MINIO_ENDPOINT!]);
  if (!key || !isDocumentKey(key) || !MINIO_BUCKET) throw new Error("missing");
  const object = await minioClient.send(new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key }));
  if (!object.Body) throw new Error("missing");
  const chunks: Buffer[] = [];
  for await (const chunk of object.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
