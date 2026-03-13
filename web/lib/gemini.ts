/**
 * Gemini API calls — structured JSON output
 * Mirrors the Python gemini.py but outputs structured ScriptResult JSON
 */

const GEMINI_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_BASE_URL = "https://yunwu.ai";

export interface Shot {
  id: number;
  scene_zh: string;
  sora_prompt: string;
  duration_s: number;
  camera: "close-up" | "wide" | "medium" | "overhead";
}

export interface ScriptResult {
  creative_points: string[];
  hook: string;
  plot_summary: string;
  shots: Shot[];
  full_sora_prompt: string;
  copy: {
    title: string;
    caption: string;
    first_comment: string;
  };
}

function getApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.YUNWU_GEMINI_API_KEY ||
    process.env.YUNWU_API_KEY ||
    ""
  );
}

function getBaseUrl(): string {
  return process.env.GEMINI_BASE_URL || DEFAULT_BASE_URL;
}

async function geminiRequest(payload: object): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY or YUNWU_GEMINI_API_KEY or YUNWU_API_KEY is not set");

  const url = `${getBaseUrl()}/v1beta/models/${GEMINI_MODEL}:generateContent`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(300_000),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      return await res.json();
    } catch (e) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Gemini request failed after 3 attempts");
}

function extractText(result: unknown): string {
  const r = result as { candidates?: { content?: { parts?: { thought?: boolean; text?: string }[] } }[] };
  const parts = r?.candidates?.[0]?.content?.parts ?? [];
  const answerParts = parts.filter((p) => !p.thought);
  const last = answerParts[answerParts.length - 1];
  return last?.text?.trim() ?? "";
}

function parseJson(raw: string): unknown {
  // Strip markdown code fences if present
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  }
  // Find first { ... } block
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1) {
    s = s.slice(start, end + 1);
  }
  return JSON.parse(s);
}

/**
 * Analyze a video (base64) or expand a theme → structured ScriptResult JSON
 * Combines script + copy generation into a single API call.
 */
export async function generateScript(params: {
  type: "video" | "theme";
  videoB64?: string;
  videoBuffer?: ArrayBuffer;
  mimeType?: string;
  theme?: string;
  modification?: string;
  imageUrls?: string[];
  imageBuffers?: { buffer: ArrayBuffer; mimeType: string }[];
  promptTemplate?: string;
}): Promise<ScriptResult> {
  const { type, videoB64, videoBuffer, mimeType, theme, modification, imageBuffers, promptTemplate } = params;

  // Build instruction
  let instruction: string;
  if (promptTemplate) {
    instruction = promptTemplate
      .replace(/\{\{THEME\}\}/g, theme ?? "")
      .replace(/\{\{MODIFICATION_PROMPT\}\}/g, modification ?? "");
  } else {
    instruction = buildDefaultPrompt(type, theme, modification);
  }

  // Build content parts
  const parts: unknown[] = [];

  // Add reference images as inline_data (native Gemini format)
  if (imageBuffers && imageBuffers.length > 0) {
    parts.push({ text: "参考图片（产品图/风格参考）：" });
    for (const img of imageBuffers) {
      const b64 = Buffer.from(img.buffer).toString("base64");
      parts.push({ inline_data: { mime_type: img.mimeType, data: b64 } });
    }
  }

  // Add video if remix mode
  if (type === "video" && mimeType) {
    let b64 = videoB64;
    if (!b64 && videoBuffer) {
      // Convert ArrayBuffer to base64 server-side
      b64 = Buffer.from(videoBuffer).toString("base64");
    }
    if (b64) {
      parts.push({ inline_data: { mime_type: mimeType, data: b64 } });
    }
  }

  parts.push({ text: instruction });

  const payload = {
    contents: [{ role: "user", parts }],
  };

  const result = await geminiRequest(payload);
  const raw = extractText(result);

  try {
    return parseJson(raw) as ScriptResult;
  } catch {
    // If Gemini didn't return valid JSON, try to extract it
    throw new Error(`Gemini returned invalid JSON:\n${raw.slice(0, 500)}`);
  }
}

function buildDefaultPrompt(
  type: "video" | "theme",
  theme?: string,
  modification?: string
): string {
  if (type === "video") {
    const modSection = modification
      ? `\n修改要求：${modification}\n请在复刻的基础上严格执行以上修改。`
      : "";
    return `你是一位专业的短视频创作专家和 Sora 脚本生成师。

${modSection}

请分析这段视频（和参考图片，如有），输出一个 **严格合法的 JSON 对象**，格式如下：

{
  "creative_points": ["创意要点1", "创意要点2"],
  "hook": "一句话爆点",
  "plot_summary": "剧情梗概（2-3句话）",
  "shots": [
    {
      "id": 1,
      "scene_zh": "镜头1的中文场景描述",
      "sora_prompt": "English Sora prompt for shot 1 only",
      "duration_s": 3,
      "camera": "close-up"
    }
  ],
  "full_sora_prompt": "Complete English Sora prompt combining all shots for direct use",
  "copy": {
    "title": "视频标题（≤20字）",
    "caption": "正文文案，50-100字，带#话题",
    "first_comment": "首评，30-60字"
  }
}

要求：
- shots 数组每个镜头的 sora_prompt 用英文
- full_sora_prompt 是所有镜头描述合并的完整英文提示词，可以直接提交给 Sora
- camera 只能是 close-up、wide、medium、overhead 之一
- 只输出 JSON，不要任何额外文字、代码块标记`;
  } else {
    return `你是一位专业的短视频创作专家和 Sora 脚本生成师。

主题：${theme}

基于以上主题，输出一个 **严格合法的 JSON 对象**，格式如下：

{
  "creative_points": ["创意要点1", "创意要点2"],
  "hook": "一句话爆点",
  "plot_summary": "剧情梗概（2-3句话）",
  "shots": [
    {
      "id": 1,
      "scene_zh": "镜头1的中文场景描述",
      "sora_prompt": "English Sora prompt for shot 1 only",
      "duration_s": 3,
      "camera": "close-up"
    }
  ],
  "full_sora_prompt": "Complete English Sora prompt combining all shots for direct use",
  "copy": {
    "title": "视频标题（≤20字）",
    "caption": "正文文案，50-100字，带#话题",
    "first_comment": "首评，30-60字"
  }
}

要求：
- shots 数组每个镜头的 sora_prompt 用英文
- full_sora_prompt 是所有镜头描述合并的完整英文提示词，可以直接提交给 Sora
- camera 只能是 close-up、wide、medium、overhead 之一
- 只输出 JSON，不要任何额外文字、代码块标记`;
  }
}

/**
 * Regenerate copy (title/caption/first_comment) using a custom copy prompt.
 * The prompt template should contain {{SORA_PROMPT}} placeholder.
 */
export async function generateCopy(
  soraPrompt: string,
  copyPromptTemplate: string
): Promise<{ title: string; caption: string; first_comment: string }> {
  const instruction = copyPromptTemplate.replace(
    /\{\{SORA_PROMPT\}\}/g,
    soraPrompt
  );

  const payload = {
    contents: [{ role: "user", parts: [{ text: instruction }] }],
  };

  const result = await geminiRequest(payload);
  const raw = extractText(result);
  return parseJson(raw) as { title: string; caption: string; first_comment: string };
}
