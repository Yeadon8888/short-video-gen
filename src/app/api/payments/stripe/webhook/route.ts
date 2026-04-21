import { NextRequest, NextResponse } from "next/server";
import { getStripeConfig } from "@/lib/payments/config";
import { verifyStripeWebhook } from "@/lib/payments/stripe";
import { markStripeOrderPaid } from "@/lib/payments/orders";

// Stripe needs the raw request body for signature verification — Next 16
// App Router gives us that via req.text(); do NOT parse as JSON first.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const config = getStripeConfig();
  if (!config.enabled || !config.webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook 未配置" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "缺少 stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event;
  try {
    event = verifyStripeWebhook({ config, rawBody, signature });
  } catch (error) {
    const message = error instanceof Error ? error.message : "签名校验失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await markStripeOrderPaid(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : "处理 webhook 失败";
    // Returning 500 lets Stripe retry — only do that for transient failures.
    // Validation/order-not-found are 4xx so Stripe stops retrying.
    const status = message.includes("不存在") || message.includes("缺少") || message.includes("异常")
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ received: true });
}
