import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userAssets } from "@/lib/db/schema";
import {
  buildZipArchive,
  contentDispositionAttachment,
} from "@/lib/tasks/downloads";

export const maxDuration = 300;

type DownloadAsset = {
  id: string;
  url: string;
  filename: string | null;
};

function removeExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const body = (await req.json().catch(() => ({}))) as { assetIds?: string[] };
  const requestedIds = [...new Set(body.assetIds ?? [])].slice(0, 100);

  if (requestedIds.length === 0) {
    return NextResponse.json(
      { error: "请选择要下载的图片。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const assets = await db
    .select({
      id: userAssets.id,
      url: userAssets.url,
      filename: userAssets.filename,
    })
    .from(userAssets)
    .where(
      and(
        eq(userAssets.userId, user.id),
        eq(userAssets.type, "image"),
        inArray(userAssets.id, requestedIds),
      ),
    )
    .orderBy(desc(userAssets.createdAt));

  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const orderedAssets = requestedIds
    .map((id) => assetById.get(id))
    .filter((asset): asset is DownloadAsset => Boolean(asset));

  if (orderedAssets.length === 0) {
    return NextResponse.json(
      { error: "没有可下载的图片。" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const zip = await buildZipArchive({
    rootFolder: "product-images",
    items: orderedAssets.map((asset, index) => ({
      url: asset.url,
      fileStem: `${String(index + 1).padStart(2, "0")}-${removeExtension(asset.filename || `product-image-${asset.id.slice(0, 8)}`)}`,
    })),
  });

  return new NextResponse(zip, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDispositionAttachment("product-images.zip"),
      "Cache-Control": "no-store",
    },
  });
}
