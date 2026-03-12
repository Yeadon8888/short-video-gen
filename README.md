# 短视频自动生成 - Short Video Generator

用 AI 把别人的短视频「临摹」成自己的。粘贴一条抖音/TikTok 分享链接，自动完成：下载原视频 → Gemini 分析内容 → 柏拉图 Sora2 重新生成视频 → 配好标题、文案、首评，整个流程无需手动干预。

作为 [Claude Code](https://claude.ai/code) 的 skill 运行，`@` 一下即可触发。

## 功能

- **链接二创**：粘贴抖音/TikTok 分享文字（含表情/中文/话题标签均可），自动提取链接并下载原视频
- **本地视频二创**：上传本地视频 → Gemini 分析 → Sora 生成新视频
- **主题生产**：没有参考视频，输入一句话主题直接生成
- **产品图参考**：默认带入 `image/` 文件夹的产品图作为 Sora 视觉参考，可关闭
- **文案一键生成**：自动输出标题 + 正文文案（含话题标签）+ 首评
- **提示词解耦**：所有 Gemini 指令集中在 `prompts.md`，随时改风格无需动代码

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的 API Key
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `VIDEO_API_KEY` | 是 | 柏拉图 / BLTCY 视频生成接口 Key |
| `VIDEO_BASE_URL` | 否 | 视频接口 Base URL，默认 `https://api.bltcy.ai` |
| `VIDEO_MODEL` | 否 | 视频模型，默认 `sora-2` |
| `GEMINI_API_KEY` | 否 | Gemini Key，当前默认模型为 `gemini-3.1-pro-preview`；不填则回退到 `YUNWU_GEMINI_API_KEY` / `YUNWU_API_KEY` |
| `GEMINI_BASE_URL` | 否 | Gemini Base URL，默认 `https://yunwu.ai` |
| `TIKHUB_API_KEY` | 使用 `--url` 时必填 | TikHub，用于解析抖音/TikTok 链接 |
| `UPLOAD_API_URL` | 否 | Cloudflare 上传网关地址 |
| `UPLOAD_API_KEY` | 否 | Cloudflare 上传网关应用级密钥 |
| `UPLOAD_PREFIX` | 否 | 上传前缀，默认 `vidclaw-assets` |

### 2. 运行

```bash
SKILL_DIR="$HOME/.claude/skills/short-video-gen"

# 抖音链接二创（支持直接粘贴分享文字）
python3 "$SKILL_DIR/scripts/generate.py" \
  --url "5.33 lPX:/ 小猫咪洗头 #AI创作 https://v.douyin.com/xxx/ 复制此链接..."

# 本地视频二创
python3 "$SKILL_DIR/scripts/generate.py" --video demo.mp4

# 二创 + 修改意见
python3 "$SKILL_DIR/scripts/generate.py" --video demo.mp4 --prompt "把人换成猫咪"

# 主题生产模式
python3 "$SKILL_DIR/scripts/generate.py" --prompt "一只猫咪在吉隆坡街头跳舞"

# 不使用产品图
python3 "$SKILL_DIR/scripts/generate.py" --video demo.mp4 --images 0
```

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--url <文本>` | 抖音/TikTok 分享链接或分享文字（触发链接二创） | — |
| `--video <路径>` | 本地视频文件（触发本地二创模式） | — |
| `--prompt <文本>` | 生产模式必填；二创模式为修改意见 | — |
| `--images <文件夹>` | 产品图片文件夹；传 `0` 不使用产品图 | `image/`（默认） |
| `--orientation` | `portrait`（竖屏） / `landscape`（横屏） | `portrait` |
| `--duration` | `10` / `15`（秒） | `15` |
| `--count` | 生成视频数量 | `1` |
| `--random-image` | 从图片文件夹随机选一张 | 否（用第一张） |

## 自定义提示词

编辑 `prompts.md` 可定制 Gemini 的行为，无需改代码：

| 区块 | 用途 |
|------|------|
| `VIDEO_REMIX_BASE` | 视频二创（无修改意见）→ Sora 脚本 |
| `VIDEO_REMIX_WITH_MODIFICATION` | 视频二创（有修改意见）→ Sora 脚本，包含 `{{MODIFICATION_PROMPT}}` 占位符 |
| `THEME_TO_VIDEO` | 主题扩展 → Sora 脚本（生产模式），包含 `{{THEME}}` 占位符 |
| `COPY_GENERATION` | Sora 脚本 → 标题 + 文案 + 首评，包含 `{{SORA_PROMPT}}` 占位符 |

## 注意事项

- 视频文件建议 < 50 MB（Gemini inline_data 上限）
- 柏拉图视频生成为异步任务，通常需等待 2–5 分钟
- `--url` 收到混合文字时自动提取其中的 https 链接，无需手动清理
- 图片上传通过 Cloudflare Worker 网关完成，不再需要在 Web/CLI 中配置 R2 SigV4 凭证
