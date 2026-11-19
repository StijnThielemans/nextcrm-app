"use server";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { pluginRuleErrorMessage } from "@/lib/plugins/action-errors";
import { inngest } from "@/inngest/client";
import { writeAuditLog } from "@/lib/audit-log";
import {
  requireAuthenticated,
  assertAssignableUser,
  AuthenticationError,
  AuthorizationError,
} from "@/lib/authz";
import { parseVatChoice, type AccountRole, type VatChoice } from "@/lib/sales/aanvraag-fields";
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

function vatChoicePatch(value: string | null | undefined): { error: string } | { vat_choice?: VatChoice } {
  const parsed = parseVatChoice(value);
  if (parsed === null) return { error: SALES_ERROR_TEXT.vatChoiceRequired };
  if (parsed === undefined) return {};
  return { vat_choice: parsed };
}

function accountType(role: AccountRole | undefined) {
  if (role === "SUPPLIER") return "Supplier";
  if (role === "BOTH") return "Customer and supplier";
  if (role === "CUSTOMER") return "Customer";
  return undefined;
}

export const createAccount = async (data: {
  name: string;
  account_role?: AccountRole;
  mobile_phone?: string | null;
  tax_rate_id?: string;
  vat_choice?: string | null;
  office_phone?: string | null;
  website?: string;
  fax?: string;
  company_id?: string;
  vat?: string | null;
  email?: string;
  billing_street?: string;
  billing_postal_code?: string;
  billing_city?: string;
  billing_state?: string;
  billing_country?: string;
  shipping_street?: string;
  shipping_postal_code?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_country?: string;
  description?: string;
  assigned_to?: string;
  status?: string;
  annual_revenue?: string;
  member_of?: string;
  industry?: string;
  pricelist_id?: string | null;
}) => {
  // Plain create: the row is owned by its creator, so no object-level write
  // assert on the new row; the ids it points at are checked below.
  let user;
  try {
    user = await requireAuthenticated({ partner: true });
  } catch (e) {
    if (e instanceof AuthenticationError) return { error: "Unauthorized" };
    throw e;
  }

  const { name } = data;
  if (!name) return { error: "name is required" };

  // Ids from the input: the assignee must be assignable (a partner's is
  // ignored below), the price list real. member_of is a free-text label.
  try {
    if (data.assigned_to && user.role !== "partner") await assertAssignableUser(user, data.assigned_to);
  } catch (e) {
    if (e instanceof AuthorizationError) return { error: "Forbidden" };
    throw e;
  }
  if (data.pricelist_id) {
    const pricelist = await prismadb.crm_PriceLists.findUnique({ where: { id: data.pricelist_id }, select: { id: true } });
    if (!pricelist) return { error: "Price list not found" };
  }
  if (data.tax_rate_id) {
    const taxRate = await prismadb.invoice_TaxRates.findFirst({ where: { id: data.tax_rate_id, active: true }, select: { id: true } });
    if (!taxRate) return { error: "Belastingstarief niet gevonden" };
  }
  const contact = customerContactPatch(data);
  if ("error" in contact) return contact;
  const { vat_choice: rawChoice, ...fields } = data;
  const choice = vatChoicePatch(rawChoice);
  if ("error" in choice) return choice;

  try {
    const account = await prismadb.crm_Accounts.create({
      data: {
        v: 0,
        createdBy: user.id,
        updatedBy: user.id,
        ...fields,
        ...contact,
        ...choice,
        // A partner's new account has him as partner and no internal owner
        // yet (spec § Writes): admins/managers find it among unowned accounts.
        assigned_to: user.role === "partner" ? null : data.assigned_to || user.id,
        industry: data.industry || undefined,
        pricelist_id: data.pricelist_id || undefined,
        // The partner is set only through setAccountPartner (admin/manager),
        // except that a partner's own new account names him.
        partnerUserId: user.role === "partner" ? user.id : undefined,
        status: "Active",
        ...(accountType(data.account_role) ? { type: accountType(data.account_role) } : {}),
      },
    });
    await writeAuditLog({
      entityType: "account",
      entityId: account.id,
      action: "created",
      changes: null,
      userId: user.id,
    });
    void inngest.send({ name: "crm/account.saved", data: { record_id: account.id } });
    revalidatePath("/[locale]/(routes)/crm/accounts", "page");
    return { data: account };
  } catch (error) {
    const ruleMessage = await pluginRuleErrorMessage(error);
    if (ruleMessage) return { error: ruleMessage };
    console.log("[CREATE_ACCOUNT]", error);
    return { error: "Failed to create account" };
  }
};
