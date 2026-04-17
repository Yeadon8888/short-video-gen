import JSZip from "jszip";
import { fetchAssetBuffer } from "@/lib/storage/gateway";

function sanitizeSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").trim() || "file";
}

function guessExtension(url: string, mimeType: string): string {
  const pathname = new URL(url).pathname;
  const name = pathname.split("/").pop() ?? "";
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex > -1 && dotIndex < name.length - 1) {
    return name.slice(dotIndex + 1).toLowerCase();
  }

  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("webm")) return "webm";
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
      const filename = `${sanitizeSegment(item.fileStem || `video-${index + 1}`)}.${extension}`;
      folder.file(filename, Buffer.from(fetched.buffer));
    }),
  );

  return zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
