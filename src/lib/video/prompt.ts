import { videoLanguageLabel } from "./languages";
import { applyReferencePromptPlaceholders } from "@/lib/system-prompts";
import type {
  OnScreenTextItem,
  RenderingInvariants,
  ScriptResult,
  Shot,
} from "./types";

function normalizePrompt(value: string): string {
  return value.trim();
}

function getGeminiImageScope(referenceImageCount: number): string {
  return referenceImageCount > 1
    ? "如果提供了多张参考图片，请将它们视为同一商品的不同角度或细节补充。"
    : "如果提供了参考图片，请将它视为最终视频必须保留的商品主体。";
}

function getFinalReferenceScope(referenceImageCount: number): string {
  return referenceImageCount > 1
    ? "Reference image constraints: treat all uploaded reference images as the same exact product shown from different angles or detail views."
    : "Reference image constraints: treat the uploaded reference image as the exact product that must appear in the final video.";
}

export function buildGeminiReferenceInstruction(
  referenceImageCount: number,
  referencePromptTemplate?: string,
): string {
  const imageScope =
    getGeminiImageScope(referenceImageCount);

  if (referencePromptTemplate?.trim()) {
    return normalizePrompt(
      applyReferencePromptPlaceholders({
        template: referencePromptTemplate,
        imageScope,
      }),
    );
  }

  return [
    "参考图强约束：",
    imageScope,
    "- 参考图中的商品身份、品类、包装、颜色、材质、外观关键特征必须保留，不能替换成别的商品。",
    "- 如果参考视频与参考图片冲突，以参考图片中的商品外观与商品身份为准；参考视频只用于学习镜头语言、节奏和叙事结构。",
    "- 生成的每个 shot 的 sora_prompt 以及 full_sora_prompt，都必须明确围绕参考图中的商品来设计镜头。",
    "- 最终视频必须让该商品清晰出现，并在关键镜头中作为主角被稳定展示，不能只复刻原视频风格却忽略商品。",
  ].join("\n");
}

export function buildScriptInstruction(params: {
  baseInstruction: string;
  referenceImageCount?: number;
  creativeBrief?: string;
  referencePromptTemplate?: string;
}): string {
  const instruction = normalizePrompt(params.baseInstruction);
  const referenceImageCount = params.referenceImageCount ?? 0;
  const creativeBrief = params.creativeBrief?.trim();
  const sections = [instruction];

  if (creativeBrief) {
    sections.push(
      [
        "用户补充要求：",
        creativeBrief,
        "- 上面的补充要求必须真实体现在分镜、sora_prompt 和 full_sora_prompt 中。",
      ].join("\n"),
    );
  }

  if (referenceImageCount <= 0) {
    return sections.join("\n\n");
  }

  sections.push(
    buildGeminiReferenceInstruction(
      referenceImageCount,
      params.referencePromptTemplate,
    ),
  );
  return sections.join("\n\n");
}

// ───────────────────────────────────────────────────────────────────────────
// Rendering-stage invariant blocks
// ───────────────────────────────────────────────────────────────────────────

/**
 * Treat any English-family label as "English" so the lip-sync clause does not
 * become the nonsense "must match English, not English". The surrounding lines
 * already forbid switching to English when the target language is non-English,
 * so we drop the negative clause entirely for English variants.
 */
function isEnglishFamily(label: string): boolean {
  return /english/i.test(label);
}

function buildLanguageBlock(languageLabel: string): string {
  const lines = [
    `Spoken-language constraint:`,
    `- Every character on screen must speak in ${languageLabel}.`,
    `- Any voiceover, narration, or subtitles baked into the video must be in ${languageLabel}.`,
  ];
  if (isEnglishFamily(languageLabel)) {
    lines.push(
      `- Lip-sync, mouth shapes, and pronunciation must match ${languageLabel}.`,
      `- Do not switch to another language, even for product names or catchphrases, unless the user explicitly requested mixed language.`,
    );
  } else {
    lines.push(
      `- Lip-sync, mouth shapes, and pronunciation must match ${languageLabel}, not English.`,
      `- Do not switch to English or any other language, even for product names or catchphrases, unless the user explicitly requested mixed language.`,
    );
  }
  return lines.join("\n");
}

function buildReferenceBlock(params: {
  count: number;
  templateOverride?: string;
}): string {
  const firstLine = getFinalReferenceScope(params.count);
  if (params.templateOverride?.trim()) {
    return normalizePrompt(
      applyReferencePromptPlaceholders({
        template: params.templateOverride,
        referenceScope: firstLine,
        imageScope: firstLine,
      }),
    );
  }
  return [
    firstLine,
    "- Keep the same product identity, category, packaging, silhouette, materials, colors, label details, and other defining visual traits from the reference image(s).",
    "- If the reference video conflicts with the reference image(s), preserve the product from the reference image(s) and only borrow pacing, composition, or storytelling from the video.",
    "- The product from the reference image(s) must stay clearly visible and prominent in the hero shots and key scenes.",
    "- Do not replace the product with another product, package, logo, or brand variation.",
    "- Build the generated video around showcasing that exact product while following the requested creative direction.",
  ].join("\n");
}

function formatOnScreenTextLine(item: OnScreenTextItem): string {
  const parts: string[] = [];
  if (item.shot_id !== undefined) parts.push(`shot ${item.shot_id}`);
  if (item.position) parts.push(item.position);
  if (item.locale) parts.push(item.locale);
  const meta = parts.length ? ` (${parts.join(", ")})` : "";
  return `- "${item.text}"${meta}`;
}

function buildOnScreenTextBlock(items: OnScreenTextItem[]): string {
  return [
    "On-screen text (verbatim, do not translate, render exactly as written):",
    ...items.map(formatOnScreenTextLine),
  ].join("\n");
}

function buildVoiceoverBlock(items: Array<{ shotId?: number; text: string }>): string {
  return [
    "Spoken lines (verbatim, do not translate, must be heard in the audio):",
    ...items.map(({ shotId, text }) =>
      shotId !== undefined ? `- shot ${shotId}: "${text}"` : `- "${text}"`,
    ),
  ].join("\n");
}

function buildPacingBlock(pacing: string): string {
  const normalized = pacing.trim().toLowerCase();
  if (normalized === "fast") {
    return [
      "Pacing constraint: snappy, fast-cut tempo.",
      "- Each shot transition under ~1.5 seconds; cuts should feel punchy.",
      "- Camera energy should be kinetic — handheld, whip-pans, or quick zooms are acceptable.",
      "- Do not let any single shot linger in static framing.",
    ].join("\n");
  }
  if (normalized === "slow") {
    return [
      "Pacing constraint: slow, cinematic tempo.",
      "- Hold each shot for at least 2.5 seconds; cuts should feel deliberate.",
      "- Smooth, tripod-stable camera motion preferred.",
    ].join("\n");
  }
  if (normalized === "medium") {
    return "Pacing constraint: medium-paced, balanced cuts (~2 seconds per shot).";
  }
  return [
    "Pacing constraint (verbatim from user):",
    `- ${pacing.trim()}`,
  ].join("\n");
}

function buildNegativeBlock(items: string[]): string {
  return [
    "Negative constraints (must NOT appear in the video):",
    ...items.map((item) => `- ${item}`),
  ].join("\n");
}

// ───────────────────────────────────────────────────────────────────────────
// Invariant extraction from a Gemini-produced ScriptResult
// ───────────────────────────────────────────────────────────────────────────

function normalizeOnScreenText(
  raw: ScriptResult["on_screen_text"] | undefined,
  shots: Shot[] | undefined,
): OnScreenTextItem[] {
  const items: OnScreenTextItem[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string") {
        const trimmed = entry.trim();
        if (trimmed) items.push({ text: trimmed });
      } else if (entry && typeof entry === "object" && typeof entry.text === "string") {
        const trimmed = entry.text.trim();
        if (trimmed) {
          items.push({
            text: trimmed,
            shot_id: entry.shot_id,
            position: entry.position,
            locale: entry.locale,
          });
        }
      }
    }
  }
  // Fallback: harvest from individual shots if the top-level array is empty.
  if (items.length === 0 && Array.isArray(shots)) {
    for (const shot of shots) {
      if (Array.isArray(shot.on_screen_text)) {
        for (const text of shot.on_screen_text) {
          if (typeof text === "string" && text.trim()) {
            items.push({ text: text.trim(), shot_id: shot.id });
          }
        }
      }
    }
  }
  return items;
}

function extractVoiceovers(
  shots: Shot[] | undefined,
): Array<{ shotId?: number; text: string }> {
  if (!Array.isArray(shots)) return [];
  const out: Array<{ shotId?: number; text: string }> = [];
  for (const shot of shots) {
    if (typeof shot.voiceover === "string" && shot.voiceover.trim()) {
      out.push({ shotId: shot.id, text: shot.voiceover.trim() });
    }
  }
  return out;
}

function normalizeNegative(raw: ScriptResult["negative"] | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function extractScriptInvariants(
  script: ScriptResult | undefined,
): Pick<RenderingInvariants, "onScreenText" | "pacing" | "negative" | "voiceovers"> {
  if (!script) return {};
  const onScreenText = normalizeOnScreenText(script.on_screen_text, script.shots);
  const voiceovers = extractVoiceovers(script.shots);
  const negative = normalizeNegative(script.negative);
  const pacing =
    typeof script.pacing === "string" && script.pacing.trim()
      ? script.pacing.trim()
      : undefined;

  return {
    onScreenText: onScreenText.length ? onScreenText : undefined,
    voiceovers: voiceovers.length ? voiceovers : undefined,
    negative: negative.length ? negative : undefined,
    pacing,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Final video prompt assembly
// ───────────────────────────────────────────────────────────────────────────

/**
 * Render an invariants object into a list of constraint sections. Each
 * non-empty invariant becomes one section. The order mirrors the legacy
 * (language → reference) layout to keep diffs minimal for existing scripts;
 * new invariants slot in after.
 */
function renderInvariantSections(invariants: RenderingInvariants): string[] {
  const sections: string[] = [];
  if (invariants.languageLabel) {
    sections.push(buildLanguageBlock(invariants.languageLabel));
  }
  if (invariants.reference && invariants.reference.count > 0) {
    sections.push(
      buildReferenceBlock({
        count: invariants.reference.count,
        templateOverride: invariants.reference.templateOverride,
      }),
    );
  }
  if (invariants.onScreenText?.length) {
    sections.push(buildOnScreenTextBlock(invariants.onScreenText));
  }
  if (invariants.voiceovers?.length) {
    sections.push(buildVoiceoverBlock(invariants.voiceovers));
  }
  if (invariants.pacing) {
    sections.push(buildPacingBlock(invariants.pacing));
  }
  if (invariants.negative?.length) {
    sections.push(buildNegativeBlock(invariants.negative));
  }
  return sections;
}

export function buildFinalVideoPrompt(params: {
  scriptPrompt: string;
  referenceImageCount?: number;
  referencePromptTemplate?: string;
  outputLanguage?: unknown;
  /** Full Gemini script JSON — used to extract on-screen text, pacing, etc. */
  script?: ScriptResult;
}): string {
  const basePrompt = normalizePrompt(params.scriptPrompt);
  const referenceImageCount = params.referenceImageCount ?? 0;
  const languageLabel = videoLanguageLabel(params.outputLanguage);

  const invariants: RenderingInvariants = {
    languageLabel: languageLabel || undefined,
    reference:
      referenceImageCount > 0
        ? {
            count: referenceImageCount,
            templateOverride: params.referencePromptTemplate,
          }
        : undefined,
    ...extractScriptInvariants(params.script),
  };

  return [basePrompt, ...renderInvariantSections(invariants)].join("\n\n");
}
