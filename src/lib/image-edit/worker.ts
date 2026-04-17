const INTERNAL_ASSET_TRANSFORM_ROUTE = "/api/internal/assets/transforms/process";

export function getInternalWorkerSecret(): string | null {
  const secret =
    process.env.INTERNAL_TICK_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  return secret || null;
}

export function isAuthorizedInternalWorkerRequest(authHeader: string | null): boolean {
  const secret = getInternalWorkerSecret();
  if (!secret || !authHeader) return false;

  const bearer = authHeader.replace("Bearer ", "").trim();
  return bearer === secret;
}

export async function triggerAssetTransformWorker(params: { origin: string }) {
  const secret = getInternalWorkerSecret();
  if (!secret) {
    return { ok: false, skipped: true as const, reason: "missing_secret" };
  }

  const url = new URL(INTERNAL_ASSET_TRANSFORM_ROUTE, params.origin);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `触发图片任务 worker 失败: HTTP ${response.status} ${message.slice(0, 200)}`,
    );
  }

  return { ok: true as const };
}
