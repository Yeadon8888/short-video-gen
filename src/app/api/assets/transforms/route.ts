import { after, NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  listAssetTransformJobs,
  submitAssetTransformJobs,
} from "@/lib/image-edit/jobs";
import { triggerAssetTransformWorker } from "@/lib/image-edit/worker";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const assetIds = req.nextUrl.searchParams
    .get("assetIds")
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const jobs = await listAssetTransformJobs({
    userId: user.id,
    assetIds,
  });

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const body = await req.json().catch(() => ({})) as {
    assetIds?: string[];
  };

  try {
    const result = await submitAssetTransformJobs({
      userId: user.id,
      assetIds: body.assetIds ?? [],
    });

    if (result.createdCount > 0) {
      after(async () => {
        await triggerAssetTransformWorker({
          origin: req.nextUrl.origin,
        }).catch(() => undefined);
      });
    }

    return NextResponse.json({
      ok: true,
      requestedCount: result.requestedCount,
      createdCount: result.createdCount,
      skippedCount: result.skippedCount,
      creditsPerJob: result.model.creditsPerGen,
      modelSlug: result.model.slug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片转换任务提交失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
