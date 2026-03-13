# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Claude Code **skill** for short video auto-generation. It orchestrates Gemini (`gemini-3.1-pro-preview`) for script generation and VEO 3.1 / Sora for video generation:
- **Gemini** (`gemini-3.1-pro-preview`) — analyzes an input video (or expands a theme) and generates an English video prompt
- **VEO 3.1 Fast** (`veo3.1-fast` by default) — generates video from the prompt. Also supports `veo3.1-components`, `veo3.1-pro-4k`, and `sora`

The skill is invoked by Claude Code via `SKILL.md` and executed by running `scripts/generate.py`.

## Running the Script

The script must be run from the skill directory so `.env` is auto-loaded:

```bash
SKILL_DIR="$HOME/.claude/skills/short-video-gen"
cd "$SKILL_DIR"

# URL mode: paste Douyin/TikTok share text (auto-extracts link, downloads via TikHub)
python3 scripts/generate.py --url "https://v.douyin.com/xxx/"

# Remix mode: local video → Gemini → Sora
python3 scripts/generate.py --video demo.mp4

# Remix + modification hint
python3 scripts/generate.py --video demo.mp4 --prompt "更明亮的色调"

# Production mode: theme → Gemini expand → Sora
python3 scripts/generate.py --prompt "一只猫咪在吉隆坡街头跳舞"

# With options: custom images folder, orientation, duration, count
python3 scripts/generate.py --video demo.mp4 --images ./imgs --orientation landscape --duration 10 --count 3

# Disable product images
python3 scripts/generate.py --video demo.mp4 --images 0
```

`.env` is loaded from `cwd`, falling back to `~/.env`. The skill dir ships with a `.env`.

## Environment Variables (`.env`)

| Variable | Required | Purpose |
|---|---|---|
| `VIDEO_API_KEY` | Yes | Plato / BLTCY video generation |
| `VIDEO_BASE_URL` | No | Defaults to `https://api.bltcy.ai` |
| `VIDEO_MODEL` | No | Defaults to `veo3.1-fast`. Options: `veo3.1-fast`, `veo3.1-components`, `veo3.1-pro-4k`, `sora` |
| `GEMINI_API_KEY` | No | Gemini calls; falls back to `YUNWU_GEMINI_API_KEY` / `YUNWU_API_KEY` |
| `TIKHUB_API_KEY` | When using `--url` | Resolve and download Douyin/TikTok videos |
| `UPLOAD_API_URL`, `UPLOAD_API_KEY`, `UPLOAD_PREFIX` | No | Cloudflare upload gateway for image hosting |

## Architecture

`scripts/generate.py` is a **single-file, stdlib-only** Python 3.10+ script. No `pip install` needed. All HTTP is done via `curl` subprocess to work around Python 3.14 SSL compatibility issues.

**Three modes:**
1. **URL mode** (`--url`): extracts URL from mixed share text → resolves short links → TikHub hybrid API → fallback to aweme_id API → fallback to share_url API → downloads watermark-free video → enters Gemini analysis
2. **Remix mode** (`--video`): base64-encodes local video → POST to Gemini as `inline_data` → extracts non-thought response parts (gemini-3-pro-preview is a thinking model) → Sora prompt
3. **Production mode** (only `--prompt`): sends theme text to Gemini for expansion → Sora prompt

**Full execution flow:**
1. Parse args → determine mode
2. If `--url`: download video via TikHub, set as `args.video`
3. If `--images` (default: `$SKILL_DIR/image/`): upload new images to R2 (AWS Sig V4), cache MD5→URL in `image_cache.json`
4. Call Gemini → get Sora prompt
5. Call Gemini again → generate Chinese copy (title + caption + first_comment JSON)
6. POST to `/v2/videos/generations` on api.bltcy.ai (one task per `--count`)
7. Poll `/v2/videos/generations/{task_id}` every 30 seconds until terminal status

**API retry logic:** 3 attempts — 60s delay on upstream saturation (HTTP 500 + "负载已饱和"), 5s delay on timeout/network errors.

**Image defaults:** `--images` defaults to `$SKILL_DIR/image/` (computed from `__file__`, not `cwd`). Pass `--images 0` to disable. By default uses first image alphabetically; `--random-image` picks randomly.

## Customizing Prompts

Edit `prompts.md` to change Gemini behavior without touching code. The file uses `## SECTION_NAME` headers, and `{{PLACEHOLDER}}` for runtime substitution:

| Section | Purpose | Placeholders |
|---|---|---|
| `VIDEO_REMIX_BASE` | Video remix without modification hint | — |
| `VIDEO_REMIX_WITH_MODIFICATION` | Video remix with modification hint | `{{MODIFICATION_PROMPT}}` |
| `THEME_TO_VIDEO` | Production mode theme expansion | `{{THEME}}` |
| `COPY_GENERATION` | Generate title + caption + first_comment JSON | `{{SORA_PROMPT}}` |

If a section is missing or the file doesn't exist, the script falls back to hardcoded English prompts.

## Key Constraints

- Video files should be <50 MB for Gemini `inline_data` (larger may timeout)
- Sora generation is async; typical wait is 2–5 minutes, max 30 minutes
- R2 image upload is optional — if R2 env vars are missing, image upload is skipped silently
- `--duration` only accepts `10` or `15` (seconds)
- `--count` range is 1–10
