import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Timer } from "@/lib/timing";

/**
 * Cached DB reader. Every caller shares the same result across
 * the revalidation window, dropping the per-request Supabase
 * round-trip for this endpoint from ~1s TTFB to <50ms on cache hit.
 */
const getLatestAnnouncements = unstable_cache(
  async () =>
    db
      .select({
        id: announcements.id,
        content: announcements.content,
        createdAt: announcements.createdAt,
      })
      .from(announcements)
      .orderBy(desc(announcements.createdAt))
      .limit(10),
  ["announcements-latest-v1"],
  { revalidate: 300, tags: ["announcements"] },
);

// GET /api/announcements — public, returns latest 10 (cached ~5 min)
export async function GET() {
  const t = new Timer();
  t.start("total");
  const rows = await getLatestAnnouncements();
  t.end("total");
  return NextResponse.json(rows, { headers: t.headers() });
}
