import { after, NextRequest, NextResponse } from "next/server";
import {
  getMaxConcurrentAssetTransforms,
  processPendingAssetTransformJobs,
} from "@/lib/image-edit/jobs";
import {
  isAuthorizedInternalWorkerRequest,
} from "@/lib/image-edit/worker";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isAuthorizedInternalWorkerRequest(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const acceptedAt = new Date().toISOString();

  after(async () => {
    await processPendingAssetTransformJobs({
      limit: getMaxConcurrentAssetTransforms(),
    }).catch(() => undefined);
  });

  return NextResponse.json({
    ok: true,
    accepted: true,
    acceptedAt,
  }, { status: 202 });
}
