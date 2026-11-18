"use server";
import {
  requireAuthenticated,
  assertCanWriteAccount,
  assertCanWriteOpportunity,
  AuthenticationError,
  AuthorizationError,
} from "@/lib/authz";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { newDocumentFile } from "@/lib/documents/new-document-file";

interface CreateDocumentInput {
  name: string;
  key: string;
  size: number;
  mimeType: string;
  contentHash?: string;
  accountId?: string;
  dossierId?: string;
  systemType?: "INTERNAL_SUPPLIER_QUOTE" | "CUSTOMER_QUOTE" | "PLAN" | "PHOTO" | "OTHER";
}

export async function createDocument(input: CreateDocumentInput) {
  let user;
  try {
    user = await requireAuthenticated();
  } catch (e) {
    if (e instanceof AuthenticationError) throw new Error("Unauthorized");
    throw e;
  }

  if (input.systemType === "INTERNAL_SUPPLIER_QUOTE" && user.role === "partner") {
    throw new Error("Forbidden");
  }

  if (input.accountId) {
    try {
      await assertCanWriteAccount(user, input.accountId);
    } catch (e) {
      if (e instanceof AuthorizationError) throw new Error("Forbidden");
      throw e;
    }
  }

  if (input.dossierId) {
    try {
      await assertCanWriteOpportunity(user, input.dossierId);
    } catch (e) {
      if (e instanceof AuthorizationError) throw new Error("Forbidden");
      throw e;
    }
  }

  const file = await newDocumentFile(input.key);

  const document = await prismadb.documents.create({
    data: {
      v: 0,
      document_name: input.name,
      description: "new document",
      ...file,
      size: input.size,
      document_file_mimeType: input.mimeType,
      content_hash: input.contentHash ?? null,
      processing_status: "PENDING",
      createdBy: user.id,
      assigned_user: user.id,
      ...(input.systemType ? { document_system_type: input.systemType } : {}),
      ...(input.accountId
        ? { accounts: { create: { account_id: input.accountId } } }
        : {}),
      ...(input.dossierId
        ? { opportunities: { create: { opportunity_id: input.dossierId } } }
        : {}),
    },
  });

  await inngest.send({
    name: "document/uploaded",
    data: { documentId: document.id },
  });

  revalidatePath("/[locale]/(routes)/documents");
  return document;
}
