"use server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { pluginRuleErrorMessage } from "@/lib/plugins/action-errors";
import { inngest } from "@/inngest/client";
import { writeAuditLog, diffObjects } from "@/lib/audit-log";
import {
  requireAuthenticated,
  assertCanWriteAccount,
  assertAssignableUser,
  PARTNER_EDIT,
  AuthenticationError,
  AuthorizationError,
} from "@/lib/authz";
import type { AccountRole } from "@/lib/sales/aanvraag-fields";
import { SALES_ERROR_TEXT } from "@/lib/sales/labels";

function customerContactPatch(data: {
  office_phone?: string | null;
  mobile_phone?: string | null;
  vat?: string | null;
}): { error: string } | { office_phone?: string | null; mobile_phone?: string | null; vat?: string | null } {
  const patch: { office_phone?: string | null; mobile_phone?: string | null; vat?: string | null } = {};
  if (data.office_phone !== undefined && data.mobile_phone !== undefined) {
    const office = (data.office_phone ?? "").trim();
    const mobile = (data.mobile_phone ?? "").trim();
    if (!office && !mobile) return { error: SALES_ERROR_TEXT.phoneOrMobileRequired };
    patch.office_phone = office || null;
    patch.mobile_phone = mobile || null;
  }
  if (data.vat !== undefined) patch.vat = (data.vat ?? "").trim() || null;
  return patch;
}

function accountType(role: AccountRole | undefined) {
  if (role === "SUPPLIER") return "Supplier";
  if (role === "BOTH") return "Customer and supplier";
  if (role === "CUSTOMER") return "Customer";
  return undefined;
}

export const updateAccount = async (data: {
  id: string;
  name?: string;
  account_role?: AccountRole;
  mobile_phone?: string | null;
  tax_rate_id?: string | null;
  office_phone?: string | null;
  website?: string | null;
  fax?: string | null;
  company_id?: string;
  vat?: string | null;
  email?: string;
  billing_street?: string;
  billing_postal_code?: string;
  billing_city?: string;
  billing_state?: string | null;
  billing_country?: string;
  shipping_street?: string | null;
  shipping_postal_code?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_country?: string | null;
  description?: string | null;
  assigned_to?: string;
  status?: string | null;
  annual_revenue?: string | null;
  member_of?: string | null;
  industry?: string;
  pricelist_id?: string | null;
}) => {
  const { id, ...rest } = data;
  if (!id) return { error: "id is required" };

  let user;
  try {
    user = await requireAuthenticated({ partner: true });
  } catch (e) {
    if (e instanceof AuthenticationError) return { error: "Unauthorized" };
    throw e;
  }
  try {
    await assertCanWriteAccount(user, id, PARTNER_EDIT);
  } catch (e) {
    if (e instanceof AuthorizationError) return { error: "Forbidden" };
    throw e;
  }

  const before = await prismadb.crm_Accounts.findUnique({ where: { id, deletedAt: null } });
  // Ids from the input, as in createAccount. The form resends the stored
  // assignee, so it is checked only when it changes; a partner's assigned_to
  // is ignored below.
  try {
    if (rest.assigned_to && user.role !== "partner" && rest.assigned_to !== before?.assigned_to) {
      await assertAssignableUser(user, rest.assigned_to);
    }
  } catch (e) {
    if (e instanceof AuthorizationError) return { error: "Forbidden" };
    throw e;
  }
  if (rest.pricelist_id) {
    const pricelist = await prismadb.crm_PriceLists.findUnique({ where: { id: rest.pricelist_id }, select: { id: true } });
    if (!pricelist) return { error: "Price list not found" };
  }
  if (rest.tax_rate_id) {
    const taxRate = await prismadb.invoice_TaxRates.findFirst({ where: { id: rest.tax_rate_id, active: true }, select: { id: true } });
    if (!taxRate) return { error: "Belastingstarief niet gevonden" };
  }
  const contact = customerContactPatch(rest);
  if ("error" in contact) return contact;

  try {
    const account = await prismadb.crm_Accounts.update({
      where: { id },
      data: {
        v: 0,
        updatedBy: user.id,
        ...rest,
        ...contact,
        ...(rest.pricelist_id === "" ? { pricelist_id: null } : {}),
        // The partner is set only through setAccountPartner (admin/manager).
        partnerUserId: undefined,
        // A partner edits ordinary fields only, never the internal owner.
        ...(user.role === "partner" ? { assigned_to: undefined } : {}),
        ...(accountType(rest.account_role) ? { type: accountType(rest.account_role) } : {}),
      },
    });
    const changes = before ? diffObjects(
      before as Record<string, unknown>,
      account as Record<string, unknown>
    ) : null;
    await writeAuditLog({
      entityType: "account",
      entityId: account.id,
      action: "updated",
      changes,
      userId: user.id,
    });
    void inngest.send({ name: "crm/account.saved", data: { record_id: account.id } });
    revalidatePath("/[locale]/(routes)/crm/accounts", "page");
    return { data: account };
  } catch (error) {
    const ruleMessage = await pluginRuleErrorMessage(error);
    if (ruleMessage) return { error: ruleMessage };
    console.log("[UPDATE_ACCOUNT]", error);
    return { error: "Failed to update account" };
  }
};
