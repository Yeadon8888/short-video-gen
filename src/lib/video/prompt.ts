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
  const contrast = isEnglishFamily(languageLabel) ? "" : ", not English";
  return `Language: all speech, VO and baked-in text must be ${languageLabel}${contrast}; manual language selection overrides source text.`;
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
  return `${firstLine} Preserve its identity, packaging, colors and key details; use source video only for pacing/style; do not replace the product.`;
}

function formatOnScreenTextLine(item: OnScreenTextItem): string {
  const parts: string[] = [];
  if (item.shot_id !== undefined) parts.push(`shot ${item.shot_id}`);
  if (item.position) parts.push(item.position);
  if (item.locale) parts.push(item.locale);
  const meta = parts.length ? ` (${parts.join(", ")})` : "";
  return `- "${item.text}"${meta}`;
}

function buildOnScreenTextBlock(params: {
  items: OnScreenTextItem[];
  languageLabel?: string;
  languageOverride?: boolean;
}): string {
  if (params.languageLabel && params.languageOverride) {
    return [
      `Text (${params.languageLabel}, localize if needed):`,
      ...params.items.map(formatOnScreenTextLine),
    ].join("\n");
  }

  return [
    "Text (render exactly):",
    ...params.items.map(formatOnScreenTextLine),
  ].join("\n");
}

function formatVoiceoverLine({ shotId, text }: { shotId?: number; text: string }): string {
  return shotId !== undefined ? `- shot ${shotId}: "${text}"` : `- "${text}"`;
}

function buildVoiceoverBlock(params: {
  items: Array<{ shotId?: number; text: string }>;
  languageLabel?: string;
  languageOverride?: boolean;
}): string {
  if (params.languageLabel && params.languageOverride) {
    return [
      `VO (${params.languageLabel}, localize if needed):`,
      ...params.items.map(formatVoiceoverLine),
    ].join("\n");
  }

  return [
    "VO (speak exactly):",
    ...params.items.map(formatVoiceoverLine),
  ].join("\n");
}

function buildPacingBlock(pacing: string): string {
  const normalized = pacing.trim().toLowerCase();
  if (normalized === "fast") {
    return "Pacing: fast, punchy cuts; avoid lingering static shots.";
  }
  if (normalized === "slow") {
    return "Pacing: slow, cinematic, deliberate holds.";
  }
  if (normalized === "medium") {
    return "Pacing: medium, balanced cuts.";
  }
  return `Pacing: ${pacing.trim()}`;
}

function buildNegativeBlock(items: string[]): string {
  return `Avoid: ${items.join("; ")}`;
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
    sections.push(
      buildOnScreenTextBlock({
        items: invariants.onScreenText,
        languageLabel: invariants.languageLabel,
        languageOverride: invariants.languageOverride,
      }),
    );
  }
  if (invariants.voiceovers?.length) {
    sections.push(
      buildVoiceoverBlock({
        items: invariants.voiceovers,
        languageLabel: invariants.languageLabel,
        languageOverride: invariants.languageOverride,
      }),
    );
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
  const languageOverride =
    typeof params.outputLanguage === "string" && params.outputLanguage !== "auto";

  const invariants: RenderingInvariants = {
    languageLabel: languageLabel || undefined,
    languageOverride,
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
