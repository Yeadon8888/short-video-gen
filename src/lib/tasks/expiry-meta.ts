export const VIDEO_EXPIRY_DAYS = 3;

export function computeVideoExpiryDate(createdAt: string | Date): Date {
  const created = new Date(createdAt);
  return new Date(created.getTime() + VIDEO_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export function getDaysUntilVideoExpiry(
  createdAt: string | Date,
  now = new Date(),
): number {
  const expiry = computeVideoExpiryDate(createdAt);
  return Math.max(
    0,
    Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );
}

export function shouldShowVideoExpiryCountdown(params: {
  status: string;
  successCount: number;
}): boolean {
  return (
    (params.status === "done" || params.status === "failed") &&
    params.successCount > 0
  );
}
