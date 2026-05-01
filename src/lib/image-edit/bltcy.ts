import { MODEL_CAPABILITIES } from "@/lib/models/capabilities";
import { getActiveModelByCapability } from "@/lib/models/repository";
import { loadSystemPrompts } from "@/lib/system-prompts";
import type { Model } from "@/lib/db/schema";
import {
  buildImageDataUrl,
  canUseRemoteImageUrl,
} from "@/lib/image-edit/payload";
import { fetchWithRetry } from "@/lib/api/retry";
import { fetchAssetBuffer } from "@/lib/storage/gateway";

const DEFAULT_BASE_URL = "https://api.bltcy.ai";
const DEFAULT_MODEL = "gemini-3.1-flash-image-preview-4k";

// ─── Response parsing ─────────────────────────────────────

interface BltcyChatResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<
            | { type?: "text"; text?: string }
            | {
                type?: "output_text" | "image_url";
                text?: string;
                image_url?: { url?: string };
              }
          >;
    };
  }>;
}

function extractUrlsFromText(text: string): string[] {
  // data URIs (base64 inline images)
  const dataMatch = text.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
  if (dataMatch) return [dataMatch[0]];

  // Markdown image syntax ![...](url)
  const mdMatch = text.match(
    /!\[.*?\]\((data:image\/[^\s)]+|https?:\/\/[^\s)]+)\)/,
  );
  if (mdMatch) return [mdMatch[1]];

  // Regular HTTP URLs
  const matches = text.match(/https?:\/\/[^\s"')\]]+/g) ?? [];
  return matches.map((match) => match.replace(/[),.\]]+$/g, ""));
}

export function extractResponseImageUrl(
  response: BltcyChatResponse,
): string | null {
  const content = response.choices?.[0]?.message?.content;
  if (!content) return null;

  if (typeof content === "string") {
    return extractUrlsFromText(content)[0] ?? null;
  }

  for (const part of content) {
    if (part.type === "image_url" && part.image_url?.url) {
      return part.image_url.url;
    }
    if ((part.type === "text" || part.type === "output_text") && part.text) {
      const url = extractUrlsFromText(part.text)[0];
      if (url) return url;
    }
  }

  return null;
}

// ─── Shared BLTCY request ─────────────────────────────────

function normalizeBaseUrl(baseUrl?: string | null) {
  return (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/**
 * Make a BLTCY chat/completions request with image input.
 * Shared by both white-bg editing and scene generation.
 */
export async function bltcyImageRequest(params: {
  assetUrl: string;
  prompt: string;
  model: Pick<Model, "id" | "slug" | "apiKey" | "baseUrl" | "creditsPerGen">;
}): Promise<string> {
  const { model, prompt } = params;
  const apiKey = model.apiKey?.trim();
  if (!apiKey) {
    throw new Error("图片模型未配置 API Key。");
  }

  const isRemote = canUseRemoteImageUrl(params.assetUrl);
  const isLikelyWebp = params.assetUrl.toLowerCase().includes(".webp");
  const source = (isRemote && !isLikelyWebp)
    ? null
    : await fetchAssetBuffer(params.assetUrl);
  const baseUrl = normalizeBaseUrl(model.baseUrl);

  // Gemini doesn't support WebP — convert to JPEG before sending
  let imageInputUrl: string;
  if (source) {
    let { mimeType, buffer } = source;
    if (mimeType === "image/webp") {
      const sharp = (await import("sharp")).default;
      const jpegBuf = await sharp(Buffer.from(buffer)).jpeg({ quality: 90 }).toBuffer();
      const ab = new ArrayBuffer(jpegBuf.byteLength);
      new Uint8Array(ab).set(jpegBuf);
      buffer = ab;
      mimeType = "image/jpeg";
    }
    imageInputUrl = buildImageDataUrl({ mimeType, buffer });
  } else {
    imageInputUrl = params.assetUrl;
  }

  const body = JSON.stringify({
    model: model.slug || DEFAULT_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageInputUrl } },
        ],
      },
    ],
    stream: false,
  });

  const response = await fetchWithRetry(
    () =>
      fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body,
        signal: AbortSignal.timeout(300_000),
      }),
  );

  const json = (await response.json()) as BltcyChatResponse;
  const imageUrl = extractResponseImageUrl(json);
  if (!imageUrl) {
    throw new Error("图片模型未返回可解析的图片地址。");
  }

  return imageUrl;
}

// ─── Public API ───────────────────────────────────────────

export async function editProductImageToPortraitWhiteBg(params: {
  assetUrl: string;
  model?: Pick<Model, "id" | "slug" | "apiKey" | "baseUrl" | "creditsPerGen">;
}) {
  const model =
    params.model ??
    (await getActiveModelByCapability({
      capability: MODEL_CAPABILITIES.imageEdit,
    }));

  const systemPrompts = await loadSystemPrompts();
  const imageUrl = await bltcyImageRequest({
    assetUrl: params.assetUrl,
    prompt: systemPrompts.product_white_bg,
    model,
  });

  return { model, imageUrl };
}
