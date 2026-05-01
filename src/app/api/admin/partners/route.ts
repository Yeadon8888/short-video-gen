import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  createOrUpdatePartner,
  listPartners,
  updatePartnerStatus,
} from "@/lib/partners";

/** GET /api/admin/partners — list partner accounts */
export async function GET(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const search = req.nextUrl.searchParams.get("search") ?? "";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "20")));

  const result = await listPartners({ search, page, limit });

  return NextResponse.json({
    partners: result.rows,
    total: result.total,
    page,
    limit,
  });
}

/** POST /api/admin/partners — create or update a partner profile for a user */
export async function POST(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const body = (await req.json()) as {
    userId?: string;
    code?: string;
    displayName?: string | null;
    commissionRateBps?: number;
    status?: "active" | "disabled";
  };

  if (!body.userId || !body.code) {
    return NextResponse.json({ error: "userId and code are required" }, { status: 400 });
  }

  try {
    const partner = await createOrUpdatePartner({
      adminId: authResult.user.id,
      userId: body.userId,
      code: body.code,
      displayName: body.displayName,
      commissionRateBps: body.commissionRateBps,
      status: body.status,
    });
    return NextResponse.json({ partner });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建伙伴失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** PATCH /api/admin/partners — enable or disable a partner profile */
export async function PATCH(req: NextRequest) {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const body = (await req.json()) as {
    partnerId?: string;
    status?: "active" | "disabled";
  };

  if (!body.partnerId || !body.status) {
    return NextResponse.json({ error: "partnerId and status are required" }, { status: 400 });
  }

  const partner = await updatePartnerStatus({
    partnerId: body.partnerId,
    status: body.status,
  });

  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  return NextResponse.json({ partner });
}
