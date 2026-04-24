import JSZip from "jszip";
import { fetchAssetBuffer } from "@/lib/storage/gateway";

function sanitizeSegment(value: string): string {
  const segment = value.replace(/[\\:*?"<>|]+/g, "-").trim();
  if (!segment || segment === "." || segment === "..") return "file";
  return segment;
}

function sanitizePath(value: string, fallback: string): string {
  const parts = value
    .split(/[\/]+/)
    .map(sanitizeSegment)
    .filter(Boolean);
  return parts.length > 0 ? parts.join("/") : fallback;
}

export function sanitizeDownloadFilename(value: string, fallback = "download"): string {
  return sanitizeSegment(value || fallback);
}

export function contentDispositionAttachment(filename: string): string {
  const fallback = sanitizeDownloadFilename(filename, "download").replace(/[^ -~]/g, "-");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function guessExtension(url: string, mimeType: string): string {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split("/").pop() ?? "";
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex > -1 && dotIndex < name.length - 1) {
      return name.slice(dotIndex + 1).toLowerCase();
    }
  } catch {
    // Fall through to MIME based extension.
  }

  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "bin";
}

export interface ZipAssetItem {
  url: string;
  fileStem: string;
}

export async function buildZipArchive(params: {
  items: ZipAssetItem[];
  rootFolder: string;
}) {
  const zip = new JSZip();
  const folder = zip.folder(sanitizeSegment(params.rootFolder)) ?? zip;

  await Promise.all(
    params.items.map(async (item, index) => {
      const fetched = await fetchAssetBuffer(item.url);
      const extension = guessExtension(item.url, fetched.mimeType);
      const path = sanitizePath(item.fileStem || `file-${index + 1}`, `file-${index + 1}`);
      folder.file(`${path}.${extension}`, Buffer.from(fetched.buffer));
    }),
  );

  return zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
