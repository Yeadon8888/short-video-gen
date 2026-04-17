export const MAX_CONCURRENT_ASSET_TRANSFORMS = 3;

function normalizeRequestedCount(requestedCount?: number) {
  if (!Number.isFinite(requestedCount)) {
    return MAX_CONCURRENT_ASSET_TRANSFORMS;
  }

  return Math.max(1, Math.min(Math.trunc(requestedCount ?? 0), MAX_CONCURRENT_ASSET_TRANSFORMS));
}

export function resolveAssetTransformAvailableSlots(params: {
  processingCount: number;
  requestedCount?: number;
}) {
  const activeCount = Math.max(0, Math.trunc(params.processingCount));
  const requestedCount = normalizeRequestedCount(params.requestedCount);
  const remainingCapacity = Math.max(0, MAX_CONCURRENT_ASSET_TRANSFORMS - activeCount);

  return Math.min(remainingCapacity, requestedCount);
}
