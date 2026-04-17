import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { galleryItems, users } from "@/lib/db/schema";

/**
 * GET /api/gallery/[id] — Public single item detail + increment view count
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [item] = await db
    .select({
      id: galleryItems.id,
      title: galleryItems.title,
      videoUrl: galleryItems.videoUrl,
      thumbnailUrl: galleryItems.thumbnailUrl,
      prompt: galleryItems.prompt,
      scriptJson: galleryItems.scriptJson,
      modelSlug: galleryItems.modelSlug,
      tags: galleryItems.tags,
      viewCount: galleryItems.viewCount,
      likeCount: galleryItems.likeCount,
      createdAt: galleryItems.createdAt,
      authorName: users.name,
    })
    .from(galleryItems)
    .innerJoin(users, eq(galleryItems.userId, users.id))
    .where(eq(galleryItems.id, id))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Increment view count (fire-and-forget)
  db.update(galleryItems)
    .set({ viewCount: sql`${galleryItems.viewCount} + 1` })
    .where(eq(galleryItems.id, id))
    .then(() => {})
    .catch((e) => console.error("[gallery] view count update failed:", e));

  return NextResponse.json(item);
}
