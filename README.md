# 短视频自动生成 - Short Video Generator

通过 [yunwu.ai](https://yunwu.ai) 调用 **Gemini**（视频理解）+ **Sora-2-all**（视频生成）的完整自动化工作流，支持视频二创和主题生产两种模式，自动生成配套社媒文案。

## 功能

- **二创模式**：上传本地视频 → Gemini 分析提取 Sora 脚本 → Sora 生成新视频
- **生产模式**：输入主题 → Gemini 扩展为详细提示词 → Sora 生成视频
- **产品图参考**：默认带入 `image/` 文件夹的产品图，作为 Sora 视觉参考
- **文案生成**：自动生成标题、正文文案（含 #glumoo #NAG 标签）、首评

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的 API Key
```

### 2. 运行

```bash
# 二创模式
python3 scripts/generate.py --video demo.mp4

# 二创 + 修改意见
python3 scripts/generate.py --video demo.mp4 --prompt "把人换成猫咪"

# 生产模式（主题扩展）
python3 scripts/generate.py --prompt "一只猫咪在吉隆坡街头跳舞"

# 不使用产品图
python3 scripts/generate.py --video demo.mp4 --images 0
```

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--video <路径>` | 本地视频文件（触发二创模式） | — |
| `--prompt <文本>` | 生产模式必填；二创模式为修改意见 | — |
| `--images <文件夹>` | 产品图片文件夹；传 `0` 不使用产品图 | `image/`（默认） |
| `--orientation` | `portrait` / `landscape` | `portrait` |
| `--duration` | `10` / `15`（秒） | `15` |
| `--count` | 生成视频数量 | `1` |
| `--random-image` | 从图片文件夹随机选一张 | 否（用第一张） |

## 自定义提示词

编辑 `prompts.md` 可定制 Gemini 的行为，无需改代码：

| 区块 | 用途 |
|---|---|
| `VIDEO_REMIX_BASE` | 视频二创（无修改意见）→ Sora 脚本 |
| `VIDEO_REMIX_WITH_MODIFICATION` | 视频二创（有修改意见）→ Sora 脚本 |
| `THEME_TO_VIDEO` | 主题扩展 → Sora 脚本（生产模式） |
| `COPY_GENERATION` | Sora 脚本 → 标题 + 文案 + 首评 |

## 注意事项

- 视频文件建议 < 50 MB（Gemini inline_data 限制）
- Sora 视频生成为异步任务，通常需等待 2–5 分钟
- R2 图片存储为可选配置，不填则跳过产品图上传
