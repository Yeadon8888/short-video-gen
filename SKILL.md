---
name: short-video-gen
description: 短视频自动生成。支持「二创」模式（上传本地视频→Gemini分析→Sora-2-all生成新视频）和「生产」模式（直接用提示词生成）。支持上传产品图片参考。用户提到"生成短视频"、"视频二创"、"sora生成视频"、"产品视频"时使用。
---

# 短视频自动生成

通过 yunwu.ai 调用 Gemini（视频理解）+ Sora-2-all（视频生成）的完整工作流。

## 入参说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--video <路径>` | 本地视频文件路径（触发**二创模式**） | — |
| `--prompt <文本>` | 提示词（**生产模式**必填；二创模式为修改意见） | — |
| `--images <文件夹>` | 产品图片文件夹；默认使用 skill 目录下的 `image/`；传 `0` 表示不使用产品图 | `image/`（默认） |
| `--orientation` | `portrait`（竖屏）/ `landscape`（横屏） | `portrait` |
| `--duration` | `10` / `15`（秒） | `15` |
| `--count` | 生成视频数量 | `1` |

**模式判断：**
- 提供 `--video` → 二创模式（Gemini 分析视频 → 生成脚本 → Sora 生成）
- 只有 `--prompt` → 生产模式（直接用 prompt → Sora 生成）
- 两者都没有 → 提示用户补充参数

**图片选择逻辑（`--images` 文件夹）：**
- 1 张 → 使用该张
- 2–3 张 → 全部使用
- > 3 张 → 随机选 1 张

## 前置条件

在用户当前项目目录确保存在 `.env` 文件，包含：
```
YUNWU_API_KEY=your_key_here
```

如果不存在，提示用户创建，再继续执行。

## 执行流程

### 1. 解析用户输入

将用户提供的参数映射到对应的 `--` 命令行参数。用户可能用自然语言描述，需要提取关键信息：
- 视频文件路径
- 提示词或修改意见
- 图片文件夹路径
- 方向/时长/数量偏好

### 2. 运行脚本

使用此技能目录下的 `scripts/generate.py` 脚本执行完整流程：

```bash
SKILL_DIR="$HOME/.claude/skills/short-video-gen"

python3 "$SKILL_DIR/scripts/generate.py" \
  [--video <视频路径>] \
  [--prompt "<提示词>"] \
  [--images <图片文件夹>] \
  [--orientation portrait|landscape] \
  [--duration 10|15] \
  [--count N]
```

从用户的当前工作目录运行（脚本会自动从 cwd 加载 `.env`）。

### 3. 展示结果

脚本运行完毕后：
- 成功：展示视频 URL，告知用户可下载或在浏览器中预览
- 失败：展示错误信息，建议排查 API Key 或网络连接

## 常见场景示例

**场景 1：上传视频做二创**
用户说："帮我用 demo.mp4 生成一个竖屏短视频"
```bash
python3 "$SKILL_DIR/scripts/generate.py" --video demo.mp4
```

**场景 2：二创 + 修改意见 + 产品图**
用户说："用 demo.mp4 二创，改成更明亮的色调，参考 ./imgs 里的产品图"
```bash
python3 "$SKILL_DIR/scripts/generate.py" \
  --video demo.mp4 \
  --prompt "更明亮的色调，加快节奏" \
  --images ./imgs
```

**场景 3：直接生产模式**
用户说："生成一个产品展示视频，横屏，10秒"
```bash
python3 "$SKILL_DIR/scripts/generate.py" \
  --prompt "A sleek product showcase with cinematic lighting and smooth camera movements" \
  --orientation landscape \
  --duration 10
```

**场景 4：批量生成**
用户说："生成 3 个不同版本的视频"
```bash
python3 "$SKILL_DIR/scripts/generate.py" \
  --video demo.mp4 \
  --count 3
```

## 注意事项

- 视频文件建议 < 50 MB，过大会导致 Gemini API 超时
- 图片上传通过 catbox.moe 中转获取公开 URL，属免费服务
- Sora 视频生成是异步任务，脚本每 30 秒轮询一次，通常需等待 2–5 分钟
- `images` 字段在无产品图时传空数组 `[]`，请确认 yunwu.ai 是否支持该用法
