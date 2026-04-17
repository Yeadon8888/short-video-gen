import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userAssets } from "@/lib/db/schema";

/**
 * GET /api/assets/list — List user's image assets (for client components)
 */
export async function GET(_req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const assets = await db
    .select({
      id: userAssets.id,
      url: userAssets.url,
      filename: userAssets.filename,
    })
    .from(userAssets)
    .where(and(eq(userAssets.userId, user.id), eq(userAssets.type, "image")))
    .orderBy(desc(userAssets.createdAt))
    .limit(100);

  return NextResponse.json({ assets });
}
