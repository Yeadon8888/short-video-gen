import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditTxns, systemConfig, users } from "@/lib/db/schema";

export const NEW_USER_FREE_CREDITS_CONFIG_KEY = "onboarding.new_user_free_credits";
export const DEFAULT_NEW_USER_FREE_CREDITS = 10;
export const FIRST_USER_BOOTSTRAP_CREDITS = 9999;
export const MAX_NEW_USER_FREE_CREDITS = 10_000;

export interface NewUserFreeCreditsConfig {
  credits: number;
}

export function normalizeNewUserFreeCredits(value: unknown): number {
  if (!value || typeof value !== "object") return DEFAULT_NEW_USER_FREE_CREDITS;
  const credits = (value as { credits?: unknown }).credits;
  if (!Number.isInteger(credits)) return DEFAULT_NEW_USER_FREE_CREDITS;
  return Math.min(MAX_NEW_USER_FREE_CREDITS, Math.max(0, credits as number));
}

export function resolveInitialCredits(params: {
  isFirstUser: boolean;
  configuredCredits: number | undefined;
}): number {
  if (params.isFirstUser) return FIRST_USER_BOOTSTRAP_CREDITS;
  return params.configuredCredits ?? DEFAULT_NEW_USER_FREE_CREDITS;
}

export function shouldInsertNewUserCreditTxn(params: {
  isFirstUser: boolean;
  initialCredits: number;
}): boolean {
  return !params.isFirstUser && params.initialCredits > 0;
}

export async function getNewUserFreeCredits(): Promise<number> {
  const [row] = await db
    .select({ value: systemConfig.value })
    .from(systemConfig)
    .where(eq(systemConfig.key, NEW_USER_FREE_CREDITS_CONFIG_KEY))
    .limit(1);

  return normalizeNewUserFreeCredits(row?.value);
}

export async function saveNewUserFreeCredits(params: {
  credits: number;
  adminId: string;
}): Promise<number> {
  const credits = normalizeNewUserFreeCredits({ credits: params.credits });
  await db
    .insert(systemConfig)
    .values({
      key: NEW_USER_FREE_CREDITS_CONFIG_KEY,
      value: { credits } satisfies NewUserFreeCreditsConfig,
      updatedBy: params.adminId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: {
        value: { credits } satisfies NewUserFreeCreditsConfig,
        updatedBy: params.adminId,
        updatedAt: new Date(),
      },
    });

  return credits;
}

export async function createAppUserForAuthUser(params: {
  authId: string;
  email: string;
  name: string | null;
}) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(users)
      .where(eq(users.authId, params.authId))
      .limit(1);

    if (existing) return existing;

    const allUsers = await tx.select({ id: users.id }).from(users).limit(1);
    const isFirstUser = allUsers.length === 0;
    const [configRow] = await tx
      .select({ value: systemConfig.value })
      .from(systemConfig)
      .where(eq(systemConfig.key, NEW_USER_FREE_CREDITS_CONFIG_KEY))
      .limit(1);
    const configuredCredits = normalizeNewUserFreeCredits(configRow?.value);
    const initialCredits = resolveInitialCredits({
      isFirstUser,
      configuredCredits,
    });

    const [created] = await tx
      .insert(users)
      .values({
        authId: params.authId,
        email: params.email,
        name: params.name || params.email.split("@")[0],
        role: isFirstUser ? "admin" : "user",
        credits: initialCredits,
      })
      .returning();

    if (shouldInsertNewUserCreditTxn({ isFirstUser, initialCredits })) {
      await tx.insert(creditTxns).values({
        userId: created.id,
        type: "grant",
        amount: initialCredits,
        reason: "新用户免费额度",
        balanceAfter: initialCredits,
      });
    }

    return created;
  });
}

export async function grantMissingNewUserCredits(params: {
  userId: string;
  currentCredits: number;
}) {
  if (params.currentCredits > 0) return null;

  const credits = await getNewUserFreeCredits();
  if (credits <= 0) return null;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(users)
      .set({
        credits: sql`${users.credits} + ${credits}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.userId))
      .returning({ credits: users.credits });

    if (!updated) return null;

    await tx.insert(creditTxns).values({
      userId: params.userId,
      type: "grant",
      amount: credits,
      reason: "新用户免费额度补发",
      balanceAfter: updated.credits,
    });

    return updated.credits;
  });
}
