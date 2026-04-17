import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createCreditRechargeOrder } from "@/lib/payments/orders";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { packageId?: string };
  if (!body.packageId) {
    return NextResponse.json({ error: "缺少套餐 ID" }, { status: 400 });
  }

  try {
    const userAgent = req.headers.get("user-agent") ?? "";
    const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
    const result = await createCreditRechargeOrder({
      userId: auth.user.id,
      packageId: body.packageId,
      isMobile,
    });

    return NextResponse.json({
      ok: true,
      orderId: result.order.id,
      outTradeNo: result.order.outTradeNo,
      paymentUrl: result.paymentUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建支付订单失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
