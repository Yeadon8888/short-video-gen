"""Retry the 2 failed showcase generations (candle, keyboard) only."""
import sys
sys.path.insert(0, ".")
# Reuse the core function from the main script
from importlib.machinery import SourceFileLoader
mod = SourceFileLoader("gen", "scripts/generate-showcase-videos.py").load_module()

import json
from pathlib import Path

RETRY = ["candle", "keyboard"]
IMAGE_BASE = "https://vc-upload.yeadon.top/files/vidclaw-assets/showcase"

prompts = {p["slug"]: p["prompt"] for p in mod.PRODUCTS}

out_path = Path("scripts/generate-showcase-videos.output.json")
out = json.loads(out_path.read_text(encoding="utf-8")) if out_path.exists() else {}

for slug in RETRY:
    try:
        url = mod.generate_one(slug, prompts[slug], f"{IMAGE_BASE}/{slug}.jpg")
        out[slug] = url
    except Exception as e:
        print(f"!!! {slug} FAILED AGAIN: {e}")

out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
print("\n==== FINAL ====")
print(json.dumps(out, indent=2, ensure_ascii=False))
