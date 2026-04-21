import { and, eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { creditTxns, paymentOrders, stripeEvents, users } from "@/lib/db/schema";
import {
  getAlipayConfig,
  getCreditPackageById,
  getStripeConfig,
} from "@/lib/payments/config";
import { createAlipayPageUrl, queryAlipayTrade } from "@/lib/payments/alipay";
import { createStripeCheckoutSession, persistStripeCustomerId } from "@/lib/payments/stripe";

export type PaymentProvider = "alipay" | "stripe";

export interface PaymentOrderView {
  id: string;
  outTradeNo: string;
  status: "pending" | "paid" | "failed" | "closed";
  provider: PaymentProvider;
  subject: string;
  packageId: string | null;
  amountFen: number;
  credits: number;
  paymentUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

function generateOutTradeNo() {
  return `VC${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function createCreditRechargeOrder(params: {
  userId: string;
  packageId: string;
  isMobile: boolean;
  /** Defaults to "stripe" — alipay is kept for the legacy path. */
  provider?: PaymentProvider;
  userEmail?: string | null;
}) {
  const provider: PaymentProvider = params.provider ?? "stripe";
  const pkg = await getCreditPackageById(params.packageId);
  if (!pkg) {
    throw new Error("充值套餐不存在或已停用");
  }
  if (pkg.type === "contact") {
    throw new Error("企业方案请通过商务渠道签约");
  }

  if (provider === "stripe") {
    return createStripeRechargeOrder({
      userId: params.userId,
      userEmail: params.userEmail ?? null,
      pkg,
    });
  }

  return createAlipayRechargeOrder({
    userId: params.userId,
    isMobile: params.isMobile,
    pkg,
  });
}

// ─── Alipay path ──────────────────────────────────────────────────────────

async function createAlipayRechargeOrder(params: {
  userId: string;
  isMobile: boolean;
  pkg: NonNullable<Awaited<ReturnType<typeof getCreditPackageById>>>;
}) {
  const config = await getAlipayConfig();
  if (!config.enabled || !config.appId || !config.privateKey || !config.alipayPublicKey) {
    throw new Error("支付宝支付尚未配置完成");
  }

  const outTradeNo = generateOutTradeNo();
  const subject = `${params.pkg.name} · ${params.pkg.credits} 积分`;
  const payment = createAlipayPageUrl({
    config,
    method: params.isMobile ? "alipay.trade.wap.pay" : "alipay.trade.page.pay",
    outTradeNo,
    amountFen: params.pkg.amountFen,
    subject,
    body: `VidClaw 积分充值 ${params.pkg.credits} 积分`,
    returnParams: { outTradeNo },
  });

  const [created] = await db
    .insert(paymentOrders)
    .values({
      userId: params.userId,
      provider: "alipay",
      status: "pending",
      outTradeNo,
      subject,
      packageId: params.pkg.id,
      amountFen: params.pkg.amountFen,
      credits: params.pkg.credits,
      paymentUrl: payment.url,
      expiredAt: new Date(Date.now() + 30 * 60 * 1000),
      updatedAt: new Date(),
    })
    .returning();

  return { order: created, paymentUrl: payment.url };
}

// ─── Stripe path ──────────────────────────────────────────────────────────

async function createStripeRechargeOrder(params: {
  userId: string;
  userEmail: string | null;
  pkg: NonNullable<Awaited<ReturnType<typeof getCreditPackageById>>>;
}) {
  const config = getStripeConfig();
  if (!config.enabled) {
    throw new Error("Stripe 支付尚未配置 (缺少 STRIPE_SECRET_KEY)");
  }
  if (!params.pkg.amountUsdCents || params.pkg.amountUsdCents <= 0) {
    throw new Error(`套餐 ${params.pkg.id} 缺少 amountUsdCents,无法走 Stripe`);
  }

  const outTradeNo = generateOutTradeNo();
  const subject = `${params.pkg.name} · ${params.pkg.credits} 积分`;

  const [existingUser] = await db
    .select({ stripeCustomerId: users.stripeCustomerId, email: users.email })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  // Insert order first so the row exists when the webhook arrives, even if
  // it lands before the session URL reaches the client.
  const [created] = await db
    .insert(paymentOrders)
    .values({
      userId: params.userId,
      provider: "stripe",
      status: "pending",
      outTradeNo,
      subject,
      packageId: params.pkg.id,
      amountFen: params.pkg.amountFen,
      credits: params.pkg.credits,
      paymentUrl: null,
      expiredAt: new Date(Date.now() + 30 * 60 * 1000),
      updatedAt: new Date(),
    })
    .returning();

  const session = await createStripeCheckoutSession({
    config,
    outTradeNo,
    userId: params.userId,
    userEmail: params.userEmail ?? existingUser?.email ?? null,
    packageName: subject,
    amountUsdCents: params.pkg.amountUsdCents,
    stripePriceId: params.pkg.stripePriceId,
    stripeCustomerId: existingUser?.stripeCustomerId ?? null,
  });

  if (!session.url) {
    throw new Error("Stripe Checkout 未返回支付链接");
  }

  await db
    .update(paymentOrders)
    .set({
      stripeSessionId: session.id,
      paymentUrl: session.url,
      updatedAt: new Date(),
    })
    .where(eq(paymentOrders.id, created.id));

  return { order: { ...created, stripeSessionId: session.id, paymentUrl: session.url }, paymentUrl: session.url };
}

// ─── Order lookup ─────────────────────────────────────────────────────────

export async function getUserPaymentOrder(params: {
  userId: string;
  orderId: string;
}): Promise<PaymentOrderView | null> {
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.id, params.orderId), eq(paymentOrders.userId, params.userId)))
    .limit(1);

  if (!order) return null;
  return serializePaymentOrder(order);
}

export async function getUserPaymentOrderByOutTradeNo(params: {
  userId: string;
  outTradeNo: string;
}) {
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(and(
      eq(paymentOrders.userId, params.userId),
      eq(paymentOrders.outTradeNo, params.outTradeNo),
    ))
    .limit(1);

  return order ? serializePaymentOrder(order) : null;
}

function serializePaymentOrder(order: typeof paymentOrders.$inferSelect): PaymentOrderView {
  return {
    id: order.id,
    outTradeNo: order.outTradeNo,
    status: order.status,
    provider: order.provider,
    subject: order.subject,
    packageId: order.packageId ?? null,
    amountFen: order.amountFen,
    credits: order.credits,
    paymentUrl: order.paymentUrl ?? null,
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
  };
}

// ─── Alipay notify → paid ─────────────────────────────────────────────────

export async function markPaymentOrderPaidFromNotify(params: {
  outTradeNo: string;
  providerTradeNo: string;
  totalAmountYuan: string;
  rawNotify: Record<string, unknown>;
}) {
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.outTradeNo, params.outTradeNo))
    .limit(1);

  if (!order) {
    throw new Error("支付订单不存在");
  }

  if (order.status === "paid") {
    return order;
  }

  const expectedAmount = (order.amountFen / 100).toFixed(2);
  if (expectedAmount !== params.totalAmountYuan) {
    throw new Error("支付金额校验失败");
  }

  const paidAt = new Date();
  await db.transaction(async (tx) => {
    const [updatedOrder] = await tx
      .update(paymentOrders)
      .set({
        status: "paid",
        providerTradeNo: params.providerTradeNo,
        rawNotify: params.rawNotify,
        paidAt,
        updatedAt: new Date(),
      })
      .where(and(
        eq(paymentOrders.id, order.id),
        eq(paymentOrders.status, "pending"),
      ))
      .returning();

    if (!updatedOrder) {
      return;
    }

    const [creditedUser] = await tx
      .update(users)
      .set({
        credits: sql`${users.credits} + ${order.credits}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, order.userId))
      .returning({ credits: users.credits });

    await tx.insert(creditTxns).values({
      userId: order.userId,
      type: "payment",
      amount: order.credits,
      reason: `支付宝充值 · ${order.subject}`,
      balanceAfter: creditedUser?.credits ?? order.credits,
    });
  });

  const [fresh] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.id, order.id))
    .limit(1);

  return fresh ?? order;
}

// ─── Stripe webhook → paid / failed ───────────────────────────────────────

const HANDLED_STRIPE_EVENTS = new Set<string>([
  "checkout.session.completed",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

async function markEventProcessed(eventId: string) {
  await db
    .update(stripeEvents)
    .set({ processedAt: new Date() })
    .where(eq(stripeEvents.id, eventId));
}

/**
 * Idempotently process a Stripe webhook event. Returns true if this call
 * actually moved the order to a terminal state; false if it was a duplicate
 * or an event we don't act on.
 *
 * Idempotency lives in two layers:
 *   1. `stripe_events` PK on event.id — duplicate Stripe redeliveries return early.
 *   2. The order update is gated on `status = 'pending'`, so even if the event
 *      log insert races with itself the credit grant only fires once.
 */
export async function markStripeOrderPaid(event: Stripe.Event): Promise<boolean> {
  // Layer 1: event-level dedupe.
  const inserted = await db
    .insert(stripeEvents)
    .values({
      id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing({ target: stripeEvents.id })
    .returning({ id: stripeEvents.id });

  if (inserted.length === 0) {
    return false; // already processed
  }

  if (!HANDLED_STRIPE_EVENTS.has(event.type)) {
    await markEventProcessed(event.id);
    return false;
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const outTradeNo = session.client_reference_id ?? session.metadata?.outTradeNo;

  // Failure / expiry path: close the pending order so it can't be paid later
  // and so the user clearly sees it failed in the order list.
  if (
    event.type === "checkout.session.async_payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    if (!outTradeNo) {
      await markEventProcessed(event.id);
      return false;
    }
    const newStatus = event.type === "checkout.session.expired" ? "closed" : "failed";
    await db
      .update(paymentOrders)
      .set({
        status: newStatus,
        rawNotify: session as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(and(
        eq(paymentOrders.outTradeNo, outTradeNo),
        eq(paymentOrders.status, "pending"),
      ));
    await markEventProcessed(event.id);
    return true;
  }

  // Success path. Stripe sometimes emits checkout.session.completed before the
  // async PM authorizes; in that case payment_status is "unpaid" and we wait
  // for the next event (async_payment_succeeded carries a session too — but
  // we currently only subscribe to the success/failure variants below).
  if (session.payment_status !== "paid") {
    await markEventProcessed(event.id);
    return false;
  }

  if (!outTradeNo) {
    throw new Error(`Stripe session ${session.id} 缺少 client_reference_id`);
  }

  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.outTradeNo, outTradeNo))
    .limit(1);

  if (!order) {
    throw new Error(`Stripe 订单不存在: ${outTradeNo}`);
  }

  if (order.status === "paid") {
    await markEventProcessed(event.id);
    return false;
  }

  if ((session.amount_total ?? 0) <= 0) {
    throw new Error(`Stripe session ${session.id} 金额异常: ${session.amount_total}`);
  }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  const customerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id ?? null;

  await db.transaction(async (tx) => {
    const [updatedOrder] = await tx
      .update(paymentOrders)
      .set({
        status: "paid",
        providerTradeNo: paymentIntentId,
        stripePaymentIntentId: paymentIntentId,
        stripeSessionId: session.id,
        rawNotify: session as unknown as Record<string, unknown>,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(paymentOrders.id, order.id),
        eq(paymentOrders.status, "pending"),
      ))
      .returning();

    if (!updatedOrder) return;

    const [creditedUser] = await tx
      .update(users)
      .set({
        credits: sql`${users.credits} + ${order.credits}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, order.userId))
      .returning({ credits: users.credits });

    await tx.insert(creditTxns).values({
      userId: order.userId,
      type: "payment",
      amount: order.credits,
      reason: `Stripe 充值 · ${order.subject}`,
      balanceAfter: creditedUser?.credits ?? order.credits,
    });
  });

  if (customerId) {
    await persistStripeCustomerId(order.userId, customerId);
  }

  await markEventProcessed(event.id);
  return true;
}

// ─── Alipay status sync (manual refresh) ──────────────────────────────────

export async function syncPaymentOrderStatus(params: {
  userId: string;
  orderId: string;
}) {
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(and(eq(paymentOrders.id, params.orderId), eq(paymentOrders.userId, params.userId)))
    .limit(1);

  if (!order) {
    throw new Error("支付订单不存在");
  }

  if (order.status === "paid") {
    return serializePaymentOrder(order);
  }

  // Stripe orders are settled by webhook only — refresh just re-reads the row.
  if (order.provider !== "alipay") {
    const [fresh] = await db
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.id, order.id))
      .limit(1);
    return serializePaymentOrder(fresh ?? order);
  }

  const config = await getAlipayConfig();
  if (!config.enabled || !config.appId || !config.privateKey) {
    return serializePaymentOrder(order);
  }

  const payload = await queryAlipayTrade({
    config,
    outTradeNo: order.outTradeNo,
  });

  const response = payload.alipay_trade_query_response as
    | { trade_status?: string; trade_no?: string; total_amount?: string }
    | undefined;

  if (response?.trade_status === "TRADE_SUCCESS" && response.trade_no && response.total_amount) {
    await markPaymentOrderPaidFromNotify({
      outTradeNo: order.outTradeNo,
      providerTradeNo: response.trade_no,
      totalAmountYuan: response.total_amount,
      rawNotify: payload,
    });
  }

  const [fresh] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.id, order.id))
    .limit(1);

  return serializePaymentOrder(fresh ?? order);
}
