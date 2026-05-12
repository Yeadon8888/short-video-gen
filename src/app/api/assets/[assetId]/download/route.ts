import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userAssets } from "@/lib/db/schema";

export const maxDuration = 120;

export async function GET(
  _req: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;
  const { assetId } = await context.params;

  const [asset] = await db
    .select({
      id: userAssets.id,
      url: userAssets.url,
    })
    .from(userAssets)
    .where(
      and(
        eq(userAssets.id, assetId),
        eq(userAssets.userId, user.id),
        eq(userAssets.type, "image"),
      ),
    )
    .limit(1);

  if (!asset) {
    return NextResponse.json(
      { error: "图片不存在。" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.redirect(asset.url, 302);
}
