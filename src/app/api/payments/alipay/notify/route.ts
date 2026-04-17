import { NextRequest, NextResponse } from "next/server";
import { getAlipayConfig } from "@/lib/payments/config";
import { markPaymentOrderPaidFromNotify } from "@/lib/payments/orders";
import { verifyAlipaySignature } from "@/lib/payments/alipay";

async function readForm(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
    return Object.fromEntries(
      Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
    );
  }

  const raw = await req.text();
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

export async function POST(req: NextRequest) {
  const config = await getAlipayConfig();
  if (!config.enabled || !config.alipayPublicKey || !config.appId) {
    return new NextResponse("failure", { status: 400 });
  }

  const params = await readForm(req);
  const verified = verifyAlipaySignature(params, config.alipayPublicKey);
  if (!verified) {
    return new NextResponse("failure", { status: 400 });
  }

  if (
    params.app_id !== config.appId ||
    params.trade_status !== "TRADE_SUCCESS" ||
    !params.out_trade_no ||
    !params.trade_no ||
    !params.total_amount
  ) {
    return new NextResponse("failure", { status: 400 });
  }

  try {
    await markPaymentOrderPaidFromNotify({
      outTradeNo: params.out_trade_no,
      providerTradeNo: params.trade_no,
      totalAmountYuan: params.total_amount,
      rawNotify: params,
    });
    return new NextResponse("success", { status: 200 });
  } catch {
    return new NextResponse("failure", { status: 400 });
  }
}
