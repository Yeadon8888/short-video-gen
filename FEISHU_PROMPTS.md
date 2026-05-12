# 飞书多维表格 · LLM 节点 Prompts

迁移自 VidClaw SaaS 同款流程，所有变量用 `{{xxx}}` 占位，飞书节点直接绑定字段即可。
平台固定为 **TikTok**，不需要在表里出字段。

---

## 一、商品组图 Prompts（6 个独立 Prompt）

> **绑定字段建议**：表格里设一个「主题」单选字段，6 个选项对应 6 个 LLM 节点（或 1 个节点 + 选项分支）。
>
> **共用变量：**
> - `{{country}}` — 目标市场国家（中文或英文均可，例如：`Mexico` / `Malaysia` / `墨西哥` / `马来西亚`）
>
> **多模态输入**：把商品图传给 LLM 节点的图像输入位（Gemini / GPT-4o / GPT-Image-2 都支持）。

---

### Prompt 1.1 · Lifestyle（生活场景）

```
Using this product image, generate a lifestyle scene. Requirements:
1) Place the product naturally into an everyday-use context;
2) Give the background a lived-in feel (desk, living room, kitchen, etc.) appropriate for the {{country}} market;
3) Soft, natural lighting;
4) Preserve every detail, color, label, and brand mark of the product exactly as in the reference;
5) Clean composition suitable for an e-commerce product page.

If any human appears in the image, they must look like a local person from {{country}} — match the local ethnicity, skin tone, and styling. Do NOT default to a Chinese-looking model unless {{country}} is China.
```

---

### Prompt 1.2 · Model（模特展示）

```
Using this product image, generate a photo of a model using or showcasing the product. Requirements:
1) Add a suitable human model using or presenting the product in a natural setting that feels native to the {{country}} market;
2) Natural, confident pose;
3) Premium advertising feel;
4) Preserve the product's materials, colors, label, and branding exactly as in the reference;
5) Suitable for social-media product seeding.

The model must look like a local person from {{country}} — match the local ethnicity, skin tone, hairstyle, and outfit aesthetics. Do NOT default to a Chinese-looking model unless {{country}} is China.
```

---

### Prompt 1.3 · Detail（细节特写）

```
Using this product image, generate a close-up detail shot. Requirements:
1) Macro perspective emphasizing texture and craftsmanship;
2) Shallow depth of field blurring the background;
3) Lighting that reveals surface texture;
4) Preserve all brand marks, labels, and design elements exactly as in the reference;
5) Suitable for the details section of a product page.
```

---

### Prompt 1.4 · Flatlay（平铺摆拍）

```
Using this product image, generate a flat-lay composition. Requirements:
1) Top-down shot placing the product alongside complementary accessories or props that fit the {{country}} market's lifestyle;
2) Light-colored or marble-textured background;
3) Clean, orderly composition;
4) Preserve product appearance, label, and branding exactly as in the reference;
5) Suitable for lifestyle-feed posts (Instagram / Xiaohongshu / TikTok).
```

---

### Prompt 1.5 · Outdoor（户外场景）

```
Using this product image, generate an outdoor scene. Requirements:
1) Place the product in a naturally lit outdoor environment that feels native to {{country}} (street, park, café, beach, market — pick what fits the market);
2) Bright, airy atmosphere;
3) Preserve every product detail, label, and brand mark exactly as in the reference;
4) Suitable as a thumbnail for TikTok / Reels / Douyin product drops.

If any human appears in the image, they must look like a local person from {{country}} — match the local ethnicity, skin tone, and styling. Do NOT default to a Chinese-looking model unless {{country}} is China.
```

---

### Prompt 1.6 · Studio（棚拍风格）

```
Using this product image, generate a professional studio-style photo. Requirements:
1) Gradient or solid professional photo backdrop;
2) Three-point lighting accentuating the product's form;
3) Premium, polished feel;
4) Preserve materials, colors, label, and branding exactly as in the reference;
5) Suitable for a primary product listing image (e-commerce hero shot).
```

---

## 二、视频脚本生成 Prompt（单 Prompt · 自动构思主题 · 自动判断品类）

> **输入**：
> - 商品组图（多模态，传 LLM 节点图像位）
> - `{{product_title}}` — 商品标题
> - `{{country}}` — 目标市场国家
>
> **隐含约定**（写死在 Prompt 里）：
> - 平台固定 TikTok（不再单独列字段）
> - 品类由 LLM 从商品图自动判断（不再单独列字段）
>
> **输出**：JSON，shots 数组**长度弹性**（2-5 镜头），需循环遍历拆字段

---

### Prompt 2 · 完整版

````
You are a senior short-video creative director and Sora prompt engineer specializing in {{country}}-market TikTok e-commerce ads.

# Inputs
- Product reference image(s): provided as inline image input above
- Product title: {{product_title}}
- Target market country: {{country}}
- Platform: TikTok (fixed)

# Your Task
1. Analyze the product image(s) together with the title. Autonomously infer the product's category (e.g. tool / beauty / food / fashion / tech / home / pet / mom-and-baby / other), key selling points, target user, and the most compelling angle for a {{country}}-market TikTok ad.
2. Autonomously decide the creative theme — DO NOT ask the user; DO NOT use a generic theme. The theme must be tailored to the product AND to {{country}}'s local culture, daily life, and consumer psychology (e.g. for Mexico → construction sites / family barbecue / vibrant street; for Malaysia → tropical climate / mamak culture / multi-ethnic scenes; etc.).
3. Build a storyboard following the **Hook → Demo → Close** arc, with shot count and per-shot duration adapted to the product category (see Pacing Rules below).
4. Produce ready-to-publish copy in the LOCAL language of {{country}}. The localized language must apply to: hook, copy.title, copy.caption, copy.first_comment, copy.hashtags, and language.spoken / language.content.
5. Sora prompts (per-shot and full) MUST stay in English — they are fed to the video model.
6. Internal/dev fields (creative_points, plot_summary, scene_zh) stay in Chinese for the operator to review.

# Pacing Rules (CRITICAL)

Total video length MUST be **8-12 seconds** (TikTok sweet spot — algorithm rewards completion rate within this window).

Hard structural rules:
- **Hook (shot 1)**: ALWAYS 1-2 seconds. Must land instantly — pattern interrupt, visual shock, or a question. If the audience doesn't stay past second 2, nothing else matters.
- **Demo (1-2 middle shots)**: 3-6 seconds each. The product must "live" in the frame long enough for the viewer to register the selling point. Demo shots in total MUST occupy at least 50% of total length.
- **Close (last shot)**: 2-3 seconds. CTA / trust signal / engagement bait. Short and decisive.

Choose shot count and timing based on the category you inferred:
- **tool / functional / hardware** (drills, kitchenware, fitness gear, safety boots)
  → 3 shots: 2s + 4s + 3s = 9s. Impact hook → function demo → trust detail.
- **beauty / skincare / hair / cleaning** (transformation products)
  → 3-4 shots: 1s + 3s + 3s + 2s = 9s. Before-state hook → application → after → result reveal.
- **food / drinks / sensory**
  → 2-3 shots: 1s + 6s + 3s = 10s. Quick teaser → long beauty/sensory shot → CTA.
- **fashion / apparel / accessories / lifestyle**
  → 3-4 shots: 2s + 4s + 4s + 2s = 12s. Vibe hook → wear shot → detail/styling → CTA.
- **tech / 3C / smart devices / gadgets**
  → 3 shots: 2s + 5s + 3s = 10s. Curiosity hook → function demo → result/CTA.
- **home / pet / mom & baby**
  → 3-4 shots: 2s + 4s + 3s + 2s = 11s. Pain-point hook → use-in-context → emotional payoff → CTA.

Reasoning: cramming everything into a fixed 3×3s grid creates a "fast cuts but no content" feel. Algorithm rewards completion rate AND meaningful information density. Different products need different pacing.

In `creative_points`, briefly explain the pacing decision for THIS product (e.g. `"节奏选择：tool 类 → 冲击 hook 2s + 功能演示 4s + 信任收尾 3s"`).

# Hard Constraints

## Product fidelity
- The product identity, category, packaging, color, materials, label text, logo, and silhouette from the reference image MUST be preserved across every shot. Do not replace it with a similar-looking product.
- The product must appear as the hero in at least 50% of the shots.

## Localization (CRITICAL)
- All visible characters in the video must look like local people from {{country}}. Match local ethnicity, skin tone, hairstyle, and outfit. Do NOT default to a Chinese-looking model unless {{country}} is China.
- All scenes, props, and environment must feel native to {{country}} — local streets, signage, weather, clothing style.
- Title / caption / first_comment / hashtags MUST be in the official local language of {{country}} (e.g. Mexico → Mexican Spanish, Malaysia → Bahasa Malaysia or English depending on TikTok norms there, Brazil → Brazilian Portuguese, Indonesia → Bahasa Indonesia, Saudi/UAE → Arabic, Vietnam → Vietnamese, Thailand → Thai, USA / UK → English, Spain → Castilian Spanish, China → 简体中文).
- Do NOT silently switch to English unless {{country}}'s local language is English.

## Format
- Camera value MUST be one of: close-up, wide, medium, overhead.
- shots array length: 2 to 5 (decided by Pacing Rules). Do NOT force exactly 3.
- Each shot's `sora_prompt` complexity must match its `duration_s` — a 2-second hook should describe ONE simple action, not a multi-step scene.
- Sum of all `duration_s` MUST be between 8 and 12 (inclusive).
- caption MUST be 50-100 characters/words of native-feeling marketing copy. Do NOT append hashtags inside caption — hashtags go in the separate `copy.hashtags` array.
- copy.hashtags: 5-8 platform-ready tags as plain strings each starting with `#` (no markdown, no commas inside, no `**`).
- first_comment: 30-60 chars/words, designed to drive comments (ask a question or give a hot take).
- Output ONLY a single valid JSON object. No prose, no code fences, no ```json marker. Must be parseable by JSON.parse.

# Output JSON Schema

{
  "creative_points": [
    "中文 · 创意要点 1（含品类判断 + 节奏选择理由）",
    "中文 · 创意要点 2",
    "中文 · 创意要点 3"
  ],
  "hook": "一句话爆点 in {{country}} local language",
  "plot_summary": "中文 · 剧情梗概（2-3 句话）",
  "pacing": {
    "category_decided": "由 LLM 判断的品类 (tool / beauty / food / fashion / tech / home / pet / mom-and-baby / other)",
    "total_duration_s": 9,
    "shot_count": 3,
    "rationale": "中文 · 一句话说明为什么这个品类用这个节奏"
  },
  "shots": [
    {
      "id": 1,
      "role": "hook",
      "scene_zh": "中文 · 镜头 1 (Hook) 的场景描述",
      "sora_prompt": "English Sora prompt for shot 1 (hook) — ONE simple, attention-grabbing action.",
      "duration_s": 2,
      "camera": "close-up"
    },
    {
      "id": 2,
      "role": "demo",
      "scene_zh": "中文 · 镜头 2 (Demo) 的场景描述",
      "sora_prompt": "English Sora prompt for shot 2 (demo) — let the product live in the frame. Describe scene, subject (with local ethnicity), product placement, action, lighting, camera move, and {{country}} environment cues.",
      "duration_s": 4,
      "camera": "medium"
    },
    {
      "id": 3,
      "role": "close",
      "scene_zh": "中文 · 镜头 3 (Close) 的场景描述",
      "sora_prompt": "English Sora prompt for shot 3 (close) — CTA / trust shot / detail reveal.",
      "duration_s": 3,
      "camera": "close-up"
    }
  ],
  "full_sora_prompt": "A complete English Sora prompt combining all shots into one continuous brief, ready to submit to Sora 2 / VEO 3.1 / Seedance directly. Must include local ethnicity cue, product fidelity cue, and {{country}} environment cue.",
  "copy": {
    "title": "Video title in {{country}} local language (≤ 25 chars, eye-catching, may include 1-2 emojis)",
    "caption": "Body copy in {{country}} local language (50-100 chars/words, native marketing tone, NO hashtags inside)",
    "first_comment": "First-comment in {{country}} local language (30-60 chars/words, prompts engagement)",
    "hashtags": [
      "#tag1",
      "#tag2",
      "#tag3",
      "#tag4",
      "#tag5"
    ]
  },
  "language": {
    "spoken": "Local language name in English (e.g. Mexican Spanish, Bahasa Malaysia, Brazilian Portuguese)",
    "content": "Same as spoken"
  }
}

# Final Reminder
Output ONLY the JSON object. Nothing before, nothing after. No code fences. Must be valid JSON.
````

---

## 三、🔑 飞书字段 ↔ Prompt 2 输出 JSON 映射表

> **给对接同事的核心说明**：Prompt 2 一次出整个 JSON，飞书要把它拆成多个列。下面这张表就是「飞书列名 ↔ JSON 路径」一一对应。

### A · 直接映射的列（一个 JSON 路径 → 一个表格列）

| 飞书表列名 | 对应 JSON 路径 | 类型 | 备注 |
|---|---|---|---|
| **视频标题** | `copy.title` | 单行文本 | 已经是当地语言，可直接发布 |
| **正文 / 文案** | `copy.caption` | 多行文本 | 50-100 字本地语言营销文案，**不含 hashtags** |
| **标签** | `copy.hashtags` | 多行文本 | 数组，飞书拼接公式：`JOIN(value, " ")` 得到 `#tag1 #tag2 #tag3 ...` |
| **首评** | `copy.first_comment` | 多行文本 | 30-60 字，引导评论 |
| **视频提示词（完整）** | `full_sora_prompt` | 多行文本 | **直接喂给 Sora 2 / VEO 3.1 / Seedance**，整支视频用这一段 |
| **Hook 文案** | `hook` | 单行文本 | 一句话爆点，本地语言 |
| **剧情梗概** | `plot_summary` | 多行文本 | 中文，运营内审用 |
| **创意要点** | `creative_points` | 多行文本 | 中文数组，飞书拼接公式：`JOIN(value, "\n")` |
| **品类（AI 判断）** | `pacing.category_decided` | 单选/单行文本 | LLM 自己判断的品类，运营校验用 |
| **总时长（秒）** | `pacing.total_duration_s` | 数字 | 8-12 之间 |
| **镜头数** | `pacing.shot_count` | 数字 | 2-5 之间 |
| **节奏说明** | `pacing.rationale` | 单行文本 | 中文，为什么选这个节奏 |
| **输出语言** | `language.spoken` | 单行文本 | 例如 Mexican Spanish |

### B · 镜头明细列（数组循环）

`shots[]` 是数组，长度 2-5。**不要硬编码 shots[0] / shots[1] / shots[2]**，要用循环。

| 飞书表列名 | 对应 JSON 路径 | 备注 |
|---|---|---|
| **镜头明细（汇总）** | 遍历 `shots[]` 拼成多行文本 | 见下方拼接模板 |
| **每镜头 Sora Prompt** | `shots[].sora_prompt` | 如果要每个镜头单独发到 Sora（分镜生成），用这个；如果整支视频一次性生成，用 `full_sora_prompt` |

**镜头明细列拼接公式（飞书自动化推荐）：**

```
对每个 shots[i]，按以下格式追加：

镜头 {i+1} ({shots[i].role} · {shots[i].duration_s}s · {shots[i].camera})
中文场景：{shots[i].scene_zh}
Sora Prompt：{shots[i].sora_prompt}

```

### C · 中文术语 ↔ JSON 路径速查（你问到的 4 个核心字段）

| 你说的中文术语 | JSON 路径 | 直接拿来发布的形态 |
|---|---|---|
| **视频提示词** | `full_sora_prompt` | 复制粘贴到 Sora / VEO / Seedance 输入框，生成视频 |
| **正文 / 文案** | `copy.caption` | 复制粘贴到 TikTok 发布页的描述框 |
| **标签** | `copy.hashtags`（数组用空格 join） | 拼到正文末尾 或 单独一栏 |
| **视频标题** | `copy.title` | 复制粘贴到 TikTok 发布页的标题位 |

> ⚠️ 「文案」和「正文」在 TikTok 语境里是同一个东西（都是 caption / 描述文本）。如果飞书表里同时设了两列，建议合并为一列「文案」，避免重复。
> 如果一定要分开：可以约定「文案 = 不带标签的纯描述」，「正文 = 文案 + 标签拼好的可发布版」。

---

## 四、飞书多维表格落地建议

### 表结构（精简版 — 删掉了商品名称/品类/平台/自定义字段）

| 列名 | 类型 | 说明 |
|---|---|---|
| 商品图 | 附件 | 上传产品参考图（多张可选） |
| 商品标题 | 单行文本 | 绑定 `{{product_title}}`（同时充当商品名称） |
| 目标国家 | 单选 | 墨西哥/马来西亚/美国/巴西/印尼/沙特/西班牙... 绑定 `{{country}}` |
| 主题（组图风格） | 单选 | Lifestyle / Model / Detail / Flatlay / Outdoor / Studio |
| → 组图输出 | 附件 | LLM 节点 1 产物 |
| → 视频脚本 JSON | 多行文本 | LLM 节点 2 产物，原始 JSON 备份 |
| 视频标题 | 单行文本 | `copy.title` |
| 文案 | 多行文本 | `copy.caption` |
| 标签 | 多行文本 | `copy.hashtags` 用空格 join |
| 首评 | 多行文本 | `copy.first_comment` |
| 视频提示词 | 多行文本 | `full_sora_prompt` |
| 品类（AI 判断） | 单行文本 | `pacing.category_decided` |
| 总时长 | 数字 | `pacing.total_duration_s` |
| 镜头数 | 数字 | `pacing.shot_count` |
| 节奏说明 | 单行文本 | `pacing.rationale` |
| 镜头明细 | 多行文本 | 遍历 `shots[]` 拼接 |

### 自动化流推荐

```
新行触发（商品图 + 商品标题 + 目标国家 + 主题）
  │
  ├─▶ LLM 节点 A · 组图生成（按主题字段路由到 6 个 prompt 之一）
  │     输入：商品图 + country
  │     输出：组图 → 写回「组图输出」列
  │
  └─▶ LLM 节点 B · 脚本生成（统一 Prompt 2）
        输入：商品图 + product_title + country
        输出：JSON → 写回「视频脚本 JSON」列
        ↓
        JSON 解析节点 → 按本文档第三章映射表，拆字段写回各列
```

### 模型选择

- **组图生成**：GPT-Image-2 / Gemini 2.5 Pro Image / Seedream 4 — 选支持图像输入+图像输出的多模态模型
- **脚本生成**：Gemini 2.5 Pro / GPT-4o / Claude Sonnet — 选支持图像输入+长 JSON 输出的多模态模型，温度建议 0.7

---

## 五、与 SaaS 版本的差异说明

| 项 | SaaS 版 | 飞书版（本文件） |
|---|---|---|
| 提示词语言 | 中英混合 | 全英文（飞书节点更稳） |
| 主题来源 | 用户输入 / 视频拆解 | LLM 基于商品图自动构思 |
| 区域人种 | 6 档枚举（auto/western/...） | 直接传 `{{country}}`，由 LLM 自行解读 |
| 输出语言 | 显式枚举 8 种 | 由 `{{country}}` 自动推导本地语言 |
| 平台 | 用户选 TikTok/Douyin | 固定 TikTok（飞书场景就是跑 TikTok 矩阵） |
| 品类 | 不存在 | LLM 自动判断，写入 `pacing.category_decided` |
| 自定义补充 | 用户可输入 | 删除（飞书走标准化批量，不留人工补充口子） |
| hashtags | 拼在 caption 末尾 | 独立数组字段 `copy.hashtags`（飞书拆列友好） |
| 视频参考 | 支持视频/链接二创 | 不支持，仅商品图 + 标题 |
| 镜头数 | 2-N 灵活 | **2-5 弹性**，每个镜头带 `role: hook/demo/close` |
| 节奏控制 | 用户/参考视频隐式决定 | **按品类显式编排**，8-12s 总长，Hook 1-2s 硬约束 |
| 总时长 | 由 shots 累加 | 显式输出 `pacing.total_duration_s` + `rationale` |
