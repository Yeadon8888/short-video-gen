import { NextResponse } from "next/server";
import { getAlipayConfig, listCreditPackages } from "@/lib/payments/config";

export async function GET() {
  const [config, packages] = await Promise.all([
    getAlipayConfig(),
    listCreditPackages(),
  ]);

  return NextResponse.json({
    config: {
      enabled: config.enabled,
    },
    packages: packages.filter((item) => !item.disabled),
  });
}
