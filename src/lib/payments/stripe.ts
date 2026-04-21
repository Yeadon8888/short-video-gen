import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { buildAbsoluteUrl, getStripeConfig, type StripeConfig } from "@/lib/payments/config";

let cached: { client: Stripe; key: string } | null = null;

export function getStripeClient(config: StripeConfig = getStripeConfig()): Stripe {
  if (!config.enabled) {
    throw new Error("Stripe 未配置 (STRIPE_SECRET_KEY 缺失)");
  }
  if (cached && cached.key === config.secretKey) {
    return cached.client;
  }
  const client = new Stripe(config.secretKey, {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });
  cached = { client, key: config.secretKey };
  return client;
}

export interface CreateStripeSessionParams {
  config: StripeConfig;
  outTradeNo: string;
  userId: string;
  userEmail?: string | null;
  packageName: string;
  /** Charge amount in USD cents. */
  amountUsdCents: number;
  /** When provided, Stripe uses this Price; otherwise a one-off price_data is sent. */
  stripePriceId?: string;
  /** Stripe Customer id (cus_...) — pass when known to attach the session. */
  stripeCustomerId?: string | null;
}

export async function createStripeCheckoutSession(params: CreateStripeSessionParams) {
  const stripe = getStripeClient(params.config);
  const successUrl = `${buildAbsoluteUrl(params.config.siteUrl, params.config.successPath, {
    outTradeNo: params.outTradeNo,
  })}&session_id={CHECKOUT_SESSION_ID}`.replace("?&", "?");
  const cancelUrl = buildAbsoluteUrl(params.config.siteUrl, params.config.cancelPath, {
    canceled: "1",
  });

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [
      params.stripePriceId
        ? { price: params.stripePriceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: params.amountUsdCents,
              product_data: { name: params.packageName },
            },
          },
    ],
    client_reference_id: params.outTradeNo,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      outTradeNo: params.outTradeNo,
      userId: params.userId,
    },
    payment_intent_data: {
      metadata: {
        outTradeNo: params.outTradeNo,
        userId: params.userId,
      },
    },
  };

  if (params.stripeCustomerId) {
    sessionParams.customer = params.stripeCustomerId;
  } else if (params.userEmail) {
    sessionParams.customer_email = params.userEmail;
    sessionParams.customer_creation = "always";
  }

  return stripe.checkout.sessions.create(sessionParams);
}

/**
 * Lazily ensure the user has a Stripe Customer. We only call this once we
 * have a Customer id from a completed Checkout (Stripe creates one for us
 * when `customer_creation: "always"` is set), then persist it for reuse.
 */
export async function persistStripeCustomerId(userId: string, customerId: string) {
  await db
    .update(users)
    .set({ stripeCustomerId: customerId, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export function verifyStripeWebhook(params: {
  config: StripeConfig;
  rawBody: string;
  signature: string;
}): Stripe.Event {
  const stripe = getStripeClient(params.config);
  return stripe.webhooks.constructEvent(
    params.rawBody,
    params.signature,
    params.config.webhookSecret,
  );
}
