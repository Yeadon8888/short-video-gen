# VidClaw v2 — 商品主图 & 视频拆解提示词导出

导出自 vidclaw-v2 项目，用于迁移到其他项目复用。

源文件参考：
- `src/lib/image-edit/bltcy.ts`
- `src/lib/image-edit/scene-generation.ts`
- `src/lib/gemini.ts`
- `src/lib/video/prompt.ts`

---

## 一、商品主图 / 商品图提示词

### 1）9:16 白底主图（`src/lib/image-edit/bltcy.ts:169`）

```
请基于这张商品图做图片编辑，不改变商品本身的材质、颜色、结构与品牌信息。要求：
1. 智能抠出主体商品；
2. 生成 9:16 竖版构图；
3. 纯白背景；
4. 商品完整居中展示；
5. 保留真实商品边缘与细节；
6. 输出适合电商展示的干净白底图。
```

### 2）六种商品场景图（`src/lib/image-edit/scene-generation.ts`）

#### 中文版 `SCENE_PROMPTS_ZH`

**lifestyle（生活场景）**
```
请基于这张商品图生成一张生活场景展示图。要求：1. 将商品自然地融入日常使用场景中；2. 背景要有生活氛围感（如桌面、客厅、厨房等）；3. 光影自然柔和；4. 保留商品的所有细节、颜色和品牌标识；5. 构图美观，适合电商详情页展示。
```

**model（模特展示）**
```
请基于这张商品图生成一张模特使用/展示图。要求：1. 添加一位合适的模特在自然场景中使用或展示该商品；2. 模特姿态自然得体；3. 画面有高端广告感；4. 完整保留商品的材质、颜色和品牌信息；5. 适合社交媒体种草推广。
```

**detail（细节特写）**
```
请基于这张商品图生成一张细节特写图。要求：1. 用微距视角突出商品的质感和工艺细节；2. 浅景深虚化背景；3. 光线突出产品表面纹理；4. 保留所有品牌标识和设计元素；5. 适合电商详情页细节展示。
```

**flatlay（平铺摆拍）**
```
请基于这张商品图生成一张平铺摆拍图。要求：1. 俯拍视角，将商品与搭配的配饰或场景元素一起平铺展示；2. 背景用浅色或大理石纹理；3. 整体构图干净有序；4. 完整保留商品外观和品牌信息；5. 适合小红书种草图。
```

**outdoor（户外场景）**
```
请基于这张商品图生成一张户外场景图。要求：1. 将商品放置在自然光线充足的户外环境中；2. 背景可以是公园、街道、咖啡馆等；3. 画面通透明亮；4. 保留商品所有细节和品牌信息；5. 适合 TikTok/抖音带货视频封面。
```

**studio（棚拍风格）**
```
请基于这张商品图生成一张专业棚拍风格图。要求：1. 使用有渐变色或纯色的专业摄影背景；2. 三点布光突出产品立体感；3. 画面高级精致；4. 完整保留商品材质、颜色和品牌标识；5. 适合电商主图展示。
```

#### 英文版 `SCENE_PROMPTS_EN`

**lifestyle**
```
Using this product image, generate a lifestyle scene. Requirements: 1) Place the product naturally into an everyday-use context; 2) Give the background a lived-in feel (desk, living room, kitchen, etc.); 3) Soft, natural lighting; 4) Preserve every detail, color, and brand mark of the product; 5) Clean composition suitable for an e-commerce product page.
```

**model**
```
Using this product image, generate a photo of a model using or showcasing the product. Requirements: 1) Add a suitable human model using or presenting the product in a natural setting; 2) Natural, confident pose; 3) Premium advertising feel; 4) Preserve the product's materials, colors, and branding exactly; 5) Suitable for social-media product seeding.
```

**detail**
```
Using this product image, generate a close-up detail shot. Requirements: 1) Macro perspective emphasizing texture and craftsmanship; 2) Shallow depth of field blurring the background; 3) Lighting that reveals surface texture; 4) Preserve all brand marks and design elements; 5) Suitable for the details section of a product page.
```

**flatlay**
```
Using this product image, generate a flat-lay composition. Requirements: 1) Top-down shot placing the product alongside complementary accessories or props; 2) Light-colored or marble-textured background; 3) Clean, orderly composition; 4) Preserve product appearance and branding; 5) Suitable for lifestyle-feed / Xiaohongshu posts.
```

**outdoor**
```
Using this product image, generate an outdoor scene. Requirements: 1) Place the product in a naturally lit outdoor environment (park, street, café, etc.); 2) Bright, airy atmosphere; 3) Preserve every product detail and brand mark; 4) Suitable as a thumbnail for TikTok / short-video product drops.
```

**studio**
```
Using this product image, generate a professional studio-style photo. Requirements: 1) Gradient or solid professional photo backdrop; 2) Three-point lighting accentuating the product's form; 3) Premium, polished feel; 4) Preserve materials, colors, and branding; 5) Suitable for a primary product listing image.
```

### 3）人种 / 区域追加约束

仅在 `lifestyle / model / outdoor` 三个可能出现人物的场景叠加。

**中文模板：**
```
如果画面中出现人物，人物必须是{区域}，不要默认生成中国人。
```

`REGION_PHRASE_ZH`：
- `western`: 欧美（北美/欧洲）人种外貌
- `east_asian_non_cn`: 日韩东亚（非中国大陆）人种外貌
- `southeast_asian`: 东南亚人种外貌
- `malaysian`: 马来西亚当地人外貌
- `mexican`: 墨西哥/拉美人种外貌
- `middle_east`: 中东人种外貌

**英文模板：**
```
If any human appears in the image, they must have {phrase}. Do NOT default to a Chinese-looking model.
```

`REGION_PHRASE_EN`：
- `western`: Western (North American / European) ethnicity
- `east_asian_non_cn`: East Asian (Japanese or Korean, not mainland-Chinese) ethnicity
- `southeast_asian`: Southeast Asian ethnicity
- `malaysian`: local Malaysian ethnicity
- `mexican`: Mexican / Latino ethnicity
- `middle_east`: Middle-Eastern ethnicity

### 4）用户自定义补充（拼接在末尾）

- 中文：`用户补充要求：{custom}`
- 英文：`Additional user requirement: {custom}`

### 5）完整拼装顺序

```
[base prompt (中/英 + style)]

[region 约束块 (仅当 region != auto 且 style ∈ {lifestyle, model, outdoor})]

[用户自定义补充块 (可选)]
```

用 `\n\n` 连接。

---

## 二、视频拆解 / Sora 脚本提示词

### 1）默认拆解主提示词（视频复刻，`buildDefaultPrompt` type=="video"）

```
你是一位专业的短视频创作专家和 Sora 脚本生成师。
{修改要求：{modification}\n请在复刻的基础上严格执行以上修改。}   ← 可选

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
    "caption": "正文文案，50-100字，末尾附带5-8个可直接发布的平台标签，标签使用空格分隔，不要Markdown格式",
    "first_comment": "首评，30-60字"
  },
  "language": {
    "spoken": "Language used by dialogue or voiceover in the final video",
    "content": "Language used by title, caption, hashtags, and first_comment"
  }
}

要求：
- shots 数组每个镜头的 sora_prompt 用英文
- full_sora_prompt 是所有镜头描述合并的完整英文提示词，可以直接提交给 Sora
- camera 只能是 close-up、wide、medium、overhead 之一
- copy.title / caption / first_comment 必须是可直接发布的成品文案
- caption 末尾必须附带 5-8 个标签，使用空格分隔的纯文本格式，例如：#skincare #beauty #viral
- 标签不能带 Markdown、不能使用 ** 包裹、不能用逗号或顿号连接
- 只输出 JSON，不要任何额外文字、代码块标记
```

### 2）主题扩写版（`buildDefaultPrompt` type=="theme"）

```
你是一位专业的短视频创作专家和 Sora 脚本生成师。

主题：{theme}
{补充要求：{creativeBrief}\n请把这些要求具体落实到分镜、画面和文案里。}   ← 可选

基于以上主题，输出一个 **严格合法的 JSON 对象**，格式如下：

{ …同上 JSON schema… }

{ …同上 constraints… }
```

### 3）自定义模板兜底（`JSON_OUTPUT_SUFFIX`）

当用户传入的自定义模板里没有包含 `"full_sora_prompt"` 字段时，自动追加：

````
输出要求：
必须且只能输出一个合法的 JSON 对象，格式如下：

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
    "caption": "正文文案，50-100字，末尾附带5-8个可直接发布的平台标签，标签使用空格分隔，不要Markdown格式",
    "first_comment": "首评，30-60字"
  }
}

！！！极端重要！！！
- camera 值只能是 close-up、wide、medium、overhead 之一
- 只输出 JSON，不要任何解释文字、代码块标记（不要 ```json）
- JSON 必须合法可解析
- caption 末尾的标签最多 8 个，使用纯文本格式，例如：#tag1 #tag2 #tag3
- 不要输出 Markdown、不要用 ** 包裹标签、不要用逗号或列表格式输出标签
````

### 4）平台指令（TikTok 时追加）

```
**IMPORTANT: This video is for TikTok. Sora prompts remain in English, but visible copy and spoken language must follow the selected output language constraint below.**
```

### 5）语言强约束（永远追加）

```
语言强约束：
- {languageSpec.instruction}
- Keep sora_prompt and full_sora_prompt in English for the video model.
- In the JSON response, add language.spoken and language.content reflecting the resolved spoken/content language.
```

其中 `languageSpec.instruction`：
- **指定了语言：**
  ```
  All spoken dialogue, voiceover, title, caption, hashtags, and first_comment must be in {语言}. Do not silently switch to English or any other language.
  ```
- **未指定（auto）：**
  ```
  If the user explicitly specifies a language, all spoken dialogue, voiceover, title, caption, hashtags, and first_comment must use that language consistently. Do not silently switch to English.
  ```

### 6）参考图片说明（附在视频/图片 parts 前面）

- **多图：**
  ```
  以下是产品参考图片。它们代表同一商品的不同角度/细节，最终视频必须保留这组图片对应的商品身份与外观：
  ```
- **单图：**
  ```
  以下是产品参考图片。最终视频必须保留这张图对应的商品身份与外观：
  ```

### 7）参考图强约束（`buildGeminiReferenceInstruction`）

`referenceImageCount > 0` 时追加：

```
参考图强约束：
{多图：如果提供了多张参考图片，请将它们视为同一商品的不同角度或细节补充。}
{单图：如果提供了参考图片，请将它视为最终视频必须保留的商品主体。}
- 参考图中的商品身份、品类、包装、颜色、材质、外观关键特征必须保留，不能替换成别的商品。
- 如果参考视频与参考图片冲突，以参考图片中的商品外观与商品身份为准；参考视频只用于学习镜头语言、节奏和叙事结构。
- 生成的每个 shot 的 sora_prompt 以及 full_sora_prompt，都必须明确围绕参考图中的商品来设计镜头。
- 最终视频必须让该商品清晰出现，并在关键镜头中作为主角被稳定展示，不能只复刻原视频风格却忽略商品。
```

### 8）用户补充要求块（`buildScriptInstruction`）

当 `creativeBrief` 存在时：

```
用户补充要求：
{creativeBrief}
- 上面的补充要求必须真实体现在分镜、sora_prompt 和 full_sora_prompt 中。
```

### 9）文案重生成（`generateCopy`）

基于已有 Sora prompt 回洗文案；模板由调用方传入，需含 `{{SORA_PROMPT}}` 占位。系统在末尾自动追加：

```
**IMPORTANT: Title, caption, hashtags inside caption, and first_comment MUST be in {content语言}. Do not switch to English unless the selected output language is English.**
```

若 `platform === "tiktok"` 还追加：
```
**IMPORTANT: This copy is for TikTok, but the copy language must still follow the selected output language.**
```

### 10）最终视频 prompt 再包装（`buildFinalVideoPrompt`）

提交给视频模型前的最后一层包装，在基础 prompt 后可能追加两段：

**语言块（选配）：**
```
Spoken-language constraint:
- Every character on screen must speak in {languageLabel}.
- Any voiceover, narration, or subtitles baked into the video must be in {languageLabel}.
- Lip-sync, mouth shapes, and pronunciation must match {languageLabel}, not English.
- Do not switch to English or any other language, even for product names or catchphrases, unless the user explicitly requested mixed language.
```

**参考图块（`referenceImageCount > 0`）：**
```
单图：Reference image constraints: treat the uploaded reference image as the exact product that must appear in the final video.
多图：Reference image constraints: treat all uploaded reference images as the same exact product shown from different angles or detail views.
- Keep the same product identity, category, packaging, silhouette, materials, colors, label details, and other defining visual traits from the reference image(s).
- If the reference video conflicts with the reference image(s), preserve the product from the reference image(s) and only borrow pacing, composition, or storytelling from the video.
- The product from the reference image(s) must stay clearly visible and prominent in the hero shots and key scenes.
- Do not replace the product with another product, package, logo, or brand variation.
- Build the generated video around showcasing that exact product while following the requested creative direction.
```

### 11）完整视频拆解拼装顺序

```
[buildDefaultPrompt 或 自定义模板(+JSON_OUTPUT_SUFFIX)]
  + [platformInstruction (TikTok 时)]
  + [languageInstruction (永远)]
  + [creativeBrief 补充块 (可选)]
  + [referenceImage 强约束块 (有参考图时)]

→ 作为 Gemini 的 instruction

Gemini 请求 parts 顺序：
  1. 参考图说明文本 + 参考图 inline_data
  2. 视频 inline_data (video 模式)
  3. instruction 文本
```

---

## 迁移建议

1. 两个功能彼此独立，可以分别迁移。
2. 商品主图：整体搬 `src/lib/image-edit/scene-generation.ts` + `src/lib/image-edit/bltcy.ts`；供应商换成目标项目的就行。
3. 视频拆解：整体搬 `src/lib/gemini.ts` + `src/lib/video/prompt.ts` + `src/lib/video/languages.ts`；Gemini 调用使用的是 OpenAI 兼容格式的 `/v1beta/models/{model}:generateContent`，新项目里直接替换成目标的 Gemini SDK 调用即可。
4. 所有 prompt 都是常量化的，无外部依赖，可以直接拷贝字符串用。
