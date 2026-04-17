import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserPaymentOrder, syncPaymentOrderStatus } from "@/lib/payments/orders";

interface RouteParams {
  params: Promise<{ orderId: string }>;
}

export async function GET(_: NextRequest, context: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { orderId } = await context.params;
  const order = await getUserPaymentOrder({
    userId: auth.user.id,
    orderId,
  });

  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function POST(_: NextRequest, context: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { orderId } = await context.params;

  try {
    const order = await syncPaymentOrderStatus({
      userId: auth.user.id,
      orderId,
    });
    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步支付状态失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
