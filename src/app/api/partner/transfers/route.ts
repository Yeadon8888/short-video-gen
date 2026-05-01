import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { transferPartnerCredits } from "@/lib/partners";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.user.role !== "partner" && authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    toUserId?: string;
    amount?: number;
    reason?: string | null;
  };

  if (!body.toUserId || typeof body.amount !== "number") {
    return NextResponse.json({ error: "toUserId and amount are required" }, { status: 400 });
  }

  try {
    const result = await transferPartnerCredits({
      partnerUserId: authResult.user.id,
      toUserId: body.toUserId,
      amount: body.amount,
      reason: body.reason,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "积分划拨失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
