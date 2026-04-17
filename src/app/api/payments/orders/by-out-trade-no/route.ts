import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUserPaymentOrderByOutTradeNo } from "@/lib/payments/orders";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const outTradeNo = req.nextUrl.searchParams.get("outTradeNo");
  if (!outTradeNo) {
    return NextResponse.json({ error: "缺少 outTradeNo" }, { status: 400 });
  }

  const order = await getUserPaymentOrderByOutTradeNo({
    userId: auth.user.id,
    outTradeNo,
  });

  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
