/**
 * Product scene image generation.
 *
 * Reuses the shared `bltcyImageRequest` from bltcy.ts — same API,
 * same retry logic, same response parsing. Only the prompts differ.
 */

import { MODEL_CAPABILITIES } from "@/lib/models/capabilities";
import { getActiveModelByCapability } from "@/lib/models/repository";
import type { Model } from "@/lib/db/schema";
import { bltcyImageRequest } from "@/lib/image-edit/bltcy";
import {
  isOpenAiImagesEditModel,
  openaiImagesEditRequest,
} from "@/lib/image-edit/openai-images-edit";
import {
  loadSystemPrompts,
  type SystemPromptKey,
} from "@/lib/system-prompts";

export type SceneStyle =
  | "lifestyle"
  | "model"
  | "detail"
  | "flatlay"
  | "outdoor"
  | "studio";

export type SceneRegion =
  | "auto"
  | "western"
  | "east_asian_non_cn"
  | "southeast_asian"
  | "malaysian"
  | "mexican"
  | "middle_east";

export type ScenePromptLanguage = "zh" | "en";

const REGION_PHRASE_ZH: Record<Exclude<SceneRegion, "auto">, string> = {
  western: "欧美（北美/欧洲）人种外貌",
  east_asian_non_cn: "日韩东亚（非中国大陆）人种外貌",
  southeast_asian: "东南亚人种外貌",
  malaysian: "马来西亚当地人外貌",
  mexican: "墨西哥/拉美人种外貌",
  middle_east: "中东人种外貌",
};

const REGION_PHRASE_EN: Record<Exclude<SceneRegion, "auto">, string> = {
  western: "Western (North American / European) ethnicity",
  east_asian_non_cn: "East Asian (Japanese or Korean, not mainland-Chinese) ethnicity",
  southeast_asian: "Southeast Asian ethnicity",
  malaysian: "local Malaysian ethnicity",
  mexican: "Mexican / Latino ethnicity",
  middle_east: "Middle-Eastern ethnicity",
};

// Styles where a person may appear — region guidance only makes sense here.
const PEOPLE_STYLES: ReadonlySet<SceneStyle> = new Set([
  "lifestyle",
  "model",
  "outdoor",
]);

function getScenePromptKey(
  style: SceneStyle,
  language: ScenePromptLanguage,
): SystemPromptKey {
  return `scene_${style}_${language}` as SystemPromptKey;
}

function buildScenePrompt(params: {
  style: SceneStyle;
  language: ScenePromptLanguage;
  region: SceneRegion;
  basePrompt: string;
  customPrompt?: string;
}): string {
  const parts: string[] = [params.basePrompt.trim()];

  if (params.region !== "auto" && PEOPLE_STYLES.has(params.style)) {
    if (params.language === "en") {
      const phrase = REGION_PHRASE_EN[params.region];
      parts.push(
        `If any human appears in the image, they must have ${phrase}. Do NOT default to a Chinese-looking model.`,
      );
    } else {
      const phrase = REGION_PHRASE_ZH[params.region];
      parts.push(
        `如果画面中出现人物，人物必须是${phrase}，不要默认生成中国人。`,
      );
    }
  }

  const custom = params.customPrompt?.trim();
  if (custom) {
    parts.push(
      params.language === "en"
        ? `Additional user requirement: ${custom}`
        : `用户补充要求：${custom}`,
    );
  }

  return parts.join("\n\n");
}

/**
 * Generate a single scene image for a product.
 */
export async function generateProductSceneImage(params: {
  assetUrl: string;
  style: SceneStyle;
  customPrompt?: string;
  region?: SceneRegion;
  language?: ScenePromptLanguage;
  model?: Pick<Model, "id" | "slug" | "apiKey" | "baseUrl" | "creditsPerGen">;
}): Promise<{
  model: Pick<Model, "id" | "slug" | "apiKey" | "baseUrl" | "creditsPerGen">;
  imageUrl: string;
}> {
  const model =
    params.model ??
    (await getActiveModelByCapability({
      capability: MODEL_CAPABILITIES.imageEdit,
    }));

  const language = params.language ?? "zh";
  const systemPrompts = await loadSystemPrompts();
  const prompt = buildScenePrompt({
    style: params.style,
    language,
    region: params.region ?? "auto",
    basePrompt: systemPrompts[getScenePromptKey(params.style, language)],
    customPrompt: params.customPrompt,
  });

  const imageUrl = isOpenAiImagesEditModel(model)
    ? await openaiImagesEditRequest({
        assetUrl: params.assetUrl,
        prompt,
        model,
      })
    : await bltcyImageRequest({
        assetUrl: params.assetUrl,
        prompt,
        model,
      });

  return { model, imageUrl };
}

export const SCENE_STYLES: { value: SceneStyle; label: string }[] = [
  { value: "lifestyle", label: "生活场景" },
  { value: "model", label: "模特展示" },
  { value: "detail", label: "细节特写" },
  { value: "flatlay", label: "平铺摆拍" },
  { value: "outdoor", label: "户外场景" },
  { value: "studio", label: "棚拍风格" },
];
