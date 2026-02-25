#!/usr/bin/env python3
"""
上传 demo.mp4 和 qr_code.jpg 到 Cloudflare R2，并打印公开 URL。
用法：cd website && python3 upload_assets.py
"""
import os, sys, hashlib, hmac, datetime, mimetypes, subprocess

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

# ── AWS Sig V4 helpers ──
def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

def _signing_key(secret: str, date: str) -> bytes:
    k = _hmac_sha256(("AWS4" + secret).encode(), date)
    k = _hmac_sha256(k, "auto")
    k = _hmac_sha256(k, "s3")
    return _hmac_sha256(k, "aws4_request")

# ── Upload ──
def upload(filepath: str, object_key: str) -> str:
    account_id   = os.environ["R2_ACCOUNT_ID"]
    bucket       = os.environ["R2_BUCKET"]
    access_key   = os.environ["S3_ID"]
    secret_key   = os.environ["S3_token"]
    public_domain = os.environ["R2_PUBLIC_DOMAIN"]

    with open(filepath, "rb") as f:
        data = f.read()

    mime = mimetypes.guess_type(filepath)[0] or "application/octet-stream"
    payload_hash = hashlib.sha256(data).hexdigest()
    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date   = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")

    host = f"{account_id}.r2.cloudflarestorage.com"
    uri  = f"/{bucket}/{object_key}"

    canonical_headers = (
        f"content-type:{mime}\n"
        f"host:{host}\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"
    canonical_request = "\n".join([
        "PUT", uri, "",
        canonical_headers, signed_headers, payload_hash,
    ])
    credential_scope = f"{date_stamp}/auto/s3/aws4_request"
    string_to_sign = "\n".join([
        "AWS4-HMAC-SHA256", amz_date, credential_scope,
        hashlib.sha256(canonical_request.encode()).hexdigest(),
    ])
    signing_key = _signing_key(secret_key, date_stamp)
    signature = hmac.new(signing_key, string_to_sign.encode(), hashlib.sha256).hexdigest()
    auth = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    result = subprocess.run(
        [
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            "--noproxy", "*", "--max-time", "120",
            "-X", "PUT",
            "-H", f"Content-Type: {mime}",
            "-H", f"Host: {host}",
            "-H", f"x-amz-content-sha256: {payload_hash}",
            "-H", f"x-amz-date: {amz_date}",
            "-H", f"Authorization: {auth}",
            "--data-binary", f"@{filepath}",
            f"https://{host}{uri}",
        ],
        capture_output=True, timeout=130,
    )
    code = result.stdout.decode().strip()
    if code in ("200", "204"):
        return f"https://{public_domain}/{object_key}"
    raise RuntimeError(f"HTTP {code} | {result.stderr.decode(errors='replace')[:300]}")


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
    print(f"上传 {local} ({size:.1f} MB) → r2:{key} ...", end=" ", flush=True)
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
