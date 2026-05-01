import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  creditTxns,
  partnerAttributions,
  partnerCreditTransfers,
  partnerProfiles,
  paymentOrders,
  users,
} from "@/lib/db/schema";

export const PARTNER_REF_COOKIE = "vc_partner_ref";
export const PARTNER_REF_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizePartnerCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
}

export function isValidPartnerCode(value: string): boolean {
  const normalized = normalizePartnerCode(value);
  return normalized.length >= 3 && normalized === value.trim().toLowerCase();
}

export function buildPartnerLink(baseUrl: string, code: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}/r/${encodeURIComponent(code)}`;
}

export function calculateCommissionFen(amountFen: number, commissionRateBps: number): number {
  if (!Number.isFinite(amountFen) || !Number.isFinite(commissionRateBps)) return 0;
  if (amountFen <= 0 || commissionRateBps <= 0) return 0;
  return Math.floor((amountFen * commissionRateBps) / 10_000);
}

export async function getActivePartnerByCode(code: string) {
  const normalizedCode = normalizePartnerCode(code);
  if (!normalizedCode) return null;

  const [partner] = await db
    .select()
    .from(partnerProfiles)
    .where(and(eq(partnerProfiles.code, normalizedCode), eq(partnerProfiles.status, "active")))
    .limit(1);

  return partner ?? null;
}

export async function createPartnerAttributionForUser(params: {
  userId: string;
  referralCode?: string | null;
}) {
  if (!params.referralCode) return null;

  const partner = await getActivePartnerByCode(params.referralCode);
  if (!partner || partner.userId === params.userId) return null;

  const inserted = await db
    .insert(partnerAttributions)
    .values({
      userId: params.userId,
      partnerId: partner.id,
      referralCode: partner.code,
    })
    .onConflictDoNothing({ target: partnerAttributions.userId })
    .returning();

  return inserted[0] ?? null;
}

export async function getPartnerIdForUser(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ partnerId: partnerAttributions.partnerId })
    .from(partnerAttributions)
    .where(eq(partnerAttributions.userId, userId))
    .limit(1);

  return row?.partnerId ?? null;
}

export async function getPartnerProfileForUser(userId: string) {
  const [partner] = await db
    .select()
    .from(partnerProfiles)
    .where(eq(partnerProfiles.userId, userId))
    .limit(1);

  return partner ?? null;
}

export async function listPartners(params: {
  search?: string;
  page: number;
  limit: number;
}) {
  const escaped = (params.search ?? "").trim().replace(/[%_\\]/g, (ch) => `\\${ch}`);
  const conditions = escaped
    ? or(
        ilike(users.email, `%${escaped}%`),
        ilike(users.name, `%${escaped}%`),
        ilike(partnerProfiles.code, `%${escaped}%`),
        ilike(partnerProfiles.displayName, `%${escaped}%`),
      )
    : undefined;

  const [{ value }] = await db
    .select({ value: count() })
    .from(partnerProfiles)
    .innerJoin(users, eq(partnerProfiles.userId, users.id))
    .where(conditions);

  const rows = await db
    .select({
      id: partnerProfiles.id,
      code: partnerProfiles.code,
      displayName: partnerProfiles.displayName,
      status: partnerProfiles.status,
      commissionRateBps: partnerProfiles.commissionRateBps,
      createdAt: partnerProfiles.createdAt,
      userId: users.id,
      email: users.email,
      name: users.name,
      credits: users.credits,
    })
    .from(partnerProfiles)
    .innerJoin(users, eq(partnerProfiles.userId, users.id))
    .where(conditions)
    .orderBy(desc(partnerProfiles.createdAt))
    .limit(params.limit)
    .offset((params.page - 1) * params.limit);

  const partnerIds = rows.map((row) => row.id);
  const stripeStats = partnerIds.length > 0
    ? await db
        .select({
          partnerId: paymentOrders.partnerId,
          stripePaidOrders: count(),
          stripePaidAmountFen: sql<number>`coalesce(sum(${paymentOrders.amountFen}), 0)`,
          stripePaidCredits: sql<number>`coalesce(sum(${paymentOrders.credits}), 0)`,
        })
        .from(paymentOrders)
        .where(and(
          inArray(paymentOrders.partnerId, partnerIds),
          eq(paymentOrders.provider, "stripe"),
          eq(paymentOrders.status, "paid"),
        ))
        .groupBy(paymentOrders.partnerId)
    : [];

  const statsByPartner = new Map(stripeStats.map((stat) => [stat.partnerId, stat]));
  const rowsWithStats = rows.map((row) => {
    const stats = statsByPartner.get(row.id);
    const stripePaidAmountFen = Number(stats?.stripePaidAmountFen ?? 0);
    return {
      ...row,
      stripePaidOrders: Number(stats?.stripePaidOrders ?? 0),
      stripePaidAmountFen,
      stripePaidCredits: Number(stats?.stripePaidCredits ?? 0),
      commissionDueFen: calculateCommissionFen(stripePaidAmountFen, row.commissionRateBps),
    };
  });

  return { rows: rowsWithStats, total: value };
}

export async function createOrUpdatePartner(params: {
  adminId: string;
  userId: string;
  code: string;
  displayName?: string | null;
  commissionRateBps?: number;
  status?: "active" | "disabled";
}) {
  if (!isValidPartnerCode(params.code)) {
    throw new Error("邀请码只能包含小写字母、数字、下划线或连字符，长度至少 3 位");
  }

  const code = normalizePartnerCode(params.code);
  const commissionRateBps = Math.min(10_000, Math.max(0, params.commissionRateBps ?? 0));

  return db.transaction(async (tx) => {
    const targetUser = await resolvePartnerTargetUser(tx, params.userId);

    const [partner] = await tx
      .insert(partnerProfiles)
      .values({
        userId: targetUser.id,
        code,
        displayName: params.displayName?.trim() || null,
        commissionRateBps,
        status: params.status ?? "active",
        createdBy: params.adminId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: partnerProfiles.userId,
        set: {
          code,
          displayName: params.displayName?.trim() || null,
          commissionRateBps,
          status: params.status ?? "active",
          updatedAt: new Date(),
        },
      })
      .returning();

    if (targetUser.role !== "admin") {
      await tx
        .update(users)
        .set({ role: "partner", updatedAt: new Date() })
        .where(eq(users.id, targetUser.id));
    }

    return partner;
  });
}

async function resolvePartnerTargetUser(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  query: string,
) {
  const rawQuery = query.trim();
  if (!rawQuery) throw new Error("请输入用户邮箱、昵称或用户 ID");

  if (UUID_REGEX.test(rawQuery)) {
    const [targetUser] = await tx
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, rawQuery))
      .limit(1);
    if (!targetUser) throw new Error(`未找到用户: ${rawQuery}`);
    return targetUser;
  }

  const escaped = rawQuery.replace(/[%_\\]/g, (ch) => `\\${ch}`);
  const matches = await tx
    .select({ id: users.id, role: users.role, email: users.email, name: users.name })
    .from(users)
    .where(or(
      ilike(users.email, `%${escaped}%`),
      ilike(users.name, `%${escaped}%`),
    ))
    .limit(2);

  if (matches.length === 0) {
    throw new Error(`未找到匹配用户: ${rawQuery}`);
  }
  if (matches.length > 1) {
    throw new Error("匹配到多个用户，请输入完整邮箱或用户 ID");
  }

  return matches[0];
}

export async function updatePartnerStatus(params: {
  partnerId: string;
  status: "active" | "disabled";
}) {
  const [updated] = await db
    .update(partnerProfiles)
    .set({ status: params.status, updatedAt: new Date() })
    .where(eq(partnerProfiles.id, params.partnerId))
    .returning();

  return updated ?? null;
}

export async function getPartnerDashboard(userId: string) {
  const partner = await getPartnerProfileForUser(userId);
  if (!partner) return null;

  const [owner] = await db
    .select({ credits: users.credits })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [customerCount] = await db
    .select({ value: count() })
    .from(partnerAttributions)
    .where(eq(partnerAttributions.partnerId, partner.id));

  const [paidOrderSummary] = await db
    .select({
      paidOrders: count(),
      paidAmountFen: sql<number>`coalesce(sum(${paymentOrders.amountFen}), 0)`,
      paidCredits: sql<number>`coalesce(sum(${paymentOrders.credits}), 0)`,
    })
    .from(paymentOrders)
    .where(and(eq(paymentOrders.partnerId, partner.id), eq(paymentOrders.status, "paid")));

  const customers = await listPartnerCustomers({ partnerUserId: userId, limit: 20 });
  const transfers = await listPartnerTransfers({ partnerUserId: userId, limit: 20 });

  return {
    partner,
    credits: owner?.credits ?? 0,
    customerCount: customerCount.value,
    paidOrders: paidOrderSummary.paidOrders,
    paidAmountFen: paidOrderSummary.paidAmountFen,
    paidCredits: paidOrderSummary.paidCredits,
    customers,
    transfers,
  };
}

export async function listPartnerCustomers(params: {
  partnerUserId: string;
  limit?: number;
}) {
  const partner = await getPartnerProfileForUser(params.partnerUserId);
  if (!partner) return [];

  return db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      credits: users.credits,
      status: users.status,
      registeredAt: partnerAttributions.registeredAt,
    })
    .from(partnerAttributions)
    .innerJoin(users, eq(partnerAttributions.userId, users.id))
    .where(eq(partnerAttributions.partnerId, partner.id))
    .orderBy(desc(partnerAttributions.registeredAt))
    .limit(params.limit ?? 100);
}

export async function listPartnerTransfers(params: {
  partnerUserId: string;
  limit?: number;
}) {
  const partner = await getPartnerProfileForUser(params.partnerUserId);
  if (!partner) return [];

  return db
    .select({
      id: partnerCreditTransfers.id,
      amount: partnerCreditTransfers.amount,
      reason: partnerCreditTransfers.reason,
      createdAt: partnerCreditTransfers.createdAt,
      toUserId: users.id,
      toEmail: users.email,
      toName: users.name,
    })
    .from(partnerCreditTransfers)
    .innerJoin(users, eq(partnerCreditTransfers.toUserId, users.id))
    .where(eq(partnerCreditTransfers.partnerId, partner.id))
    .orderBy(desc(partnerCreditTransfers.createdAt))
    .limit(params.limit ?? 100);
}

export async function transferPartnerCredits(params: {
  partnerUserId: string;
  toUserId: string;
  amount: number;
  reason?: string | null;
}) {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new Error("划拨积分必须为正整数");
  }

  return db.transaction(async (tx) => {
    const [partner] = await tx
      .select()
      .from(partnerProfiles)
      .where(and(
        eq(partnerProfiles.userId, params.partnerUserId),
        eq(partnerProfiles.status, "active"),
      ))
      .limit(1);

    if (!partner) throw new Error("伙伴账号不存在或已停用");

    const [attribution] = await tx
      .select({ userId: partnerAttributions.userId })
      .from(partnerAttributions)
      .where(and(
        eq(partnerAttributions.partnerId, partner.id),
        eq(partnerAttributions.userId, params.toUserId),
      ))
      .limit(1);

    if (!attribution) throw new Error("只能给自己邀请来的用户划拨积分");

    const [deducted] = await tx
      .update(users)
      .set({
        credits: sql`${users.credits} - ${params.amount}`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(users.id, params.partnerUserId),
        sql`${users.credits} >= ${params.amount}`,
      ))
      .returning({ credits: users.credits });

    if (!deducted) throw new Error("伙伴积分余额不足");

    const [credited] = await tx
      .update(users)
      .set({
        credits: sql`${users.credits} + ${params.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, params.toUserId))
      .returning({ credits: users.credits });

    if (!credited) throw new Error("目标用户不存在");

    const reason = params.reason?.trim() || "伙伴积分划拨";

    await tx.insert(creditTxns).values([
      {
        userId: params.partnerUserId,
        type: "adjust",
        amount: -params.amount,
        reason,
        balanceAfter: deducted.credits,
      },
      {
        userId: params.toUserId,
        type: "grant",
        amount: params.amount,
        reason,
        adminId: params.partnerUserId,
        balanceAfter: credited.credits,
      },
    ]);

    const [transfer] = await tx
      .insert(partnerCreditTransfers)
      .values({
        partnerId: partner.id,
        fromUserId: params.partnerUserId,
        toUserId: params.toUserId,
        amount: params.amount,
        reason,
      })
      .returning();

    return {
      transfer,
      partnerBalance: deducted.credits,
      userBalance: credited.credits,
    };
  });
}
