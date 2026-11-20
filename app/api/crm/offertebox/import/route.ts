import { NextRequest, NextResponse } from "next/server";
import {
  AuthenticationError,
  requireAuthenticated,
  unauthorizedResponse,
} from "@/lib/authz";
import { SalesError } from "@/lib/sales/errors";
import { importOfferteboxMail } from "@/lib/sales/offertebox";
import { MAX_MAIL_BYTES } from "@/lib/sales/offertebox-mail";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuthenticated();
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    throw error;
  }

  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_MAIL_BYTES + 1024 * 1024) {
    return NextResponse.json({ code: "mailTooLarge" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (error) {
    console.error("[offertebox] import form", error);
    return NextResponse.json({ code: "mailInvalid" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ code: "mailInvalid" }, { status: 400 });
  if (file.size > MAX_MAIL_BYTES) return NextResponse.json({ code: "mailTooLarge" }, { status: 400 });

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await importOfferteboxMail(user, file.name || "mail.eml", bytes, file.type);
    revalidatePath("/[locale]/(routes)/crm/offertebox", "page");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SalesError) {
      const status = error.code === "forbidden" ? 403 : 400;
      return NextResponse.json({ code: error.code }, { status });
    }
    console.error("[offertebox] import", error);
    return NextResponse.json({ code: "generic" }, { status: 500 });
  }
}
