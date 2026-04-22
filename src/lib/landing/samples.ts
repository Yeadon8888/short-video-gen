import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { galleryItems, models } from "@/lib/db/schema";

export type HeroSample = {
  videoUrl: string;
  thumbnailUrl: string | null;
  title: string;
  modelSlug: string | null;
};

export type ModelSample = {
  slug: string;
  name: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
};

async function loadHero(): Promise<HeroSample | null> {
  const [row] = await db
    .select({
      videoUrl: galleryItems.videoUrl,
      thumbnailUrl: galleryItems.thumbnailUrl,
      title: galleryItems.title,
      modelSlug: galleryItems.modelSlug,
    })
    .from(galleryItems)
    .where(
      and(
        eq(galleryItems.isApproved, true),
        isNotNull(galleryItems.videoUrl),
      ),
    )
    .orderBy(
      desc(sql`${galleryItems.viewCount} * 10 + ${galleryItems.likeCount} * 50`),
      desc(galleryItems.createdAt),
    )
    .limit(1);
  return row ?? null;
}

async function loadModelSamples(): Promise<ModelSample[]> {
  const videoModels = await db
    .select({
      slug: models.slug,
      name: models.name,
      sortOrder: models.sortOrder,
    })
    .from(models)
    .where(
      and(eq(models.capability, "video_generation"), eq(models.isActive, true)),
    )
    .orderBy(models.sortOrder);

  const recent = await db
    .select({
      videoUrl: galleryItems.videoUrl,
      thumbnailUrl: galleryItems.thumbnailUrl,
      modelSlug: galleryItems.modelSlug,
    })
    .from(galleryItems)
    .where(
      and(
        eq(galleryItems.isApproved, true),
        isNotNull(galleryItems.modelSlug),
        isNotNull(galleryItems.videoUrl),
      ),
    )
    .orderBy(
      desc(sql`${galleryItems.viewCount} * 10 + ${galleryItems.likeCount} * 50`),
      desc(galleryItems.createdAt),
    )
    .limit(500);

  const bySlug = new Map<
    string,
    { videoUrl: string; thumbnailUrl: string | null }
  >();
  for (const row of recent) {
    if (row.modelSlug && !bySlug.has(row.modelSlug)) {
      bySlug.set(row.modelSlug, {
        videoUrl: row.videoUrl,
        thumbnailUrl: row.thumbnailUrl,
      });
    }
  }

  return videoModels.slice(0, 8).map((m) => {
    const sample = bySlug.get(m.slug);
    return {
      slug: m.slug,
      name: m.name,
      videoUrl: sample?.videoUrl ?? null,
      thumbnailUrl: sample?.thumbnailUrl ?? null,
    };
  });
}

export const getLandingSamples = unstable_cache(
  async () => {
    const [hero, modelSamples] = await Promise.all([
      loadHero(),
      loadModelSamples(),
    ]);
    return { hero, modelSamples };
  },
  ["landing-samples-v1"],
  { revalidate: 300, tags: ["landing-samples"] },
);
