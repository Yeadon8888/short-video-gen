import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userAssets } from "@/lib/db/schema";
import { fetchAssetBuffer } from "@/lib/storage/gateway";
import {
  contentDispositionAttachment,
  sanitizeDownloadFilename,
} from "@/lib/tasks/downloads";

export const maxDuration = 120;

function extensionFromMimeType(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "bin";
}

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
      filename: userAssets.filename,
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

  const fetched = await fetchAssetBuffer(asset.url);
  const filename = sanitizeDownloadFilename(
    asset.filename || `product-image-${asset.id.slice(0, 8)}.${extensionFromMimeType(fetched.mimeType)}`,
    `product-image-${asset.id.slice(0, 8)}`,
  );

  return new NextResponse(fetched.buffer, {
    status: 200,
    headers: {
      "Content-Type": fetched.mimeType,
      "Content-Disposition": contentDispositionAttachment(filename),
      "Cache-Control": "no-store",
    },
  });
}
