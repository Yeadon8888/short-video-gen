#!/usr/bin/env python3
"""
短视频自动生成 - Gemini (视频理解) + Sora-2-all (视频生成)
通过 yunwu.ai API 代理调用
"""

import sys
# 非 TTY 环境（OpenClaw/subprocess）下 stdout 默认全量缓冲，强制切换为行缓冲
# 确保每行 print 立即出现在 Telegram / dashboard，而不是等进程退出才 flush
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

import argparse
import base64
import contextlib
import datetime
import hashlib
import hmac
import json
import mimetypes
import subprocess
import os
import random
import re
import ssl
import tempfile
import time
import urllib.error
import urllib.request

BASE_URL = "https://yunwu.ai"
GEMINI_MODEL = "gemini-3-pro-preview"
SORA_MODEL_WITH_IMAGES = "sora-2-all"   # 图片参考 → 视频
SORA_MODEL_TEXT_ONLY = "sora-2-all"    # 纯文本 → 视频（images 传 []）
TIKHUB_BASE_URL = "https://api.tikhub.io"
TIKHUB_HYBRID_PATH = "/api/v1/hybrid/video_data"

MAX_VIDEO_SIZE_MB = 50  # Gemini inline_data 建议上限
PROMPTS_PATH = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prompts.md")
)


# ──────────────────────────────────────────────────────────────────────────────
# 阶段日志（标准化 6 阶段：PRECHECK / FETCH_SOURCE / ANALYZE / GENERATE / POLL / FINALIZE）
# ──────────────────────────────────────────────────────────────────────────────

@contextlib.contextmanager
def _stage(name: str):
    """打印阶段开始 / 结束 / 耗时 / 结果，便于 agent 判断进度"""
    t0 = time.time()
    print(f"\n[{name}] start", flush=True)
    info = {"result": "OK"}
    try:
        yield info
    except SystemExit as e:
        dur = time.time() - t0
        print(f"[{name}] end ({dur:.1f}s) → FAILED (exit {e.code})", flush=True)
        raise
    except Exception as e:
        dur = time.time() - t0
        print(f"[{name}] end ({dur:.1f}s) → ERROR: {e}", flush=True)
        raise
    else:
        dur = time.time() - t0
        print(f"[{name}] end ({dur:.1f}s) → {info['result']}", flush=True)


def _sleep_with_heartbeat(total_seconds: int, elapsed_total: int, interval: int = 10):
    """逐秒 sleep，每 interval 秒打一次心跳，避免终端长时间无输出被误判为卡死"""
    for i in range(total_seconds):
        time.sleep(1)
        so_far = elapsed_total + i + 1
        if (i + 1) % interval == 0 or (i + 1) == total_seconds:
            print(f"  [POLL] heartbeat — {so_far}s elapsed, still waiting...", flush=True)


# ──────────────────────────────────────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────────────────────────────────────

def load_prompts() -> dict:
    """从 prompts.md 加载提示词模板，返回 {KEY: 模板字符串} 字典"""
    if not os.path.exists(PROMPTS_PATH):
        return {}
    with open(PROMPTS_PATH, encoding="utf-8") as f:
        content = f.read()
    prompts: dict = {}
    current_key: str | None = None
    current_lines: list = []
    for line in content.splitlines():
        if line.startswith("## "):
            if current_key is not None:
                prompts[current_key] = "\n".join(current_lines).strip()
            current_key = line[3:].strip()
            current_lines = []
        elif current_key is not None:
            current_lines.append(line)
    if current_key is not None:
        prompts[current_key] = "\n".join(current_lines).strip()
    return prompts


def _render(template: str, **kwargs) -> str:
    """将模板中的 {{KEY}} 替换为对应值"""
    for k, v in kwargs.items():
        template = template.replace("{{" + k + "}}", v)
    return template


def extract_video_url(text: str) -> str:
    """从混合文本中提取抖音/TikTok 视频链接"""
    # 匹配 http(s):// 开头的完整 URL，到空格/换行/中文字符结束
    pattern = r'https?://[^\s\u4e00-\u9fff，。！？、]+'
    matches = re.findall(pattern, text)
    # 优先匹配抖音/TikTok 域名
    preferred = [
        m.rstrip('.,，。）)】』"\'')
        for m in matches
        if any(d in m for d in ('douyin.com', 'tiktok.com', 'v.douyin', 'vm.tiktok'))
    ]
    if preferred:
        return preferred[0]
    # 兜底：返回第一个 URL
    if matches:
        return matches[0].rstrip('.,，。）)】』"\'')
    return text.strip()


def _tikhub_get(path_with_params: str, tikhub_api_key: str, retries: int = 3) -> dict:
    """通用 TikHub GET 请求，返回解析后的 JSON（自动重试 SSL 瞬断）"""
    api_url = f"{TIKHUB_BASE_URL}{path_with_params}"
    cmd = [
        "curl", "-s", "--max-time", "30",
        "-H", f"Authorization: Bearer {tikhub_api_key}",
        "-H", "Accept: application/json",
        "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        api_url,
    ]
    last_err = None
    for attempt in range(1, retries + 1):
        curl_result = subprocess.run(cmd, capture_output=True, timeout=35)
        raw = curl_result.stdout.decode("utf-8").strip()
        # exit=35 = SSL_ERROR_SYSCALL (proxy 瞬断)，重试
        if not raw and curl_result.returncode == 35 and attempt < retries:
            time.sleep(2)
            continue
        if not raw:
            stderr = curl_result.stderr.decode("utf-8", errors="replace").strip()
            last_err = RuntimeError(
                f"TikHub 返回空响应（curl exit={curl_result.returncode}）\n"
                f"  可能原因：TIKHUB_API_KEY 无效、网络不通、或链接已失效\n"
                f"  curl stderr: {stderr or '(无)'}"
            )
            if attempt < retries:
                time.sleep(2)
                continue
            raise last_err
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            raise RuntimeError(f"TikHub 返回非 JSON（可能 Key 无效）:\n  {raw[:200]}")


def _resolve_short_url(url: str) -> str:
    """将 tiktok.com/t/ 等短链展开为完整 URL"""
    if "/t/" not in url:
        return url
    result = subprocess.run(
        [
            "curl", "-sk", "--noproxy", "*", "-o", "/dev/null", "-w", "%{url_effective}",
            "-L", "--max-time", "10",
            "-H", "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            url,
        ],
        capture_output=True,
        timeout=15,
    )
    resolved = result.stdout.decode("utf-8").strip()
    if resolved and resolved != url:
        print(f"  🔀 短链展开: {resolved}")
        return resolved
    return url


def _extract_video_url_from_tikhub_data(video_data: dict) -> str:
    """从 TikHub video_data 或 aweme_detail 中提取无水印视频 URL"""
    # hybrid 接口格式
    nwm_hq = video_data.get("nwm_video_url_HQ")
    if isinstance(nwm_hq, dict):
        return (nwm_hq.get("url_list") or [None])[0]
    if isinstance(nwm_hq, str) and nwm_hq.startswith("http"):
        return nwm_hq
    nwm = video_data.get("nwm_video_url")
    if isinstance(nwm, dict):
        return (nwm.get("url_list") or [None])[0]
    if isinstance(nwm, str) and nwm.startswith("http"):
        return nwm

    # TikTok app v3 接口格式（aweme_detail.video.play_addr）
    video = video_data.get("video", {})
    play_addr = video.get("play_addr", {})
    urls = play_addr.get("url_list", [])
    if urls:
        return urls[0]
    download_addr = video.get("download_addr", {})
    urls = download_addr.get("url_list", [])
    if urls:
        return urls[0]

    return None


def download_video_from_url(share_url: str, tikhub_api_key: str) -> str:
    """解析抖音/TikTok 链接，下载无水印视频到临时文件，返回本地路径"""
    print(f"🔗 解析视频链接: {share_url}")

    # Step0: 展开短链（tiktok.com/t/xxx → 完整 URL）
    share_url = _resolve_short_url(share_url)

    # Step1a: 尝试 hybrid 接口（抖音和标准 TikTok 链接）
    video_url = None
    encoded_url = urllib.request.quote(share_url, safe="")
    try:
        result = _tikhub_get(f"{TIKHUB_HYBRID_PATH}?url={encoded_url}&minimal=true", tikhub_api_key)
        actual_code = result.get("code") or (result.get("detail") or {}).get("code")
        if actual_code == 200:
            video_data = result.get("data", {}).get("video_data", {})
            video_url = _extract_video_url_from_tikhub_data(video_data)
        else:
            print(f"  ⚠️  hybrid 接口返回 {actual_code}，尝试备用接口...", file=sys.stderr)
    except Exception as e:
        print(f"  ⚠️  hybrid 接口失败: {e}，尝试备用接口...", file=sys.stderr)

    # Step1b: hybrid 失败时，提取 video ID 走 TikTok app v3 接口
    if not video_url:
        m = re.search(r'/video/(\d+)', share_url)
        if m:
            aweme_id = m.group(1)
            print(f"  🔄 使用 TikTok 备用接口（aweme_id={aweme_id}）...")
            try:
                result = _tikhub_get(f"/api/v1/tiktok/app/v3/fetch_one_video?aweme_id={aweme_id}", tikhub_api_key)
                if result.get("code") == 200:
                    aweme_detail = result.get("data", {}).get("aweme_detail", {})
                    video_url = _extract_video_url_from_tikhub_data(aweme_detail)
                else:
                    print(f"❌ TikTok 备用接口返回错误: {result.get('message', result)}", file=sys.stderr)
                    sys.exit(1)
            except Exception as e:
                print(f"❌ TikHub 解析失败: {e}", file=sys.stderr)
                sys.exit(1)
        else:
            # Step1c: 无法从 URL 提取 video ID（如 tiktok.com/t/ 短链）→ 用 share_url 接口
            encoded_share = urllib.request.quote(share_url, safe="")
            print(f"  🔄 使用 TikTok share_url 接口...")
            try:
                result = _tikhub_get(f"/api/v1/tiktok/app/v3/fetch_one_video_by_share_url?share_url={encoded_share}", tikhub_api_key)
                if result.get("code") == 200:
                    aweme_detail = result.get("data", {}).get("aweme_detail", {})
                    video_url = _extract_video_url_from_tikhub_data(aweme_detail)
                else:
                    print(f"❌ TikTok share_url 接口返回错误: {result.get('message', result)}", file=sys.stderr)
                    sys.exit(1)
            except Exception as e:
                print(f"❌ TikHub 解析失败: {e}", file=sys.stderr)
                sys.exit(1)

    if not video_url:
        print(f"❌ 无法从 TikHub 响应中提取视频 URL", file=sys.stderr)
        sys.exit(1)

    print(f"  ✅ 解析成功，开始下载...")

    # Step2: 下载视频到临时文件（用 curl 绕过 Python SSL 兼容性问题）
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_path = tmp.name
    tmp.close()

    try:
        result = subprocess.run(
            [
                "curl", "-L", "-s", "--max-time", "120",
                "-H", "User-Agent: Mozilla/5.0",
                "-o", tmp_path,
                video_url,
            ],
            capture_output=True,
            timeout=130,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))
        size_mb = os.path.getsize(tmp_path) / (1024 * 1024)
        if size_mb < 0.1:
            raise RuntimeError(f"下载文件过小 ({size_mb:.2f} MB)，可能下载失败")
        print(f"  ✅ 下载完成 ({size_mb:.1f} MB) → {tmp_path}")
        return tmp_path
    except Exception as e:
        os.unlink(tmp_path)
        print(f"❌ 视频下载失败: {e}", file=sys.stderr)
        sys.exit(1)


def load_env():
    """从当前目录或 home 目录的 .env 文件加载环境变量"""
    search_paths = [
        os.path.join(os.getcwd(), ".env"),
        os.path.expanduser("~/.env"),
    ]
    for path in search_paths:
        if os.path.exists(path):
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            return


def api_request(method, path, api_key, data=None, params=None):
    """统一 API 请求封装（用 curl 绕过 Python 3.14 SSL 兼容性问题）"""
    url = BASE_URL + path
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())

    for attempt in range(3):
        cmd = [
            "curl", "-s", "-L", "--max-time", "300",
            "--noproxy", "*",   # 绕过系统代理，避免代理 TLS 握手失败
            "-X", method,
            "-H", f"Authorization: Bearer {api_key}",
            "-H", "Content-Type: application/json",
            "-H", "Accept: application/json",
        ]

        # 写 body 到临时文件，避免命令行参数过长（base64 视频 payload 可达数 MB）
        tmp_body = None
        if data is not None:
            tmp_body = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
            json.dump(data, tmp_body)
            tmp_body.close()
            cmd += ["--data-binary", f"@{tmp_body.name}"]
        cmd.append(url)

        try:
            result = subprocess.run(cmd, capture_output=True, timeout=310)
            raw = result.stdout.decode("utf-8")
            if not raw.strip():
                raise RuntimeError(f"curl 返回空响应，stderr: {result.stderr.decode('utf-8', errors='replace')}")
            resp_data = json.loads(raw)

            # 检查 HTTP 错误（curl -s 不会抛出 HTTPError，需手动检查）
            if isinstance(resp_data, dict) and resp_data.get("code") == 500:
                err_body = str(resp_data)
                if "负载已饱和" in err_body:
                    if attempt < 2:
                        print(f"  ⚠️  上游负载饱和，60 秒后重试（{attempt + 1}/3）...", file=sys.stderr)
                        time.sleep(60)
                        continue
                    else:
                        print(f"❌ 上游服务负载饱和，请稍后再试。{err_body}", file=sys.stderr)
                        sys.exit(1)

            return resp_data
        except (subprocess.TimeoutExpired, OSError, ValueError) as e:
            if attempt < 2:
                print(f"  ⚠️  请求超时/失败，5 秒后重试（{attempt + 1}/3）...", file=sys.stderr)
                time.sleep(5)
            else:
                print(f"❌ 请求失败（已重试 3 次）: {e}", file=sys.stderr)
                sys.exit(1)
        finally:
            if tmp_body:
                try:
                    os.unlink(tmp_body.name)
                except OSError:
                    pass


def _hmac_sha256(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _s3_signing_key(secret_key: str, date_stamp: str, region: str, service: str) -> bytes:
    k = _hmac_sha256(("AWS4" + secret_key).encode("utf-8"), date_stamp)
    k = _hmac_sha256(k, region)
    k = _hmac_sha256(k, service)
    return _hmac_sha256(k, "aws4_request")


def _file_md5(filepath: str) -> str:
    h = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_cache(images_dir: str) -> dict:
    cache_path = os.path.join(images_dir, "image_cache.json")
    if os.path.exists(cache_path):
        try:
            with open(cache_path) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_cache(images_dir: str, cache: dict):
    cache_path = os.path.join(images_dir, "image_cache.json")
    with open(cache_path, "w") as f:
        json.dump(cache, f, indent=2)


def upload_image(filepath: str, images_dir: str = None) -> str | None:
    """上传本地图片到 Cloudflare R2，有缓存则直接返回已有 URL"""
    # 检查缓存
    cache = _load_cache(images_dir) if images_dir else {}
    md5 = _file_md5(filepath)
    if md5 in cache:
        print(f"  命中缓存，跳过上传", end=" ", flush=True)
        return cache[md5]

    account_id = os.environ.get("R2_ACCOUNT_ID", "")
    bucket = os.environ.get("R2_BUCKET", "")
    access_key = os.environ.get("S3_ID", "")
    secret_key = os.environ.get("S3_token", "")
    public_domain = os.environ.get("R2_PUBLIC_DOMAIN", "")

    if not all([account_id, bucket, access_key, secret_key, public_domain]):
        print("  ⚠️  R2 配置不完整，跳过图片上传", file=sys.stderr)
        return None

    with open(filepath, "rb") as f:
        file_data = f.read()

    # 用 MD5 作为文件名前缀，保证同一文件 R2 上只有一份
    filename = f"{md5[:8]}_{os.path.basename(filepath)}"
    mime = mimetypes.guess_type(filepath)[0] or "image/jpeg"
    payload_hash = hashlib.sha256(file_data).hexdigest()

    now = datetime.datetime.now(datetime.timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")

    host = f"{account_id}.r2.cloudflarestorage.com"
    uri = f"/{bucket}/{filename}"
    region = "auto"
    service = "s3"

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

    credential_scope = f"{date_stamp}/{region}/{service}/aws4_request"
    string_to_sign = "\n".join([
        "AWS4-HMAC-SHA256", amz_date, credential_scope,
        hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
    ])

    signing_key = _s3_signing_key(secret_key, date_stamp, region, service)
    signature = hmac.new(signing_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    auth = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    try:
        result = subprocess.run(
            [
                "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                "--noproxy", "*", "--max-time", "60",
                "-X", "PUT",
                "-H", f"Content-Type: {mime}",
                "-H", f"Host: {host}",
                "-H", f"x-amz-content-sha256: {payload_hash}",
                "-H", f"x-amz-date: {amz_date}",
                "-H", f"Authorization: {auth}",
                "--data-binary", f"@{filepath}",
                f"https://{host}{uri}",
            ],
            capture_output=True,
            timeout=70,
        )
        http_code = result.stdout.decode("utf-8").strip()
        if http_code in ("200", "204"):
            url = f"https://{public_domain}/{filename}"
            if images_dir:
                cache[md5] = url
                _save_cache(images_dir, cache)
            return url
        raise Exception(f"HTTP {http_code}, stderr: {result.stderr.decode('utf-8', errors='replace')}")
    except Exception as e:
        print(f"  ⚠️  R2 上传失败 ({os.path.basename(filepath)}): {e}", file=sys.stderr)
        return None


# ──────────────────────────────────────────────────────────────────────────────
# 核心功能
# ──────────────────────────────────────────────────────────────────────────────

def get_image_urls(images_dir, random_pick=False):
    """读取文件夹图片，上传（或命中缓存）后返回单个 URL 的列表"""
    if not images_dir:
        return []
    if not os.path.isdir(images_dir):
        print(f"⚠️  图片文件夹不存在: {images_dir}，跳过图片", file=sys.stderr)
        return []

    exts = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"}
    all_imgs = sorted([
        os.path.join(images_dir, f)
        for f in os.listdir(images_dir)
        if os.path.splitext(f.lower())[1] in exts
    ])

    n = len(all_imgs)
    if n == 0:
        print("⚠️  图片文件夹为空，不使用产品图片", file=sys.stderr)
        return []

    # 先把所有图片都确保上传到 R2（写入缓存）
    cache = _load_cache(images_dir)
    for img_path in all_imgs:
        md5 = _file_md5(img_path)
        if md5 not in cache:
            print(f"  新图片，上传 {os.path.basename(img_path)} ...", end=" ", flush=True)
            url = upload_image(img_path, images_dir)
            if url:
                print(f"✅ {url}")
            else:
                print("❌ 上传失败")
    # 重新加载缓存（包含刚上传的）
    cache = _load_cache(images_dir)

    # 从缓存中构建有序 URL 列表（按文件名排序）
    all_urls = []
    for img_path in all_imgs:
        md5 = _file_md5(img_path)
        if md5 in cache:
            all_urls.append(cache[md5])

    if not all_urls:
        return []

    if random_pick:
        selected_url = random.choice(all_urls)
        print(f"📸 随机选择图片: {selected_url}")
    else:
        selected_url = all_urls[0]
        print(f"📸 使用第一张图片（共 {n} 张，可用 --random-image 随机选择）")

    return [selected_url]


def analyze_video_with_gemini(video_path, api_key, modification_prompt=None, prompts=None):
    """用 Gemini 理解视频，输出可用于 Sora 的英文脚本"""
    file_size_mb = os.path.getsize(video_path) / (1024 * 1024)
    if file_size_mb > MAX_VIDEO_SIZE_MB:
        print(
            f"⚠️  视频文件较大（{file_size_mb:.1f} MB），超过 {MAX_VIDEO_SIZE_MB} MB 可能导致 API 超时",
            file=sys.stderr,
        )

    print(f"🎬 Gemini 分析视频: {os.path.basename(video_path)} ({file_size_mb:.1f} MB)")

    with open(video_path, "rb") as f:
        video_b64 = base64.b64encode(f.read()).decode("utf-8")

    mime = mimetypes.guess_type(video_path)[0] or "video/mp4"

    prompts = prompts or {}
    if modification_prompt:
        template = prompts.get("VIDEO_REMIX_WITH_MODIFICATION", "")
        if template:
            instruction = _render(template, MODIFICATION_PROMPT=modification_prompt)
        else:
            instruction = (
                f"Please carefully analyze this video, then based on this modification request:\n"
                f"{modification_prompt}\n\n"
                "Generate a detailed English prompt for AI video generation (Sora). Requirements:\n"
                "1. Describe the video's style, scene, key actions, atmosphere, lighting, and color tone\n"
                "2. Incorporate the modification request naturally\n"
                "3. Output ONLY the English prompt — no explanations, no markdown, no extra text"
            )
    else:
        template = prompts.get("VIDEO_REMIX_BASE", "")
        if template:
            instruction = template
        else:
            instruction = (
                "Please carefully analyze this video and understand its core content, style, scenes, and atmosphere.\n\n"
                "Generate a detailed English prompt for AI video generation (Sora). Requirements:\n"
                "1. Describe the visual style, scene, main subjects, their actions, lighting, and color tone\n"
                "2. Preserve the core creative concept and aesthetic of the original video\n"
                "3. Output ONLY the English prompt — no explanations, no markdown, no extra text"
            )

    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"inline_data": {"mime_type": mime, "data": video_b64}},
                {"text": instruction},
            ],
        }]
    }

    result = api_request(
        "POST",
        f"/v1beta/models/{GEMINI_MODEL}:generateContent",
        api_key,
        data=payload,
    )

    try:
        # gemini-3-pro-preview 是思考模型，parts[0] 是 reasoning，最后一个非 thought part 才是答案
        parts = result["candidates"][0]["content"]["parts"]
        answer_parts = [p for p in parts if not p.get("thought", False)]
        script = answer_parts[-1]["text"].strip()
    except (KeyError, IndexError) as e:
        print(f"❌ 解析 Gemini 响应失败: {e}\n原始响应: {result}", file=sys.stderr)
        sys.exit(1)

    print(f"\n✅ Gemini 生成脚本:\n{'─'*60}\n{script}\n{'─'*60}\n")
    return script


def expand_theme_with_gemini(theme, api_key, prompts=None):
    """用 Gemini 将主题/描述扩展为详细的 Sora 提示词（生产模式）"""
    prompts = prompts or {}
    template = prompts.get("THEME_TO_VIDEO", "")
    if template:
        instruction = _render(template, THEME=theme)
    else:
        instruction = (
            "You are an expert at writing Sora video generation prompts.\n\n"
            f"Based on the following theme or description, generate a detailed English prompt "
            f"suitable for Sora AI video generation:\n{theme}\n\n"
            "Requirements:\n"
            "1. Expand into vivid visual details: scene, subjects, actions, camera movement, lighting, color tone, atmosphere\n"
            "2. Keep it cinematic and engaging\n"
            "3. Output ONLY the English prompt — no explanations, no markdown, no extra text"
        )

    print(f"🧠 Gemini 扩展主题: {theme[:60]}...")
    payload = {
        "contents": [{"role": "user", "parts": [{"text": instruction}]}]
    }
    result = api_request(
        "POST", f"/v1beta/models/{GEMINI_MODEL}:generateContent", api_key, data=payload
    )
    try:
        parts = result["candidates"][0]["content"]["parts"]
        answer_parts = [p for p in parts if not p.get("thought", False)]
        script = answer_parts[-1]["text"].strip()
    except (KeyError, IndexError) as e:
        print(f"❌ 解析 Gemini 响应失败: {e}\n原始响应: {result}", file=sys.stderr)
        sys.exit(1)

    print(f"\n✅ Gemini 扩展后的提示词:\n{'─'*60}\n{script}\n{'─'*60}\n")
    return script


def generate_copy(sora_prompt, api_key, prompts=None):
    """根据 Sora 提示词生成视频标题和文案"""
    prompts = prompts or {}
    template = prompts.get("COPY_GENERATION", "")
    if template:
        instruction = _render(template, SORA_PROMPT=sora_prompt)
    else:
        instruction = (
            "根据以下视频生成提示词，为短视频平台（抖音/小红书/快手）生成配套的中文文案：\n\n"
            f"视频提示词：\n{sora_prompt}\n\n"
            "要求：\n"
            "1. 标题（title）：吸引眼球、简洁有力，不超过 20 字\n"
            "2. 文案（caption）：适合社交平台的推广文案，带情绪感染力，50–100 字，可包含话题标签 #\n"
            '3. 仅输出 JSON，不要任何额外说明，格式：{"title": "...", "caption": "..."}'
        )

    print("📝 Gemini 生成视频文案...")
    payload = {
        "contents": [{"role": "user", "parts": [{"text": instruction}]}]
    }
    result = api_request(
        "POST", f"/v1beta/models/{GEMINI_MODEL}:generateContent", api_key, data=payload
    )
    raw = ""
    try:
        parts = result["candidates"][0]["content"]["parts"]
        answer_parts = [p for p in parts if not p.get("thought", False)]
        raw = answer_parts[-1]["text"].strip()
        if "```" in raw:
            raw = raw.split("```")[1].lstrip("json").strip()
        copy_data = json.loads(raw)
    except Exception as e:
        print(f"⚠️  解析文案 JSON 失败: {e}，原始输出: {raw or result}", file=sys.stderr)
        return None
    return copy_data


def create_video_tasks(api_key, prompt, image_urls, orientation, duration, count):
    """创建 Sora 视频生成任务，返回 task_id 列表"""
    # 有图片用 sora-2-all（image→video），无图片用 sora-2（text→video）
    model = SORA_MODEL_WITH_IMAGES if image_urls else SORA_MODEL_TEXT_ONLY
    task_ids = []
    for i in range(count):
        print(f"🎥 创建视频任务 {i + 1}/{count}（模型: {model}）...")
        payload = {
            "images": image_urls,   # 有图片传 URL 列表，无图片传 []
            "model": model,
            "orientation": orientation,
            "prompt": prompt,
            "size": "large",
            "duration": duration,
            "watermark": False,
            "private": False,
        }
        # 重试：上游负载饱和时最多等 3 次
        for attempt in range(1, 4):
            result = api_request("POST", "/v1/video/create", api_key, data=payload)
            task_id = result.get("id")
            error_msg = result.get("error", "")
            if task_id:
                break
            if "负载已饱和" in str(error_msg) and attempt < 3:
                print(f"  ⚠️  上游负载饱和，60 秒后重试（{attempt + 1}/3）...", file=sys.stderr)
                time.sleep(60)
                continue
            print(f"❌ 创建任务失败，API 响应: {result}", file=sys.stderr)
            sys.exit(1)
        status = result.get("status", "unknown")
        task_ids.append(task_id)
        print(f"  ✅ 任务已提交: {task_id}（当前状态: {status}）")

    return task_ids


def poll_tasks(api_key, task_ids, poll_interval=30, max_wait=1800):
    """轮询任务状态，直到全部完成或失败，最多等待 max_wait 秒（默认 30 分钟）"""
    terminal_statuses = {"succeeded", "completed", "success", "failed", "error", "cancelled"}
    results = {}
    pending = set(task_ids)
    elapsed = 0

    print(f"  tasks={[t[:16] + '…' for t in task_ids]}", flush=True)
    print(f"  每 {poll_interval}s 轮询一次，最多等 {max_wait // 60}min", flush=True)

    while pending:
        _sleep_with_heartbeat(poll_interval, elapsed)
        elapsed += poll_interval
        if elapsed > max_wait:
            for task_id in pending:
                print(f"  ⏰ 任务 {task_id[:30]}... 等待超时，标记为失败", flush=True)
                results[task_id] = {"success": False, "url": None, "status": "timeout"}
            break
        for task_id in list(pending):
            result = api_request(
                "GET",
                "/v1/video/query",
                api_key,
                params={"id": task_id},
            )
            status = result.get("status", "unknown")
            print(f"  [POLL] {task_id[:24]}… status={status} elapsed={elapsed}s", flush=True)

            if status in terminal_statuses:
                video_url = result.get("video_url")
                enhanced = result.get("enhanced_prompt", "")
                success = status not in {"failed", "error", "cancelled"}
                results[task_id] = {
                    "success": success,
                    "url": video_url,
                    "enhanced_prompt": enhanced,
                    "status": status,
                }
                pending.remove(task_id)
                if success:
                    print(f"  ✅ 完成！视频 URL: {video_url}", flush=True)
                else:
                    print(f"  ❌ 任务失败（状态: {status}）", flush=True)

    return results


# ──────────────────────────────────────────────────────────────────────────────
# 入口
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="短视频自动生成：Gemini 理解 + Sora-2-all 生成",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 二创模式（视频 + 可选修改意见 + 可选产品图）
  python3 generate.py --video demo.mp4
  python3 generate.py --video demo.mp4 --prompt "更明亮的色调，加快节奏"
  python3 generate.py --video demo.mp4 --images ./product_imgs

  # 生产模式（直接提示词 + 可选产品图）
  python3 generate.py --prompt "A sleek product showcase with cinematic lighting"
  python3 generate.py --prompt "Urban street style video" --images ./imgs --orientation landscape
        """,
    )
    parser.add_argument("--video", metavar="PATH", help="本地视频文件（二创模式）")
    parser.add_argument("--url", metavar="URL", help="抖音/TikTok 分享链接（自动下载后进入二创模式）")
    parser.add_argument("--prompt", metavar="TEXT", help="提示词（生产模式必填；二创模式为修改意见）")
    _default_images = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "image")
    parser.add_argument(
        "--images",
        metavar="FOLDER",
        default=_default_images,
        help="产品图片文件夹，默认使用 skill 目录下的 image/；传 0 表示不使用产品图",
    )
    parser.add_argument(
        "--orientation",
        default="portrait",
        choices=["portrait", "landscape"],
        help="视频方向，默认 portrait（竖屏）",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=15,
        choices=[10, 15],
        help="视频时长（秒），默认 15",
    )
    parser.add_argument("--count", type=int, default=1, help="生成数量，默认 1，最多 10")
    parser.add_argument("--random-image", action="store_true", help="从图片文件夹随机选一张，默认用第一张")

    args = parser.parse_args()

    # --images 0 表示明确禁用产品图
    if args.images == "0":
        args.images = None

    # ── PRECHECK ─────────────────────────────────────────────────────────────
    with _stage("PRECHECK") as s:
        if not args.video and not args.url and not args.prompt:
            parser.error("必须提供 --video / --url（二创模式）或 --prompt（生产模式），至少其中之一")
        if args.count < 1 or args.count > 10:
            parser.error("--count 范围为 1–10")

        load_env()
        api_key = os.environ.get("YUNWU_API_KEY")
        if not api_key:
            print(
                "❌ 未找到 YUNWU_API_KEY\n"
                "请在 .env 文件添加：\n"
                "  YUNWU_API_KEY=your_sora_key_here",
                file=sys.stderr,
            )
            sys.exit(1)
        # YUNWU_GEMINI_API_KEY 用于 Gemini 调用，若未设置则回退到 YUNWU_API_KEY
        gemini_api_key = os.environ.get("YUNWU_GEMINI_API_KEY") or api_key
        tikhub_api_key = os.environ.get("TIKHUB_API_KEY") or os.environ.get("tikhub_api_key")

        mode = "二创（视频→Gemini→Sora）" if (args.video or args.url) else "生产（主题→Gemini→Sora）"
        print(f"\n{'='*60}")
        print("🚀 短视频自动生成")
        print(f"{'='*60}")
        print(f"  模式:     {mode}")
        print(f"  方向:     {args.orientation}")
        print(f"  时长:     {args.duration}s")
        print(f"  数量:     {args.count}")
        if args.url:
            print(f"  链接:     {args.url}")
        if args.video:
            print(f"  视频:     {args.video}")
        if args.prompt:
            label = "修改意见" if (args.video or args.url) else "提示词"
            print(f"  {label}:  {args.prompt}")
        if args.images:
            print(f"  图片:     {args.images}")
        print(f"{'='*60}")

        prompts = load_prompts()
        s["result"] = f"mode={mode}, count={args.count}"

    # ── FETCH_SOURCE ──────────────────────────────────────────────────────────
    tmp_video_path = None
    with _stage("FETCH_SOURCE") as s:
        if args.url:
            if not tikhub_api_key:
                print("❌ 未找到 TIKHUB_API_KEY，请在 .env 添加：\n  TIKHUB_API_KEY=your_key", file=sys.stderr)
                sys.exit(1)
            clean_url = extract_video_url(args.url)
            print(f"  提取链接: {clean_url}")
            tmp_video_path = download_video_from_url(clean_url, tikhub_api_key)
            args.video = tmp_video_path
            size_mb = os.path.getsize(tmp_video_path) / (1024 * 1024)
            s["result"] = f"downloaded {size_mb:.1f}MB → {tmp_video_path}"
        elif args.video:
            if not os.path.isfile(args.video):
                print(f"❌ 视频文件不存在: {args.video}", file=sys.stderr)
                sys.exit(1)
            size_mb = os.path.getsize(args.video) / (1024 * 1024)
            s["result"] = f"local {os.path.basename(args.video)} ({size_mb:.1f}MB)"
        else:
            s["result"] = "production mode (no video)"

    # ── ANALYZE ───────────────────────────────────────────────────────────────
    with _stage("ANALYZE") as s:
        if args.video:
            script = analyze_video_with_gemini(args.video, gemini_api_key, args.prompt, prompts)
        else:
            script = expand_theme_with_gemini(args.prompt, gemini_api_key, prompts)

        copy_data = generate_copy(script, gemini_api_key, prompts)
        s["result"] = f"prompt={len(script)}chars, copy={'OK' if copy_data else 'failed'}"

    # ── GENERATE ──────────────────────────────────────────────────────────────
    with _stage("GENERATE") as s:
        image_urls = get_image_urls(args.images, random_pick=args.random_image)
        if image_urls:
            print(f"  最终图片 URLs: {image_urls}\n")
            # 将产品图注入到 prompt 末尾，确保 Sora 在视频中实际呈现产品
            script = script + " The product shown in the reference image must appear clearly and prominently in the video."

        task_ids = create_video_tasks(api_key, script, image_urls, args.orientation, args.duration, args.count)
        s["result"] = f"{len(task_ids)} tasks submitted"

    # ── POLL ──────────────────────────────────────────────────────────────────
    with _stage("POLL") as s:
        results = poll_tasks(api_key, task_ids)
        success_count = sum(1 for r in results.values() if r["success"])
        s["result"] = f"{success_count}/{len(results)} succeeded"

    # ── FINALIZE ──────────────────────────────────────────────────────────────
    with _stage("FINALIZE") as s:
        print(f"\n{'='*60}")
        print("📹 生成结果")
        print(f"{'='*60}")
        for task_id, res in results.items():
            if res["success"]:
                print(f"✅ {res['url']}")
                if res.get("enhanced_prompt"):
                    print(f"   优化后的 Prompt: {res['enhanced_prompt']}")
            else:
                print(f"❌ 任务 {task_id} 失败（状态: {res['status']}）")
        if copy_data:
            print(f"\n📋 视频文案")
            print(f"{'─'*60}")
            print(f"  标题：{copy_data.get('title', '')}")
            print(f"  文案：{copy_data.get('caption', '')}")
            if copy_data.get('first_comment'):
                print(f"  首评：{copy_data.get('first_comment', '')}")
        print(f"{'='*60}")
        print(f"完成: {success_count}/{len(results)} 个视频生成成功")

        # 清理临时下载的视频文件
        if tmp_video_path and os.path.exists(tmp_video_path):
            os.unlink(tmp_video_path)

        s["result"] = f"{success_count}/{len(results)} videos OK"

    if success_count < len(results):
        sys.exit(1)


if __name__ == "__main__":
    main()
