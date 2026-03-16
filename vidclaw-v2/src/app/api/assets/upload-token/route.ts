import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * POST /api/assets/upload-token
 * Returns a direct-upload config so the browser can POST to the Cloudflare Worker
 * bypassing Vercel's 4.5 MB body-size limit.
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user } = authResult;

  const baseUrl = process.env.UPLOAD_API_URL?.trim().replace(/\/+$/, "") ?? "";
  const apiKey = process.env.UPLOAD_API_KEY?.trim() ?? "";
  const prefix = (process.env.UPLOAD_PREFIX?.trim() ?? "vidclaw-assets").replace(
    /^\/+|\/+$/g,
    "",
  );

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      { error: "Upload gateway not configured" },
      { status: 503 },
    );
  }

  const { filename, contentType } = (await req.json()) as {
    filename?: string;
    contentType?: string;
  };

  const ext = getExtension(filename ?? "file.bin");
  const isVideo = contentType?.startsWith("video/");
  const tag = isVideo ? "vid" : "img";
  const key = `${prefix}/${user.id}/${tag}-${crypto.randomUUID()}.${ext}`;

  const uploadUrl = `${baseUrl}/upload?key=${encodeURIComponent(key)}`;

  return NextResponse.json({ uploadUrl, apiKey, key });
}

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  const ext = parts.length > 1 ? parts.pop() : "bin";
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : "bin";
}
