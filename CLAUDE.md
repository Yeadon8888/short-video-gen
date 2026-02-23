# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Claude Code **skill** for short video auto-generation. It orchestrates two APIs via `yunwu.ai`:
- **Gemini** (`gemini-3-pro-preview`) — analyzes an input video and generates an English prompt
- **Sora** (`sora-2-all`) — generates video from the prompt (with optional image references)

The skill is invoked by Claude Code via `SKILL.md` and executed by running `scripts/generate.py` from the user's current working directory.

## Running the Script

```bash
SKILL_DIR="$HOME/.claude/skills/short-video-gen"

# Remix mode (video → Gemini → Sora)
python3 "$SKILL_DIR/scripts/generate.py" --video demo.mp4

# Production mode (prompt → Sora)
python3 "$SKILL_DIR/scripts/generate.py" --prompt "A cinematic product showcase"

# With product images, orientation, duration, count
python3 "$SKILL_DIR/scripts/generate.py" \
  --video demo.mp4 \
  --prompt "更明亮的色调" \
  --images ./imgs \
  --orientation landscape \
  --duration 10 \
  --count 3
```

The script must be run from the user's project directory — it auto-loads `.env` from `cwd` (then `~/.env` as fallback).

## Environment Variables (`.env`)

| Variable | Required | Purpose |
|---|---|---|
| `YUNWU_API_KEY` | Yes | Sora video generation via yunwu.ai |
| `YUNWU_GEMINI_API_KEY` | No | Gemini calls; falls back to `YUNWU_API_KEY` |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `S3_ID`, `S3_token`, `R2_PUBLIC_DOMAIN` | No | Cloudflare R2 for image hosting |

## Architecture

`scripts/generate.py` is a **single-file, stdlib-only** Python 3.10+ script. No `pip install` needed.

**Execution flow:**
1. Parse args → determine mode (remix if `--video`, production if only `--prompt`)
2. If `--images`: upload new images to R2 via AWS Signature V4, cache MD5→URL in `image_cache.json` inside the images folder
3. If remix mode: base64-encode the video, POST to Gemini inline as `inline_data`, extract the non-thought part of the response as the Sora prompt
4. POST to `/v1/video/create` on yunwu.ai to create async Sora task(s)
5. Poll `/v1/video/query` every 30 seconds until all tasks reach a terminal status

**Image selection logic (`--images` folder):**
- Always uploads all new images to R2 (cached by MD5)
- By default uses the first image; `--random-image` picks randomly

**API retry logic:** 3 attempts — 60s delay on upstream saturation (HTTP 500 + "负载已饱和"), 5s delay on timeout/network errors.

## Key Constraints

- Video files should be <50 MB for Gemini `inline_data` (larger may timeout)
- Sora generation is async; typical wait is 2–5 minutes
- R2 image upload is optional — if R2 env vars are missing, image upload is skipped silently
- `duration` only accepts `10` or `15` (seconds)
