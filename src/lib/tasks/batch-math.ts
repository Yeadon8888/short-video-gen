const MIN_UNITS_PER_PRODUCT = 1;
const MAX_UNITS_PER_PRODUCT = 5;

const ACTIVE_BATCH_TASK_STATUSES = new Set([
  "pending",
  "analyzing",
  "generating",
  "polling",
  "scheduled",
]);

export interface BatchUnitsSnapshot {
  batchUnitsPerProduct?: number | null;
  count?: number | null;
}

export function normalizeBatchUnitsPerProduct(
  value: number | null | undefined,
): number {
  if (!Number.isFinite(value)) return MIN_UNITS_PER_PRODUCT;
  return Math.min(
    Math.max(Math.trunc(value ?? MIN_UNITS_PER_PRODUCT), MIN_UNITS_PER_PRODUCT),
    MAX_UNITS_PER_PRODUCT,
  );
}

export function computeBatchTotalVideoCount(
  productCount: number,
  unitsPerProduct: number,
): number {
  return Math.max(0, Math.trunc(productCount)) *
    normalizeBatchUnitsPerProduct(unitsPerProduct);
}

export function resolveBatchUnitsPerProduct(
  value: BatchUnitsSnapshot | null | undefined,
): number {
  if (
    typeof value?.batchUnitsPerProduct === "number" &&
    value.batchUnitsPerProduct > 0
  ) {
    return normalizeBatchUnitsPerProduct(value.batchUnitsPerProduct);
  }

  if (typeof value?.count === "number" && value.count > 0) {
    return normalizeBatchUnitsPerProduct(value.count);
  }

  return MIN_UNITS_PER_PRODUCT;
}

export interface BatchTaskProgressSnapshot {
  status: string;
  requestedCount?: number | null;
  resultUrls?: string[] | null;
  paramsJson?: BatchUnitsSnapshot | null;
}

export function getBatchTaskPlannedVideoCount(
  task: BatchTaskProgressSnapshot,
): number {
  if (typeof task.requestedCount === "number" && task.requestedCount > 0) {
    return task.requestedCount;
  }

  return resolveBatchUnitsPerProduct(task.paramsJson);
}

export function summarizeBatchTaskVideos(task: BatchTaskProgressSnapshot) {
  const plannedCount = getBatchTaskPlannedVideoCount(task);
  const successCount = task.resultUrls?.length ?? 0;
  const isActive = ACTIVE_BATCH_TASK_STATUSES.has(task.status);
  const failedCount = isActive ? 0 : Math.max(0, plannedCount - successCount);

  return {
    plannedCount,
    successCount,
    failedCount,
    isActive,
  };
}
