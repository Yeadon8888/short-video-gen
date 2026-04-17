import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { models } from "@/lib/db/schema";
import {
  getModelCapabilityLabel,
  type ModelCapability,
} from "@/lib/models/capabilities";

export async function listModelsByCapability(capability?: ModelCapability) {
  const query = db
    .select()
    .from(models);

  if (capability) {
    return query
      .where(eq(models.capability, capability))
      .orderBy(asc(models.sortOrder));
  }

  return query.orderBy(asc(models.sortOrder));
}

export async function getActiveModelByCapability(params: {
  capability: ModelCapability;
  slug?: string | null;
}) {
  if (params.slug) {
    const [row] = await db
      .select()
      .from(models)
      .where(
        and(
          eq(models.slug, params.slug),
          eq(models.capability, params.capability),
          eq(models.isActive, true),
        ),
      )
      .limit(1);

    if (row) {
      return row;
    }

    throw new Error(`模型不可用或不存在: ${params.slug}`);
  }

  const [row] = await db
    .select()
    .from(models)
    .where(
      and(
        eq(models.capability, params.capability),
        eq(models.isActive, true),
      ),
    )
    .orderBy(asc(models.sortOrder))
    .limit(1);

  if (!row) {
    const label = getModelCapabilityLabel(params.capability);
    throw new Error(`没有可用的${label}模型，请先在管理后台启用模型。`);
  }

  return row;
}
