# AI 视频电商带货短视频调研报告

日期：2026-05-01

目的：研究当前用 AI 视频模型生成电商带货短视频时，怎样更接近“爆款/高转化”素材；同时解释为什么这些做法有效，以及 AI 视频模型的优势、弱点和对应 Prompt/脚本策略。

## 1. 核心结论

AI 视频电商短视频的最佳方向不是“让模型一次生成完整广告大片”，而是把模型当成高频创意生产机：

- 用 AI 生成大量 5-10 秒短镜头变体；
- 每条视频只服务一个卖点、一个场景、一个动作；
- 产品尽早出现，最好第一秒就出现；
- 字幕、价格、Logo、优惠、强 CTA 尽量后期叠加，不依赖视频模型生成文字；
- Prompt 要短、明确、视觉化，不要把系统限制写成规则墙；
- 生成策略要围绕平台广告规律：开头强 hook、中段产品演示、结尾 CTA；
- AI 不擅长复杂连续物理、长剧情、多人物对话、精确文字和品牌包装一致性，所以要用参考图、单场景、简单动作、短镜头来规避。

一句话：爆款不是靠长 Prompt，而是靠“短 Prompt + 明确镜头 + 高频变体 + 后期叠字 + 数据筛选”。

## 2. 资料来源与关键依据

### 2.1 TikTok 官方创意资料

来源：

- TikTok Creative Codes: https://ads.tiktok.com/business/ms/creative-codes
- TikTok Creative Best Practices: https://ads.tiktok.com/business/en-US/blog/creative-best-practices-top-performing-ads
- TikTok Performance Ads Creative Best Practices: https://ads.tiktok.com/help/article/creative-best-practices?lang=en
- TikTok Creative Center: https://ads.tiktok.com/business/en-US/creative-center

关键观点：

- TikTok 官方把高效广告总结为 6 个 creative codes：TikTok-first、趋势、生产基础、结构、刺激注意力、声音。
- 官方推荐结构是 hook、body、close。
- TikTok 强调开头几秒的重要性，资料中提到广告记忆影响高度集中在前 6 秒。
- 产品出现在画面中会提高品牌亲和和回忆。
- 快速剪辑、动态转场、运动、文字 overlay、声音都能提升注意力。
- 创意疲劳是真问题，需要持续刷新素材和变体。

对 VidClaw 的启发：

- 生成视频时应默认 9:16、移动端、真实平台感，而不是电影广告感。
- 每个商品应批量生成多个 hook 版本。
- 不要让视频模型负责所有文案和字幕；TikTok 的文字 overlay 很重要，但应由后期或结构化字段控制。
- 默认脚本结构可以固定为：痛点 hook -> 产品演示 -> 结果/利益 -> CTA。

### 2.2 Google Veo 官方 Prompt 指南

来源：

- Veo Prompt Guide: https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide

关键观点：

- 好 Prompt 应清晰、具体。
- 官方推荐拆成 subject、context、action、style、camera motion、composition、ambiance。
- 图生视频时，要明确图里哪个主体做什么动作。
- 如果有多个主体，要用可区分的描述避免混乱。
- negative prompt 应描述不想出现的元素，避免使用“no/don't”这种指令式否定。
- 9:16 是短视频常用比例。
- 音频/对白要明确写，最好单独描述。

对 VidClaw 的启发：

- 最终视频 Prompt 不应是一段中文规则，而应是英文视觉描述。
- Prompt 结构应稳定但简短：
  - subject: the exact product from reference image
  - context: real home/kitchen/bathroom/desk scenario
  - action: product being used / result shown
  - camera: handheld close-up / quick push-in / macro shot
  - style: realistic TikTok UGC / phone-shot realism
  - pacing: fast / punchy
- negative 不要写一堆“do not”，而是写：wrong product, distorted packaging, unreadable label, extra logos。

### 2.3 Runway 官方视频 Prompt 指南

来源：

- Runway Gen-4 Video Prompting Guide: https://help.runwayml.com/hc/en-us/articles/39789879462419-Gen-4-Video-Prompting-Guide
- Runway Text to Video Prompting Guide: https://help.runwayml.com/hc/en-us/articles/42460036199443-Text-to-Video-Prompting-Guide
- Runway Image to Video Prompting Guide: https://help.runwayml.com/hc/en-us/articles/48324313115155

关键观点：

- Runway 明确强调“简单 Prompt”的力量。
- 图生视频时，图片已经定义构图、主体、灯光和风格；文本 Prompt 主要描述 motion。
- 不推荐复杂长 Prompt，不推荐对 5-10 秒视频安排过多动作、场景变化和风格变化。
- 不推荐负面表达；应使用正向描述。
- 不要用聊天式或命令式 Prompt，而要描述可见画面。
- 对多个主体、动作和镜头要谨慎，越复杂越容易不稳定。

对 VidClaw 的启发：

- 我们刚把最终 Prompt 缩短是正确方向。
- 产品图生视频场景下，不要重复描述商品所有细节；这会浪费 Prompt 空间，还可能降低运动质量。
- 对商品带货视频，最适合的生成单位是“单场景单动作镜头”：
  - hand picks up the product;
  - product sits beside messy problem;
  - product is used once;
  - close-up shows visible result;
  - camera pushes in quickly.

### 2.4 OpenAI / Sora 官方资料

来源：

- Sora App Help: https://help.openai.com/en/articles/12460853-creating-videos-on-the-sora-app
- Sora Web Help: https://help.openai.com/en/articles/9957612
- Sora Technical Report: https://openai.com/index/video-generation-models-as-world-simulators/

关键观点：

- Sora 官方建议：先具体，再迭代；加 camera、motion、pacing；描述 timing；锚定真实感；减少 moving parts。
- 官方明确说：更少角色、更简单动作会提高 fidelity，尤其是物理和 lip-sync 场景。
- Sora 技术报告承认：物理交互、物体状态变化、长时一致性、物体突然出现等仍有局限。
- Sora 的优势在于复杂场景、镜头运动、不同尺寸/比例、图像/视频作为输入、视觉世界模拟。

对 VidClaw 的启发：

- 不要让模型做复杂“剧情广告”，而要做短、清楚、强视觉的片段。
- 如果要口播/字幕，需要非常明确；否则默认不要。
- 多人物对话、多人手部交互、复杂吃喝/破碎/液体/包装打开等容易翻车，要少用或作为高级模式。
- 真实感关键词很重要，例如：
  - phone-shot realism
  - handheld jitter
  - natural kitchen lighting
  - imperfect UGC framing
  - close-up product demo

### 2.5 Google Ads / YouTube ABCD 创意原则

来源：

- Google Ads ABCDs: https://support.google.com/google-ads/answer/14783551

关键观点：

- Google 把有效视频广告总结为 ABCD：
  - Attention：快速抓注意力；
  - Branding：品牌/产品尽早出现；
  - Connection：让用户产生感受或联想；
  - Direction：明确下一步行动。
- Google 提到这些原则可提升短期销售可能性和长期品牌贡献。
- 对行动转化目标，CTA 应贯穿，并且越到后面越直接。

对 VidClaw 的启发：

- VidClaw 生成脚本不应该只生成画面美感，还要生成商业结构。
- 每条视频应该明确：
  - 目标用户痛点；
  - 商品解决动作；
  - 可信视觉证据；
  - 下一步 CTA。

### 2.6 Meta 视频广告资料

来源：

- Meta Video Ads: https://www.facebook.com/business/ads/video-ad-format
- Meta Awareness Ads: https://www.facebook.com/business/ads/ad-objectives/awareness
- Meta Advantage+ Creative: https://www.facebook.com/business/ads/meta-advantage-plus/creative
- Meta Stories Ads: https://www.facebook.com/business/ads/stories-ad-format

关键观点：

- Meta 强调 mobile-native video。
- Meta 提到视频广告一般建议 15 秒以内。
- Meta 强调静音自动播放环境下，开头几秒和无声可理解很关键。
- Meta Advantage+ Creative 的方向是用 AI 生成多种变体、适配版位、背景、文本、音乐。
- Stories/Reels 场景强调竖屏、沉浸、快速理解。

对 VidClaw 的启发：

- VidClaw 不应只追求单条“完美视频”，而要支持批量变体。
- 对 Meta/Reels 适配时，视频要在无声情况下也能理解：产品、动作、结果应靠画面讲清楚。
- 字幕和价格应走后期叠加，这样不同平台尺寸/安全区也更好控制。

## 3. AI 视频模型的优势与弱点

### 3.1 优势

AI 视频模型适合做：

1. 场景变体

- 同一商品放到厨房、浴室、办公室、车内、户外、卧室等场景。
- 对电商很重要，因为用户会通过“这个场景像我”产生代入。

2. 氛围和镜头

- 微距、推近、手持、低角度、俯拍、快速转场、自然光、电影感。
- 传统拍摄需要布景和摄影；AI 可以低成本试很多风格。

3. 高频素材测试

- 同一个商品可以批量生成 20-50 个 hook 和镜头组合。
- 平台广告越来越依赖 creative testing，AI 的优势是速度和规模。

4. 商品使用想象

- 把静态商品图变成“正在被使用”的动态演示。
- 对新品牌、新 SKU、没有拍摄团队的卖家很有价值。

5. 视觉夸张与结果表达

- 例如污渍消失、房间变清新、皮肤发光、桌面变整洁。
- 但必须控制成“视觉隐喻/结果暗示”，不要让模型做复杂物理精确过程。

### 3.2 弱点

AI 视频模型容易翻车的点：

1. 精确文字

- 字幕、价格、优惠码、品牌 Logo、包装文字容易错字、变形、乱码。
- 结论：不要让视频模型生成关键文字，后期叠加。

2. 商品一致性

- 包装、Logo、瓶身形状、颜色、标签可能漂移。
- 结论：强制参考图；Prompt 只短句强调 preserve product identity，不要长篇描述。

3. 手部和复杂交互

- 手拿、打开、倒出、涂抹、剪切、破碎、液体流动容易不稳定。
- 结论：用简单动作：pick up、place beside、wipe once、spray once、pour briefly。

4. 长剧情连续性

- 10 秒以上多场景、多人物、多状态变化容易断裂。
- 结论：生成多个 5-8 秒片段，后期剪辑。

5. 多人物对话与 lip-sync

- 多人说话、切换台词、口型语言容易错乱。
- 结论：默认不要生成旁白/对白；需要时只保留一个 voiceover 或一人一句。

6. 规则墙副作用

- Prompt 太长、限制太多，模型会把注意力分散到“遵守规则”，反而降低画面美感和动作自然度。
- 结论：系统 Prompt 负责结构，最终视频 Prompt 保持短、视觉化。

## 4. 爆款电商短视频的结构模型

### 4.1 推荐默认结构：Hook -> Demo -> Proof -> CTA

1. Hook：0-2 秒

目标：让用户停下滑动。

可用类型：

- 痛点直击：Still dealing with cat litter smell?
- 反常识：I stopped using room spray after this.
- 结果前置：My bathroom smells clean in 10 seconds.
- 场景冲突：Guests are coming. The room smells bad.
- 强视觉问题：dirty sink / cluttered desk / oily pan / dull skin。

为什么有效：

- TikTok 和 Google 都强调尽早抓注意力。
- AI 适合生成强视觉问题场景，比抽象卖点更容易看懂。

2. Demo：2-6 秒

目标：展示商品如何解决问题。

可用镜头：

- close-up hand picks up product
- quick spray / wipe / place / apply
- camera push-in on product
- product beside the problem

为什么有效：

- 产品早出镜可以提升品牌记忆。
- AI 擅长短动作和镜头运动，不适合复杂流程。

3. Proof：6-9 秒

目标：给用户一个“看起来有效”的视觉证据。

可用镜头：

- before/after split feeling，但不要强制模型写字；
- clean surface close-up；
- happy reaction；
- room looks fresh；
- product still visible in foreground。

为什么有效：

- 电商转化靠“我相信它有用”。
- AI 可以表现结果氛围，但不应承担真实测评证据。

4. CTA：最后 1-2 秒

目标：明确下一步行动。

建议：

- CTA 文案后期叠加；
- 视频模型只生成产品 hero shot；
- CTA 例子：Try it today / Shop now / Limited offer。

为什么有效：

- 平台资料强调 close/Direction。
- CTA 属于精确文字，后期叠加更可靠。

## 5. 适合 AI 生成的电商视频类型

### 5.1 痛点解决型

适合品类：

- 清洁、宠物、家居、除味、收纳、美妆、厨房用品。

结构：

- 问题画面 -> 商品出现 -> 简单使用 -> 结果画面。

Prompt 例子：

```text
9:16 TikTok-style product demo. A messy bathroom sink, quick handheld close-up. The product from the reference image is picked up and used once. Fast push-in to a clean, fresh-looking result. Natural phone-shot realism, punchy cuts.
```

### 5.2 结果前置型

适合品类：

- 美妆、服饰、清洁、健身、家居改善。

结构：

- 先给结果 -> 回到使用动作 -> 再给结果。

Prompt 例子：

```text
9:16 UGC-style ad. Start with the finished clean result, then quick cut to the product being used once. Close-up product hero shot at the end. Bright natural light, handheld phone camera, fast pacing.
```

### 5.3 对比型

适合品类：

- 清洁、护肤、厨房、工具、小家电。

注意：

- 不要让模型生成精确 split-screen 字幕；
- 可以让画面表达两种状态，字幕后期加。

Prompt 例子：

```text
Vertical product ad. Left side feels messy and dull, right side feels clean and fresh. The product from the reference image sits clearly in the center foreground. Quick camera push-in, realistic home lighting.
```

### 5.4 测评感/UGC 型

适合品类：

- TikTok Shop、独立站、亚马逊爆款、低客单冲动消费品。

结构：

- 手机拍摄感；
- 手拿产品；
- 简单动作；
- 真实环境；
- 不要太精致。

Prompt 例子：

```text
Realistic TikTok UGC product demo, handheld phone camera. A creator holds the product from the reference image near a kitchen counter, uses it once, then shows the result. Natural imperfect framing, fast cuts, casual home lighting.
```

### 5.5 场景种草型

适合品类：

- 生活方式、美妆、香氛、饰品、家居装饰、服饰。

结构：

- 不强调强卖点；
- 强调“这个东西让生活变好看”。

Prompt 例子：

```text
9:16 lifestyle product scene. The product from the reference image is placed on a warm bedroom desk beside everyday items. Soft morning light, gentle handheld push-in, cozy premium feeling.
```

## 6. 不推荐直接让 AI 生成的内容

1. 精确字幕、价格、优惠码、平台按钮

原因：文字生成不稳定，且不同平台安全区不同。

建议：由前端/后期叠加。

2. 复杂开箱

原因：包装结构、手部动作、物体状态变化容易错。

建议：只做“产品已在桌上，手拿起”。

3. 多人对话口播

原因：lip-sync、语言、口音、角色身份容易混乱。

建议：一个 voiceover，或无声画面 + 后期字幕。

4. 夸张医学/功效承诺

原因：平台审核风险高，且生成结果可能误导。

建议：用“visual improvement / fresh feeling / cleaner look”这种视觉表达。

5. 太多卖点

原因：短视频认知负荷高，AI 也会分散。

建议：一条视频只讲一个卖点。

## 7. 对 VidClaw 产品能力的建议

### 7.1 后台系统 Prompt 应改成“生成策略”，不是“规则墙”

建议 Gemini 脚本层输出以下字段：

```json
{
  "ad_angle": "pain_point | demo | proof | lifestyle | offer",
  "hook": "one short hook idea",
  "single_benefit": "one benefit only",
  "visual_problem": "what problem appears visually",
  "product_action": "one simple action",
  "proof_moment": "visual result moment",
  "pacing": "fast | medium | slow",
  "on_screen_text": [],
  "shots": [
    {
      "id": 1,
      "sora_prompt": "short English visual prompt",
      "duration_s": 3,
      "camera": "close-up",
      "voiceover": "",
      "on_screen_text": []
    }
  ],
  "full_sora_prompt": "short final prompt"
}
```

重点：

- `on_screen_text` 默认空；
- `voiceover` 默认空；
- 只在用户明确要求时填写；
- `full_sora_prompt` 不要塞完整广告文案；
- 文案和视频分离。

### 7.2 最终视频 Prompt 建议控制在 80-160 英文词以内

合理结构：

```text
9:16 TikTok-style ecommerce video. [Hook visual]. The product from the reference image appears in the first second. [One simple action]. [One result moment]. Handheld phone camera, close-up product demo, natural home lighting, fast punchy pacing.
Language: [selected language] if speech/text is requested.
Avoid: wrong product, distorted packaging, extra logos, unreadable labels.
```

不建议：

- 十几条 bullet 的硬约束；
- 同时要求字幕、旁白、复杂剧情、多个镜头、多个 CTA；
- 让模型生成准确文字；
- 过度强调“不能、不要、必须”。

### 7.3 批量生成模板

同一个商品可以自动生成 6 条变体：

1. 痛点版

- 目标：停滑。
- Hook：problem first。

2. 演示版

- 目标：解释怎么用。
- Hook：watch this work。

3. 结果版

- 目标：让人相信效果。
- Hook：look at the result。

4. UGC 测评版

- 目标：信任感。
- Hook：I tried this for a week。

5. 场景种草版

- 目标：审美和生活方式。
- Hook：small upgrade for my desk / bathroom / bag。

6. 优惠版

- 目标：转化。
- Hook：I found this under $X / today’s deal。
- 价格和优惠后期叠加，不让视频模型生成。

### 7.4 模型适配策略

不同视频模型应该采用不同 Prompt 风格：

#### Veo 类

适合：

- 清晰结构；
- subject/context/action/camera/style；
- 有 negative prompt；
- 稍微详细一点。

Prompt 策略：

```text
Subject + context + action + camera + composition + ambiance.
Negative: wrong package, extra logos, distorted hands.
```

#### Runway 类

适合：

- 图生视频；
- 短动作；
- 运动描述。

Prompt 策略：

```text
The product remains clearly visible. Handheld camera pushes in as a hand picks it up. Natural kitchen light, realistic motion.
```

避免：

- 复杂故事；
- command-based prompt；
- negative prompt；
- 多动作堆叠。

#### Sora 类

适合：

- 更强场景、镜头、真实感；
- 需要 timing 的短剧式片段；
- storyboarding。

Prompt 策略：

```text
Three-beat timing: problem close-up -> product used once -> result close-up. Handheld phone realism, quick cuts, one moving subject.
```

避免：

- 多人物多对话；
- 复杂物理；
- 长时状态变化。

## 8. 推荐的系统 Prompt 原则

### 8.1 脚本生成 Prompt 原则

应该要求 Gemini：

- 一次只选一个主要卖点；
- 优先生成视觉可表达的痛点；
- 默认不生成字幕/旁白；
- 如果用户明确要求字幕/旁白，必须输出结构化字段；
- 如果用户手动选择语言，字幕/旁白/文案按手动语言；
- full_sora_prompt 保持短、英文、视觉化；
- 输出多个角度时，每个角度要有不同 hook。

### 8.2 最终视频 Prompt 原则

最终 Prompt 应该：

- 短；
- 英文；
- 描述画面，不解释营销理论；
- 只加关键不可丢的约束；
- 不把后台规则全部传给视频模型；
- 文案、CTA、价格、字幕走结构化字段或后期。

## 9. 可直接落地的 Prompt 模板

### 9.1 通用商品视频模板

```text
9:16 TikTok-style ecommerce video. Show the product from the reference image in the first second. Start with a clear visual problem, then one simple product-use action, then a close-up result moment. Handheld phone camera, natural home lighting, fast punchy cuts, realistic UGC feel.
```

### 9.2 清洁/家居模板

```text
9:16 realistic home product demo. A messy or unpleasant household problem appears immediately. The product from the reference image is used once in a close-up shot. Quick cut to a cleaner, fresher-looking result. Handheld phone camera, natural light, fast pacing.
```

### 9.3 美妆/护肤模板

```text
9:16 beauty UGC video. Start with a close-up beauty concern, then show the product from the reference image being applied once. End on a fresh, confident result close-up. Soft bathroom lighting, handheld phone realism, quick cuts.
```

### 9.4 服饰/配饰模板

```text
9:16 outfit product video. Start with a plain look, then quick cut to the product from the reference image being worn or styled. End with a confident mirror shot. Handheld phone camera, natural indoor light, fast fashion TikTok pacing.
```

### 9.5 宠物用品模板

```text
9:16 pet-owner UGC video. Start with a relatable pet mess or odor problem. The product from the reference image appears clearly and is used once. End with a cleaner, calmer home moment. Handheld phone camera, warm home lighting, fast cuts.
```

### 9.6 厨房用品模板

```text
9:16 kitchen product demo. Start with a frustrating cooking or cleanup moment. The product from the reference image is used once in a close-up. End with a satisfying result shot on the counter. Handheld phone camera, natural kitchen light, punchy pacing.
```

## 10. 明天建议检查的问题

1. 后台系统 Prompt 是否应直接改成上述结构？

建议：是，但先做一版灰度，不要一次性大改所有模式。

2. 是否要在 UI 增加“爆款角度”选项？

建议：可以加，但不要复杂。可选：

- 自动；
- 痛点；
- 演示；
- 结果；
- UGC 测评；
- 场景种草；
- 优惠转化。

3. 是否要把字幕/旁白做成显式开关？

建议：是。默认关闭；用户选择“生成字幕/旁白”才输出。

4. 是否要做“后期字幕叠加”？

建议：这是高价值方向。AI 视频生成画面，系统后期叠字，质量会明显更稳。

5. 是否要做批量变体？

建议：必须做。真正适合广告投放的是一组素材，不是一条素材。

## 11. 下一步实施建议

优先级 P0：

- 把后台视频脚本默认 Prompt 改成“一卖点、一动作、一结果、默认无字幕/旁白”的结构。
- 让 Gemini 输出 `ad_angle`、`single_benefit`、`visual_problem`、`product_action`、`proof_moment`。
- 最终视频 Prompt 控制在 80-160 英文词。

优先级 P1：

- UI 增加“创意角度”选择；
- 增加“字幕/旁白”开关；
- 增加“批量角度生成”：同一商品自动生成 6 个版本。

优先级 P2：

- 做后期文字叠加系统；
- 对 TikTok/Reels/Shorts 做不同安全区和文案长度策略；
- 后台统计不同角度的生成/下载/支付转化。

## 12. 最终判断

VidClaw 的机会不在于“谁能调用更强的视频模型”，而在于把电商创意方法论产品化：

- 用平台广告规律决定脚本；
- 用 AI 视频模型做视觉变体；
- 用后期系统处理文字和 CTA；
- 用批量生成解决创意疲劳；
- 用数据闭环筛选有效角度。

如果只把用户输入变成长 Prompt，效果会不稳定；如果把 Prompt 当作“短视频广告镜头调度器”，效果会更接近可投放素材。

