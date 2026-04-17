import {
  fetchAssetBuffer,
  isUploadGatewayEnabled,
  uploadVideo,
} from "@/lib/storage/gateway";

function buildGeneratedVideoFilename(
  taskId: string,
  index: number,
  mimeType: string,
): string {
  if (mimeType.includes("quicktime")) {
    return `task-${taskId}-${index + 1}.mov`;
  }
  if (mimeType.includes("webm")) {
    return `task-${taskId}-${index + 1}.webm`;
  }
  return `task-${taskId}-${index + 1}.mp4`;
}

export async function persistGeneratedVideos(params: {
  userId: string;
  taskId: string;
  urls: string[];
}): Promise<{ urls: string[]; storageKeys: string[] }> {
  if (!isUploadGatewayEnabled() || params.urls.length === 0) {
    return {
      urls: params.urls,
      storageKeys: [],
    };
  }

  const persistedUrls: string[] = [];
  const storageKeys: string[] = [];

  for (let index = 0; index < params.urls.length; index += 1) {
    const url = params.urls[index];

    try {
      const fetched = await fetchAssetBuffer(url);
      const stored = await uploadVideo({
        userId: params.userId,
        filename: buildGeneratedVideoFilename(params.taskId, index, fetched.mimeType),
        data: fetched.buffer,
        contentType: fetched.mimeType,
      });

      persistedUrls.push(stored.url);
      storageKeys.push(stored.key);
    } catch {
      persistedUrls.push(url);
    }
  }

  return {
    urls: persistedUrls,
    storageKeys,
  };
}
