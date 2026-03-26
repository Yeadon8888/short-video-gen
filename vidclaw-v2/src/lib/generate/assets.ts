import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAssets } from "@/lib/db/schema";
import type {
  ImageSelectionMode,
  SelectedAssetSnapshot,
} from "@/lib/video/types";

const DEFAULT_REFERENCE_LIMIT = 4;

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export async function resolveSelectedImageAssets(params: {
  userId: string;
  selectedImageIds?: string[];
  fallbackLimit?: number;
}): Promise<SelectedAssetSnapshot[]> {
  const ids = uniqueIds(params.selectedImageIds ?? []);

  if (ids.length > 0) {
    const rows = await db
      .select({
        id: userAssets.id,
        url: userAssets.url,
        filename: userAssets.filename,
      })
      .from(userAssets)
      .where(
        and(
          eq(userAssets.userId, params.userId),
          eq(userAssets.type, "image"),
          inArray(userAssets.id, ids),
        ),
      );

    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  }

  const rows = await db
    .select({
      id: userAssets.id,
      url: userAssets.url,
      filename: userAssets.filename,
    })
    .from(userAssets)
    .where(and(eq(userAssets.userId, params.userId), eq(userAssets.type, "image")))
    .orderBy(desc(userAssets.createdAt))
    .limit(params.fallbackLimit ?? DEFAULT_REFERENCE_LIMIT);

  return rows;
}

export function assignImageSequence(params: {
  assets: SelectedAssetSnapshot[];
  count: number;
  selectionMode: ImageSelectionMode;
}): SelectedAssetSnapshot[] {
  const { assets, count, selectionMode } = params;
  if (assets.length === 0 || count <= 0) return [];

  if (selectionMode === "single") {
    return Array.from({ length: count }, () => assets[0]);
  }

  return Array.from({ length: count }, (_, index) => assets[index % assets.length]);
}
