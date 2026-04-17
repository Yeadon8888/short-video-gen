import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getAlipayConfig,
  listCreditPackages,
  saveAlipayConfig,
  saveCreditPackages,
  type AlipayConfig,
  type CreditPackage,
} from "@/lib/payments/config";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const [config, packages] = await Promise.all([
    getAlipayConfig(),
    listCreditPackages(),
  ]);

  return NextResponse.json({ config, packages });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    config: AlipayConfig;
    packages: CreditPackage[];
  };

  if (!body.config || !Array.isArray(body.packages)) {
    return NextResponse.json({ error: "缺少支付配置或充值套餐" }, { status: 400 });
  }

  await Promise.all([
    saveAlipayConfig({ config: body.config, adminId: auth.user.id }),
    saveCreditPackages({ packages: body.packages, adminId: auth.user.id }),
  ]);

  return NextResponse.json({ ok: true });
}
