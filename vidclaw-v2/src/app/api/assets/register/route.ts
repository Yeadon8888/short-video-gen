import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userAssets } from "@/lib/db/schema";

/**
 * POST /api/assets/register
 * After the browser uploads directly to the Cloudflare Worker,
 * call this to record the asset in the database.
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const body = (await req.json()) as {
    key?: string;
    url?: string;
    size?: number;
    filename?: string;
    contentType?: string;
  };

  if (!body.key || !body.url) {
    return NextResponse.json({ error: "Missing key or url" }, { status: 400 });
  }

  // Verify the key belongs to this user
  const prefix = (process.env.UPLOAD_PREFIX?.trim() ?? "vidclaw-assets").replace(
    /^\/+|\/+$/g,
    "",
  );
  const expectedPrefix = `${prefix}/${user.id}/`;
  if (!body.key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 403 });
  }

  const isVideo = body.contentType?.startsWith("video/") ?? body.key.includes("/vid-");
  const assetType = isVideo ? ("video" as const) : ("image" as const);

  const [record] = await db
    .insert(userAssets)
    .values({
      userId: user.id,
      type: assetType,
      r2Key: body.key,
      url: body.url,
      filename: body.filename ?? null,
      sizeBytes: body.size ?? null,
    })
    .returning();

  return NextResponse.json(record);
}
