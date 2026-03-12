#!/usr/bin/env python3
"""
上传 demo.mp4 和 qr_code.jpg 到 Cloudflare 上传网关，并打印公开 URL。
用法：cd website && python3 upload_assets.py
"""
import json
import mimetypes
import os
import subprocess

# ── 加载 .env ──
def load_env(path):
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

script_dir = os.path.dirname(os.path.abspath(__file__))
skill_dir  = os.path.dirname(script_dir)
load_env(os.path.join(skill_dir, ".env"))
load_env(os.path.join(os.path.expanduser("~"), ".env"))

# ── Upload ──
def upload(filepath: str, object_key: str) -> str:
    upload_api_url = os.environ["UPLOAD_API_URL"].rstrip("/")
    upload_api_key = os.environ["UPLOAD_API_KEY"]
    mime = mimetypes.guess_type(filepath)[0] or "application/octet-stream"
    result = subprocess.run(
        [
            "curl", "-s", "-L",
            "--noproxy", "*", "--max-time", "120",
            "-X", "POST",
            "-H", f"Content-Type: {mime}",
            "-H", f"X-Upload-Key: {upload_api_key}",
            "--data-binary", f"@{filepath}",
            f"{upload_api_url}/upload?key={object_key}",
        ],
        capture_output=True, timeout=130,
    )
    raw = result.stdout.decode().strip()
    if not raw:
        raise RuntimeError(result.stderr.decode(errors="replace")[:300])
    payload = json.loads(raw)
    url = payload.get("url")
    if url:
        return url
    raise RuntimeError(raw[:300])


FILES = [
    ("assets/video/demo.mp4",   "vidclaw/demo.mp4"),
    ("assets/img/qr_code.jpg",  "vidclaw/wechat-qr.jpg"),
]

results = {}
for local, key in FILES:
    path = os.path.join(script_dir, local)
    if not os.path.exists(path):
        print(f"⚠️  文件不存在，跳过: {local}")
        continue
    size = os.path.getsize(path) / 1024 / 1024
    print(f"上传 {local} ({size:.1f} MB) → gateway:{key} ...", end=" ", flush=True)
    try:
        url = upload(path, key)
        results[local] = url
        print(f"✓\n  URL: {url}")
    except Exception as e:
        print(f"✗\n  错误: {e}")

if results:
    print("\n" + "="*60)
    print("上传完成，以下 URL 已可用：")
    for local, url in results.items():
        print(f"  {local}\n    → {url}")
    print("="*60)
