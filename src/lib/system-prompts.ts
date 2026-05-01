import { eq } from "drizzle-orm";
import { systemConfig } from "@/lib/db/schema";

export const SYSTEM_PROMPTS_CONFIG_KEY = "prompts.system";

export type SystemPromptKey =
  | "theme_to_video"
  | "video_remix_base"
  | "video_remix_with_modification"
  | "copy_generation"
  | "gemini_reference_constraints"
  | "final_video_reference_constraints"
  | "product_white_bg"
  | "scene_lifestyle_zh"
  | "scene_model_zh"
  | "scene_detail_zh"
  | "scene_flatlay_zh"
  | "scene_outdoor_zh"
  | "scene_studio_zh"
  | "scene_lifestyle_en"
  | "scene_model_en"
  | "scene_detail_en"
  | "scene_flatlay_en"
  | "scene_outdoor_en"
  | "scene_studio_en";

export type SystemPrompts = Partial<Record<SystemPromptKey, string>>;

export interface SystemPromptDefinition {
  key: SystemPromptKey;
  label: string;
  group: string;
  description: string;
  placeholder?: string;
}

const JSON_SCHEMA = `{
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
    "caption": "正文文案，50-100字，末尾附带5-8个可直接发布的平台标签，标签使用空格分隔，不要Markdown格式",
    "first_comment": "首评，30-60字"
  },
  "language": {
    "spoken": "Language used by dialogue or voiceover in the final video",
    "content": "Language used by title, caption, hashtags, and first_comment"
  }
}`;

const SCRIPT_CONSTRAINTS = `要求：
- shots 数组每个镜头的 sora_prompt 用英文
- full_sora_prompt 是所有镜头描述合并的完整英文提示词，可以直接提交给 Sora
- camera 只能是 close-up、wide、medium、overhead 之一
- copy.title / caption / first_comment 必须是可直接发布的成品文案
- caption 末尾必须附带 5-8 个标签，使用空格分隔的纯文本格式，例如：#skincare #beauty #viral
- 标签不能带 Markdown、不能使用 ** 包裹、不能用逗号或顿号连接
- 只输出 JSON，不要任何额外文字、代码块标记`;

export const DEFAULT_SYSTEM_PROMPTS: Record<SystemPromptKey, string> = {
  theme_to_video: `你是一位专业的短视频创作专家和 Sora 脚本生成师。

主题：{{THEME}}{{CREATIVE_BRIEF_SECTION}}

基于以上主题，输出一个 **严格合法的 JSON 对象**，格式如下：

${JSON_SCHEMA}

${SCRIPT_CONSTRAINTS}`,

  video_remix_base: `你是一位专业的短视频创作专家和 Sora 脚本生成师。

请分析这段视频（和参考图片，如有），输出一个 **严格合法的 JSON 对象**，格式如下：

${JSON_SCHEMA}

${SCRIPT_CONSTRAINTS}`,

  video_remix_with_modification: `你是一位专业的短视频创作专家和 Sora 脚本生成师。

修改要求：{{MODIFICATION_PROMPT}}
请在复刻的基础上严格执行以上修改。

请分析这段视频（和参考图片，如有），输出一个 **严格合法的 JSON 对象**，格式如下：

${JSON_SCHEMA}

${SCRIPT_CONSTRAINTS}`,

  copy_generation: "",

  gemini_reference_constraints: `参考图强约束：
{{IMAGE_SCOPE}}
- 参考图中的商品身份、品类、包装、颜色、材质、外观关键特征必须保留，不能替换成别的商品。
- 如果参考视频与参考图片冲突，以参考图片中的商品外观与商品身份为准；参考视频只用于学习镜头语言、节奏和叙事结构。
- 生成的每个 shot 的 sora_prompt 以及 full_sora_prompt，都必须明确围绕参考图中的商品来设计镜头。
- 最终视频必须让该商品清晰出现，并在关键镜头中作为主角被稳定展示，不能只复刻原视频风格却忽略商品。`,

  final_video_reference_constraints: `{{REFERENCE_SCOPE}}
- Keep the same product identity, category, packaging, silhouette, materials, colors, label details, and other defining visual traits from the reference image(s).
- If the reference video conflicts with the reference image(s), preserve the product from the reference image(s) and only borrow pacing, composition, or storytelling from the video.
- The product from the reference image(s) must stay clearly visible and prominent in the hero shots and key scenes.
- Do not replace the product with another product, package, logo, or brand variation.
- Build the generated video around showcasing that exact product while following the requested creative direction.`,

  product_white_bg:
    "请基于这张商品图做图片编辑，不改变商品本身的材质、颜色、结构与品牌信息。要求：1. 智能抠出主体商品；2. 生成 9:16 竖版构图；3. 纯白背景；4. 商品完整居中展示；5. 保留真实商品边缘与细节；6. 输出适合电商展示的干净白底图。",

  scene_lifestyle_zh:
    "请基于这张商品图生成一张生活场景展示图。要求：1. 将商品自然地融入日常使用场景中；2. 背景要有生活氛围感（如桌面、客厅、厨房等）；3. 光影自然柔和；4. 保留商品的所有细节、颜色和品牌标识；5. 构图美观，适合电商详情页展示。",
  scene_model_zh:
    "请基于这张商品图生成一张模特使用/展示图。要求：1. 添加一位合适的模特在自然场景中使用或展示该商品；2. 模特姿态自然得体；3. 画面有高端广告感；4. 完整保留商品的材质、颜色和品牌信息；5. 适合社交媒体种草推广。",
  scene_detail_zh:
    "请基于这张商品图生成一张细节特写图。要求：1. 用微距视角突出商品的质感和工艺细节；2. 浅景深虚化背景；3. 光线突出产品表面纹理；4. 保留所有品牌标识和设计元素；5. 适合电商详情页细节展示。",
  scene_flatlay_zh:
    "请基于这张商品图生成一张平铺摆拍图。要求：1. 俯拍视角，将商品与搭配的配饰或场景元素一起平铺展示；2. 背景用浅色或大理石纹理；3. 整体构图干净有序；4. 完整保留商品外观和品牌信息；5. 适合小红书种草图。",
  scene_outdoor_zh:
    "请基于这张商品图生成一张户外场景图。要求：1. 将商品放置在自然光线充足的户外环境中；2. 背景可以是公园、街道、咖啡馆等；3. 画面通透明亮；4. 保留商品所有细节和品牌信息；5. 适合 TikTok/抖音带货视频封面。",
  scene_studio_zh:
    "请基于这张商品图生成一张专业棚拍风格图。要求：1. 使用有渐变色或纯色的专业摄影背景；2. 三点布光突出产品立体感；3. 画面高级精致；4. 完整保留商品材质、颜色和品牌标识；5. 适合电商主图展示。",

  scene_lifestyle_en:
    "Using this product image, generate a lifestyle scene. Requirements: 1) Place the product naturally into an everyday-use context; 2) Give the background a lived-in feel (desk, living room, kitchen, etc.); 3) Soft, natural lighting; 4) Preserve every detail, color, and brand mark of the product; 5) Clean composition suitable for an e-commerce product page.",
  scene_model_en:
    "Using this product image, generate a photo of a model using or showcasing the product. Requirements: 1) Add a suitable human model using or presenting the product in a natural setting; 2) Natural, confident pose; 3) Premium advertising feel; 4) Preserve the product's materials, colors, and branding exactly; 5) Suitable for social-media product seeding.",
  scene_detail_en:
    "Using this product image, generate a close-up detail shot. Requirements: 1) Macro perspective emphasizing texture and craftsmanship; 2) Shallow depth of field blurring the background; 3) Lighting that reveals surface texture; 4) Preserve all brand marks and design elements; 5) Suitable for the details section of a product page.",
  scene_flatlay_en:
    "Using this product image, generate a flat-lay composition. Requirements: 1) Top-down shot placing the product alongside complementary accessories or props; 2) Light-colored or marble-textured background; 3) Clean, orderly composition; 4) Preserve product appearance and branding; 5) Suitable for lifestyle-feed / Xiaohongshu posts.",
  scene_outdoor_en:
    "Using this product image, generate an outdoor scene. Requirements: 1) Place the product in a naturally lit outdoor environment (park, street, cafe, etc.); 2) Bright, airy atmosphere; 3) Preserve every product detail and brand mark; 4) Suitable as a thumbnail for TikTok / short-video product drops.",
  scene_studio_en:
    "Using this product image, generate a professional studio-style photo. Requirements: 1) Gradient or solid professional photo backdrop; 2) Three-point lighting accentuating the product's form; 3) Premium, polished feel; 4) Preserve materials, colors, and branding; 5) Suitable for a primary product listing image.",
};

export const SYSTEM_PROMPT_DEFINITIONS: SystemPromptDefinition[] = [
  { key: "theme_to_video", label: "主题生成视频", group: "视频脚本", description: "用户输入主题时的默认脚本生成 Prompt。可用 {{THEME}}、{{CREATIVE_BRIEF_SECTION}}。" },
  { key: "video_remix_base", label: "视频二创", group: "视频脚本", description: "用户上传视频或链接、没有修改建议时的默认 Prompt。" },
  { key: "video_remix_with_modification", label: "视频二创 + 修改要求", group: "视频脚本", description: "用户上传视频或链接、带修改建议时的默认 Prompt。可用 {{MODIFICATION_PROMPT}}。" },
  { key: "copy_generation", label: "二次文案生成", group: "视频脚本", description: "默认留空，表示使用脚本生成时附带的 copy；填写后会额外调用一次 Gemini 生成标题/文案。" },
  { key: "gemini_reference_constraints", label: "Gemini 参考图约束", group: "视频约束", description: "追加到脚本生成 Prompt 的参考图商品保真约束。可用 {{IMAGE_SCOPE}}。" },
  { key: "final_video_reference_constraints", label: "最终视频参考图约束", group: "视频约束", description: "提交给视频模型前追加的参考图商品保真约束。可用 {{REFERENCE_SCOPE}}。" },
  { key: "product_white_bg", label: "商品图 9:16 白底", group: "图片处理", description: "产品图片转 9:16 白底图的图片编辑 Prompt。" },
  { key: "scene_lifestyle_zh", label: "生活场景 中文", group: "商品组图", description: "商品组图生活场景中文 Prompt。" },
  { key: "scene_model_zh", label: "模特展示 中文", group: "商品组图", description: "商品组图模特展示中文 Prompt。" },
  { key: "scene_detail_zh", label: "细节特写 中文", group: "商品组图", description: "商品组图细节特写中文 Prompt。" },
  { key: "scene_flatlay_zh", label: "平铺摆拍 中文", group: "商品组图", description: "商品组图平铺摆拍中文 Prompt。" },
  { key: "scene_outdoor_zh", label: "户外场景 中文", group: "商品组图", description: "商品组图户外场景中文 Prompt。" },
  { key: "scene_studio_zh", label: "棚拍风格 中文", group: "商品组图", description: "商品组图棚拍风格中文 Prompt。" },
  { key: "scene_lifestyle_en", label: "Lifestyle EN", group: "商品组图", description: "English lifestyle scene prompt." },
  { key: "scene_model_en", label: "Model EN", group: "商品组图", description: "English model scene prompt." },
  { key: "scene_detail_en", label: "Detail EN", group: "商品组图", description: "English detail scene prompt." },
  { key: "scene_flatlay_en", label: "Flat-lay EN", group: "商品组图", description: "English flat-lay scene prompt." },
  { key: "scene_outdoor_en", label: "Outdoor EN", group: "商品组图", description: "English outdoor scene prompt." },
  { key: "scene_studio_en", label: "Studio EN", group: "商品组图", description: "English studio scene prompt." },
];

export function mergeSystemPrompts(value?: SystemPrompts | null): Record<SystemPromptKey, string> {
  return {
    ...DEFAULT_SYSTEM_PROMPTS,
    ...(value ?? {}),
  };
}

export function cleanSystemPrompts(value: unknown): SystemPrompts {
  if (!value || typeof value !== "object") return {};
  const allowed = new Set<SystemPromptKey>(SYSTEM_PROMPT_DEFINITIONS.map((item) => item.key));
  const cleaned: SystemPrompts = {};
  for (const [key, prompt] of Object.entries(value)) {
    if (allowed.has(key as SystemPromptKey) && typeof prompt === "string") {
      const promptKey = key as SystemPromptKey;
      const trimmed = prompt.trim();
      if (trimmed || promptKey === "copy_generation") {
        cleaned[promptKey] = trimmed;
      }
    }
  }
  return cleaned;
}

export async function loadSystemPrompts() {
  const { db } = await import("@/lib/db");
  const [row] = await db
    .select({ value: systemConfig.value })
    .from(systemConfig)
    .where(eq(systemConfig.key, SYSTEM_PROMPTS_CONFIG_KEY))
    .limit(1);

  return mergeSystemPrompts(cleanSystemPrompts(row?.value));
}

export async function saveSystemPrompts(params: {
  prompts: SystemPrompts;
  adminId: string;
}) {
  const { db } = await import("@/lib/db");
  const prompts = cleanSystemPrompts(params.prompts);
  await db
    .insert(systemConfig)
    .values({
      key: SYSTEM_PROMPTS_CONFIG_KEY,
      value: prompts,
      updatedBy: params.adminId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: {
        value: prompts,
        updatedBy: params.adminId,
        updatedAt: new Date(),
      },
    });
}

export function applyScriptPromptPlaceholders(params: {
  template: string;
  theme?: string;
  modification?: string;
  creativeBrief?: string;
}) {
  const creativeBriefSection = params.creativeBrief
    ? `\n补充要求：${params.creativeBrief}\n请把这些要求具体落实到分镜、画面和文案里。`
    : "";

  return params.template
    .replace(/\{\{THEME\}\}/g, params.theme ?? "")
    .replace(/\{\{MODIFICATION_PROMPT\}\}/g, params.modification ?? params.creativeBrief ?? "")
    .replace(/\{\{CREATIVE_BRIEF\}\}/g, params.creativeBrief ?? params.modification ?? "")
    .replace(/\{\{CREATIVE_BRIEF_SECTION\}\}/g, creativeBriefSection);
}

export function getSystemPrompt(
  prompts: Record<SystemPromptKey, string>,
  key: SystemPromptKey,
) {
  return prompts[key] ?? DEFAULT_SYSTEM_PROMPTS[key];
}

export function applyReferencePromptPlaceholders(params: {
  template: string;
  imageScope?: string;
  referenceScope?: string;
}) {
  return params.template
    .replace(/\{\{IMAGE_SCOPE\}\}/g, params.imageScope ?? "")
    .replace(/\{\{REFERENCE_SCOPE\}\}/g, params.referenceScope ?? "");
}
