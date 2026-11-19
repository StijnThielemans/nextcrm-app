import { hashPassword, verifyPassword } from "better-auth/crypto";
import { prismaBase } from "@/lib/prisma-base";
import { isDevPasswordSignIn } from "@/lib/dev-password-sign-in";

const DEV_TEST_EMAIL = "admin@domain.com";

let pending: Promise<void> | null = null;

/**
 * On a non-production server, store TILO_DEV_PASSWORD on the existing
 * admin@domain.com user. Never creates a user. Production returns immediately.
 */
export function ensureDevTestPassword(): Promise<void> {
  if (!isDevPasswordSignIn() || !process.env.TILO_DEV_PASSWORD) return Promise.resolve();
  if (!pending) {
    pending = applyDevTestPassword().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

async function applyDevTestPassword() {
  const password = process.env.TILO_DEV_PASSWORD;
  if (!password) return;

  const user = await prismaBase.users.findUnique({
    where: { email: DEV_TEST_EMAIL },
    select: { id: true },
  });
  if (!user) return;

  const existing = await prismaBase.account.findFirst({
    where: { userId: user.id, providerId: "credential", accountId: user.id },
    select: { id: true, password: true },
  });
  if (existing?.password && (await verifyPassword({ hash: existing.password, password }))) return;

  const hashed = await hashPassword(password);
  if (existing) {
    await prismaBase.account.update({
      where: { id: existing.id },
      data: { password: hashed },
    });
    return;
  }
  await prismaBase.account.create({
    data: {
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hashed,
    },
  });
}
