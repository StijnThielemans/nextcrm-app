import { hashPassword, verifyPassword } from "better-auth/crypto";
import { prismaBase } from "@/lib/prisma-base";
import { isDevPasswordSignIn } from "@/lib/dev-password-sign-in";
import { DEV_PROJECT_LEADERS } from "@/lib/sales/dev-project-leaders";
import { DEV_SALES_USERS } from "@/lib/sales/dev-sales-users";

const DEV_TEST_EMAIL = "admin@domain.com";

let pending: Promise<void> | null = null;
let salesPending: Promise<void> | null = null;
let leadersPending: Promise<void> | null = null;

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

  await storeCredentialPassword(user.id, password);
}

/**
 * On a non-production server, make sure each verkoper can sign in with
 * TILO_DEV_PASSWORD. Reuses a user that already has that name. Never touches
 * admin@domain.com and never rewrites dossier sellers.
 */
export function ensureDevSalesUsers(): Promise<void> {
  if (!isDevPasswordSignIn() || !process.env.TILO_DEV_PASSWORD) return Promise.resolve();
  if (!salesPending) {
    salesPending = applyDevSalesUsers().catch((error) => {
      salesPending = null;
      throw error;
    });
  }
  return salesPending;
}

async function applyDevSalesUsers() {
  await applyNamedDevUsers(DEV_SALES_USERS);
}

/**
 * On a non-production server, make sure each projectleider can sign in with
 * TILO_DEV_PASSWORD. Same create-or-update path as the verkopers. Never touches
 * admin@domain.com, never rewrites dossier sellers, and never adds them to SELLERS.
 */
export function ensureDevProjectLeaders(): Promise<void> {
  if (!isDevPasswordSignIn() || !process.env.TILO_DEV_PASSWORD) return Promise.resolve();
  if (!leadersPending) {
    leadersPending = applyNamedDevUsers(DEV_PROJECT_LEADERS).catch((error) => {
      leadersPending = null;
      throw error;
    });
  }
  return leadersPending;
}

async function applyNamedDevUsers(people: readonly { email: string; name: string }[]) {
  const password = process.env.TILO_DEV_PASSWORD;
  if (!password) return;

  for (const person of people) {
    const byEmail = await prismaBase.users.findUnique({
      where: { email: person.email },
      select: { id: true, role: true },
    });
    const byName = byEmail
      ? null
      : await prismaBase.users.findFirst({
          where: { name: person.name },
          select: { id: true, role: true },
        });
    const existing = byEmail ?? byName;
    const userId = existing
      ? existing.id
      : (
          await prismaBase.users.create({
            data: {
              email: person.email,
              name: person.name,
              role: "user",
              userStatus: "ACTIVE",
              emailVerified: true,
              userLanguage: "nl",
            },
            select: { id: true },
          })
        ).id;

    if (existing && existing.role !== "admin") {
      await prismaBase.users.update({
        where: { id: existing.id },
        data: {
          name: person.name,
          role: "user",
          userStatus: "ACTIVE",
          emailVerified: true,
          userLanguage: "nl",
        },
      });
    }
    await storeCredentialPassword(userId, password);
  }
}

async function storeCredentialPassword(userId: string, password: string) {
  const existing = await prismaBase.account.findFirst({
    where: { userId, providerId: "credential", accountId: userId },
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
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
    },
  });
}
