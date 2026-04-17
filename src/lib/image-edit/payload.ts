export function canUseRemoteImageUrl(assetUrl: string) {
  try {
    const url = new URL(assetUrl);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function buildImageDataUrl(params: { mimeType: string; buffer: ArrayBuffer }) {
  return `data:${params.mimeType};base64,${Buffer.from(params.buffer).toString("base64")}`;
}

/**
 * Parse a base64 data URI into a buffer + MIME type.
 * Companion to `buildImageDataUrl`.
 */
export function parseImageDataUrl(
  dataUrl: string,
): { mimeType: string; buffer: ArrayBuffer } | null {
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;
  const binary = Buffer.from(match[2], "base64");
  return {
    mimeType: match[1],
    buffer: binary.buffer.slice(
      binary.byteOffset,
      binary.byteOffset + binary.byteLength,
    ),
  };
}

/**
 * Resolve image content from either a data URI or a remote URL.
 * Centralizes the branching that was previously scattered across routes.
 */
export async function resolveImageBuffer(
  imageUrl: string,
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
  if (imageUrl.startsWith("data:")) {
    const parsed = parseImageDataUrl(imageUrl);
    if (!parsed) throw new Error("无法解析 base64 图片数据");
    return parsed;
  }

  // Dynamic import to avoid circular dependency with gateway
  const { fetchAssetBuffer } = await import("@/lib/storage/gateway");
  return fetchAssetBuffer(imageUrl);
}
