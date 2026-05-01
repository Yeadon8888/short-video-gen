import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPartnerDashboard } from "@/lib/partners";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  if (authResult.user.role !== "partner" && authResult.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dashboard = await getPartnerDashboard(authResult.user.id);
  if (!dashboard) {
    return NextResponse.json({ error: "Partner profile not found" }, { status: 404 });
  }

  return NextResponse.json(dashboard);
}
