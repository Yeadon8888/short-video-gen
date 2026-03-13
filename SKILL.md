---
name: short-video-gen
description: 短视频自动生成。支持抖音/TikTok 链接二创、本地视频二创、主题生产三种模式，自动生成配套标题/文案/首评。用户提到"生成短视频"、"视频二创"、"sora生成视频"、"产品视频"、"帮我用这个链接生成视频"时使用。
---

# 短视频自动生成

通过 Gemini（视频理解）+ VEO 3.1 / Sora（视频生成）的完整工作流。支持三种模式：抖音/TikTok 链接二创、本地视频二创、主题生产。

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--url <文本>` | 抖音/TikTok 分享链接，**支持直接粘贴含表情/中文/话题标签的完整分享文字** | — |
| `--video <路径>` | 本地视频文件路径 | — |
| `--prompt <文本>` | 生产模式必填；二创模式为修改意见 | — |
| `--images <文件夹>` | 产品图片文件夹；传 `0` 不使用产品图 | skill 目录下的 `image/` |
| `--orientation` | `portrait`（竖屏）/ `landscape`（横屏） | `portrait` |
| `--duration` | `10` / `15`（秒） | `15` |
| `--count` | 生成视频数量（1–10） | `1` |
| `--random-image` | 从图片文件夹随机选一张（不加则用第一张） | 否 |
| `--model <名称>` | 视频生成模型：`veo3.1-fast` / `veo3.1-components` / `veo3.1-pro-4k` / `sora` | `veo3.1-fast` |

**模式判断：**
- 提供 `--url` → 自动提取链接 → TikHub 下载原视频 → Gemini 分析 → Sora 生成
- 提供 `--video` → Gemini 分析本地视频 → Sora 生成
- 只有 `--prompt` → Gemini 扩展主题 → Sora 生成（生产模式）

## 前置条件：.env 文件

脚本从**运行目录**自动加载 `.env`。使用前确认用户运行目录有 `.env`，或 skill 目录下有 `.env`。

必填：
```
VIDEO_API_KEY=sk-...        # 柏拉图 / BLTCY 视频接口
```

按需填写：
```
GEMINI_API_KEY=sk-...       # 单独的 Gemini Key
GEMINI_BASE_URL=...         # 默认 https://yunwu.ai
VIDEO_BASE_URL=...          # 默认 https://api.bltcy.ai
VIDEO_MODEL=veo3.1-fast       # 默认 veo3.1-fast，可选 veo3.1-components / veo3.1-pro-4k / sora
TIKHUB_API_KEY=...          # 使用 --url 时必填，用于解析抖音/TikTok 链接
UPLOAD_API_URL=...          # Cloudflare 上传网关
UPLOAD_API_KEY=...
UPLOAD_PREFIX=vidclaw-assets
```

如果 `.env` 不存在或缺少 `VIDEO_API_KEY`，脚本会报错退出并提示用户添加。

## 执行方式

**必须从 skill 目录运行**（脚本自动加载该目录的 `.env`）：

```bash
SKILL_DIR="$HOME/.claude/skills/short-video-gen"
cd "$SKILL_DIR"

python3 scripts/generate.py \
  [--url "<分享文字或链接>"] \
  [--video <视频路径>] \
  [--prompt "<提示词或修改意见>"] \
  [--images <图片文件夹 或 0>] \
  [--orientation portrait|landscape] \
  [--duration 10|15] \
  [--count 1-10] \
  [--random-image]
```

> 视频路径如果是相对路径，需相对于 skill 目录。如果用户给的是绝对路径则直接用。

## 场景示例

**场景 1：抖音链接二创（直接粘贴分享文字）**
```bash
cd "$HOME/.claude/skills/short-video-gen"
python3 scripts/generate.py \
  --url "5.33 lPX:/ 小猫咪洗头 #AI创作 https://v.douyin.com/xxx/ 复制此链接..."
```

**场景 2：链接二创 + 修改意见**
```bash
cd "$HOME/.claude/skills/short-video-gen"
python3 scripts/generate.py \
  --url "https://v.douyin.com/xxx/" \
  --prompt "把里面的人换成猫咪"
```

**场景 3：本地视频二创**
```bash
cd "$HOME/.claude/skills/short-video-gen"
python3 scripts/generate.py --video /path/to/demo.mp4
```

**场景 4：本地视频二创 + 修改意见 + 自定义产品图**
```bash
cd "$HOME/.claude/skills/short-video-gen"
python3 scripts/generate.py \
  --video /path/to/demo.mp4 \
  --prompt "更明亮的色调，加快节奏" \
  --images /path/to/imgs
```

**场景 5：生产模式（主题扩展）**
```bash
cd "$HOME/.claude/skills/short-video-gen"
python3 scripts/generate.py \
  --prompt "一只猫咪在吉隆坡街头跳舞" \
  --orientation landscape \
  --duration 10
```

**场景 6：批量生成（最多 10 个）**
```bash
cd "$HOME/.claude/skills/short-video-gen"
python3 scripts/generate.py \
  --url "https://v.douyin.com/xxx/" \
  --count 3
```

**场景 7：不使用产品图**
```bash
cd "$HOME/.claude/skills/short-video-gen"
python3 scripts/generate.py --video /path/to/demo.mp4 --images 0
```

## 输出结果

脚本成功完成后输出：
1. **视频 URL**：可直接在浏览器打开或下载
2. **视频文案**：标题 + 正文文案（含话题标签）+ 首评

示例输出：
```
✅ https://midjourney-plus.oss-us-west-1.aliyuncs.com/xxx.mp4

📋 视频文案
  标题：...
  文案：... #glumoo #NAG
  首评：... #glumoo #NAG
```

## 常见错误排查

| 错误信息 | 原因 | 解决方法 |
|---------|------|---------|
| `未找到 VIDEO_API_KEY` | .env 不存在或未填 Key | 在运行目录创建 `.env` 并填入 Key |
| `未找到 TIKHUB_API_KEY` | 使用 --url 但未配置 | 在 `.env` 添加 `TIKHUB_API_KEY=...` |
| `TikHub 返回空响应` | Key 无效 / 网络不通 / 链接失效 | 检查 Key 是否正确，确认链接可访问 |
| `TikHub 返回非 JSON` | Key 格式错误或无权限 | 重新检查 TIKHUB_API_KEY |
| `视频文件不存在` | 路径错误 | 使用绝对路径，或确认相对路径正确 |
| `Gemini API 超时` | 视频文件过大（>50MB） | 压缩视频后重试 |

## 注意事项

- Sora 视频生成为异步任务，每 30 秒轮询一次，通常需等待 2–5 分钟，最长 30 分钟超时
- 产品图默认使用 skill 目录下的 `image/` 文件夹，图片会上传到 Cloudflare 上传网关并缓存
- `--count` 最多 10，超出会直接报错
- 提示词风格可在 `prompts.md` 中修改，无需动代码
