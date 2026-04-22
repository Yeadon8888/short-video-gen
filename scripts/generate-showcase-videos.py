"""
为 ShowcaseGrid 剩下的 5 个产品图用 Grok 跑一遍生成视频。

用法:
  pip install requests boto3
  export GROK2API_KEY=<你的 grok2api key>
  export R2_ACCESS_KEY=<doc 里 grok-videos 桶的 R2 Access Key>
  export R2_SECRET_KEY=<doc 里 grok-videos 桶的 R2 Secret Key>
  python scripts/generate-showcase-videos.py

前置:
  - 产品图需要公网可访问。默认用 https://video.yeadon.top/showcase/*.jpg
  - 如果线上站还没更新图，改 IMAGE_BASE 为本地起的 ngrok 或任意 CDN。

产出:
  - 控制台打印每个产品的新视频 URL
  - 同时写入 scripts/generate-showcase-videos.output.json
  - 把输出贴给 Claude，Claude 会更新 ShowcaseGrid.tsx
"""
import json
import os
import time
from pathlib import Path

import boto3
import requests

# ---------- 常量（来自 docs/test-case-image-to-video.md） ----------
GROK_BASE = "https://grok2api-production-3630.up.railway.app"
R2_ACCOUNT_ID = "7b9caab0b84d1cb1163b2bc28a75a3d5"
R2_BUCKET = "grok-videos"
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
R2_PUBLIC = "https://pub-432835bf3332484eab488001d1a1ce65.r2.dev"

# 产品图托管地址（线上部署后）
IMAGE_BASE = os.environ.get("IMAGE_BASE", "https://video.yeadon.top/showcase")

# 5 个需要生成视频的产品 + 针对性 prompt
PRODUCTS = [
    {
        "slug": "candle",
        "img": f"{IMAGE_BASE}/candle.jpg",
        "prompt": "竖屏 TikTok 短视频：一支香氛蜡烛在暗色桌面上缓慢燃烧，镜头近距离推进，火焰微微摇曳，丝丝烟雾升腾，光影氛围感强，电影感慢动作",
    },
    {
        "slug": "keyboard",
        "img": f"{IMAGE_BASE}/keyboard.jpg",
        "prompt": "竖屏 TikTok 短视频：一只手在机械键盘上敲击代码，键帽依次被按下的特写，ASMR 节奏感，RGB 灯光柔和，45° 俯角镜头缓慢横移",
    },
    {
        "slug": "yoga",
        "img": f"{IMAGE_BASE}/yoga.jpg",
        "prompt": "竖屏 TikTok 短视频：一个亚洲女生穿着运动瑜伽服装在明亮的练功房做伸展动作，镜头从侧面缓缓推进，慢动作，光线明亮柔和",
    },
    {
        "slug": "smartwatch",
        "img": f"{IMAGE_BASE}/smartwatch.jpg",
        "prompt": "竖屏 TikTok 短视频：一只智能手表戴在手腕上，镜头特写表盘点亮显示心率和运动数据，手臂缓慢摆动，科技感十足，深色背景",
    },
    {
        "slug": "catfood",
        "img": f"{IMAGE_BASE}/catfood.jpg",
        "prompt": "竖屏 TikTok 短视频：一只可爱的英短猫吃猫粮的特写，猫耳朵微动，食欲满满，浅景深背景，温暖家居氛围",
    },
]

# ---------- Boto3 客户端 ----------
GROK_KEY = os.environ.get("GROK2API_KEY")
if not GROK_KEY:
    raise SystemExit("missing GROK2API_KEY env var")

s3 = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=os.environ["R2_ACCESS_KEY"],
    aws_secret_access_key=os.environ["R2_SECRET_KEY"],
    region_name="auto",
)


def generate_one(slug: str, prompt: str, image_url: str) -> str:
    print(f"\n========== {slug} ==========")
    print(f"image: {image_url}")

    # Step 1: submit
    r = requests.post(
        f"{GROK_BASE}/v1/videos",
        headers={"Authorization": f"Bearer {GROK_KEY}"},
        data={
            "model": "grok-imagine-video",
            "prompt": prompt,
            "input_reference[image_url]": image_url,
            "seconds": 10,
            "size": "720x1280",
            "resolution_name": "720p",
            "preset": "normal",
        },
        timeout=60,
    )
    r.raise_for_status()
    vid = r.json()["id"]
    print(f"[submit] id={vid}")

    # Step 2: poll
    for i in range(40):
        time.sleep(10)
        d = requests.get(
            f"{GROK_BASE}/v1/videos/{vid}",
            headers={"Authorization": f"Bearer {GROK_KEY}"},
            timeout=30,
        ).json()
        print(f"[poll {i}] status={d['status']} progress={d.get('progress', '?')}%")
        if d["status"] == "completed":
            break
        if d["status"] == "failed":
            raise RuntimeError(
                f"{slug} failed: {d.get('error', {}).get('message', 'unknown')}"
            )
    else:
        raise TimeoutError(f"{slug} generation timed out")

    # Step 3: download
    resp = requests.get(
        f"{GROK_BASE}/v1/videos/{vid}/content",
        headers={"Authorization": f"Bearer {GROK_KEY}"},
        timeout=180,
    )
    resp.raise_for_status()
    mp4 = resp.content
    print(f"[downloaded] {len(mp4) / 1024 / 1024:.2f} MB")

    # Step 4: upload to R2 with stable key (slug-based, not vid-based)
    key = f"videos/vidclaw-showcase-{slug}.mp4"
    s3.put_object(
        Bucket=R2_BUCKET,
        Key=key,
        Body=mp4,
        ContentType="video/mp4",
        CacheControl="public, max-age=31536000, immutable",
    )
    public_url = f"{R2_PUBLIC}/{key}"
    print(f"[uploaded] {public_url}")
    return public_url


def main():
    out = {}
    for p in PRODUCTS:
        try:
            url = generate_one(p["slug"], p["prompt"], p["img"])
            out[p["slug"]] = url
        except Exception as e:
            print(f"!!! {p['slug']} FAILED: {e}")
            out[p["slug"]] = None

    out_path = Path(__file__).parent / "generate-showcase-videos.output.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n============== DONE ==============")
    print(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"\nSaved to: {out_path}")


if __name__ == "__main__":
    main()
