#!/usr/bin/env python3
"""
短视频自动生成 - Gemini (视频理解) + Sora-2-all (视频生成)
通过 yunwu.ai API 代理调用
"""

import argparse
import base64
import datetime
import hashlib
import hmac
import json
import mimetypes
import os
import random
import re
import sys
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


def download_video_from_url(share_url: str, tikhub_api_key: str) -> str:
    """通过 TikHub hybrid 接口解析抖音/TikTok 分享链接，下载无水印视频到临时文件，返回本地路径"""
    print(f"🔗 解析视频链接: {share_url}")

    # Step1: 调 TikHub 解析真实视频 URL
    encoded_url = urllib.request.quote(share_url, safe="")
    api_url = f"{TIKHUB_BASE_URL}{TIKHUB_HYBRID_PATH}?url={encoded_url}&minimal=true"
    req = urllib.request.Request(
        api_url,
        headers={"Authorization": f"Bearer {tikhub_api_key}", "Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"❌ TikHub 解析失败: {e}", file=sys.stderr)
        sys.exit(1)

    if result.get("code") != 200:
        print(f"❌ TikHub 返回错误: {result}", file=sys.stderr)
        sys.exit(1)

    data = result.get("data", {})
    video_data = data.get("video_data", {})

    # 优先取无水印高质量版本，兼容抖音（字符串）和 TikTok（对象含 url_list）
    nwm_hq = video_data.get("nwm_video_url_HQ")
    if isinstance(nwm_hq, dict):
        video_url = (nwm_hq.get("url_list") or [None])[0]
    elif isinstance(nwm_hq, str) and nwm_hq.startswith("http"):
        video_url = nwm_hq
    else:
        # fallback: nwm_video_url
        nwm = video_data.get("nwm_video_url")
        if isinstance(nwm, dict):
            video_url = (nwm.get("url_list") or [None])[0]
        elif isinstance(nwm, str) and nwm.startswith("http"):
            video_url = nwm
        else:
            print(f"❌ 无法从 TikHub 响应中提取视频 URL，video_data={video_data}", file=sys.stderr)
            sys.exit(1)

    print(f"  ✅ 解析成功，开始下载...")

    # Step2: 下载视频到临时文件
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_path = tmp.name
    tmp.close()

    try:
        dl_req = urllib.request.Request(
            video_url,
            headers={"User-Agent": "Mozilla/5.0"},
            method="GET",
        )
        with urllib.request.urlopen(dl_req, timeout=120) as resp, open(tmp_path, "wb") as f:
            total = 0
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                f.write(chunk)
                total += len(chunk)
        size_mb = total / (1024 * 1024)
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
    """统一 API 请求封装"""
    url = BASE_URL + path
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method=method,
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            if e.code == 500 and "负载已饱和" in err_body:
                if attempt < 2:
                    print(f"  ⚠️  上游负载饱和，60 秒后重试（{attempt + 1}/3）...", file=sys.stderr)
                    time.sleep(60)
                    req = urllib.request.Request(
                        req.full_url, data=req.data, headers=dict(req.headers), method=req.get_method()
                    )
                else:
                    print(f"❌ 上游服务负载饱和，请稍后再试。{err_body}", file=sys.stderr)
                    sys.exit(1)
            else:
                print(f"❌ API 错误 {e.code}: {err_body}", file=sys.stderr)
                sys.exit(1)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            if attempt < 2:
                print(f"  ⚠️  请求超时/失败，5 秒后重试（{attempt + 1}/3）...", file=sys.stderr)
                time.sleep(5)
                # 重建 Request 对象（urllib 不能复用）
                req = urllib.request.Request(
                    req.full_url, data=req.data, headers=dict(req.headers), method=req.get_method()
                )
            else:
                print(f"❌ 请求失败（已重试 3 次）: {e}", file=sys.stderr)
                sys.exit(1)


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

    req = urllib.request.Request(
        f"https://{host}{uri}",
        data=file_data,
        headers={
            "Content-Type": mime,
            "Host": host,
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
            "Authorization": auth,
        },
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resp.status in (200, 204):
                url = f"https://{public_domain}/{filename}"
                # 写入缓存
                if images_dir:
                    cache[md5] = url
                    _save_cache(images_dir, cache)
                return url
            raise Exception(f"HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  ⚠️  R2 上传失败 ({os.path.basename(filepath)}): {e.code} {body}", file=sys.stderr)
        return None
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
        result = api_request("POST", "/v1/video/create", api_key, data=payload)
        task_id = result["id"]
        status = result.get("status", "unknown")
        task_ids.append(task_id)
        print(f"  ✅ 任务已提交: {task_id}（当前状态: {status}）")

    return task_ids


def poll_tasks(api_key, task_ids, poll_interval=30):
    """轮询任务状态，直到全部完成或失败"""
    terminal_statuses = {"succeeded", "completed", "success", "failed", "error", "cancelled"}
    results = {}
    pending = set(task_ids)

    print(f"\n⏳ 等待视频生成（每 {poll_interval} 秒轮询一次）...")

    while pending:
        time.sleep(poll_interval)
        for task_id in list(pending):
            result = api_request(
                "GET",
                "/v1/video/query",
                api_key,
                params={"id": task_id},
            )
            status = result.get("status", "unknown")
            print(f"  [{task_id[:30]}...] 状态: {status}")

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
                    print(f"  ✅ 完成！视频 URL: {video_url}")
                else:
                    print(f"  ❌ 任务失败（状态: {status}）")

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
    parser.add_argument("--count", type=int, default=1, help="生成数量，默认 1")
    parser.add_argument("--random-image", action="store_true", help="从图片文件夹随机选一张，默认用第一张")

    args = parser.parse_args()

    # --images 0 表示明确禁用产品图
    if args.images == "0":
        args.images = None

    # 参数验证
    if not args.video and not args.url and not args.prompt:
        parser.error("必须提供 --video / --url（二创模式）或 --prompt（生产模式），至少其中之一")

    # 加载 API Key
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

    # 打印运行配置
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
    print(f"{'='*60}\n")

    # 加载提示词配置
    prompts = load_prompts()

    # --url 模式：先通过 TikHub 下载视频到临时文件
    tmp_video_path = None
    if args.url:
        if not tikhub_api_key:
            print("❌ 未找到 TIKHUB_API_KEY，请在 .env 添加：\n  TIKHUB_API_KEY=your_key", file=sys.stderr)
            sys.exit(1)
        clean_url = extract_video_url(args.url)
        print(f"  提取链接: {clean_url}")
        tmp_video_path = download_video_from_url(clean_url, tikhub_api_key)
        args.video = tmp_video_path

    # 步骤一：获取脚本
    if args.video:
        if not os.path.isfile(args.video):
            print(f"❌ 视频文件不存在: {args.video}", file=sys.stderr)
            sys.exit(1)
        script = analyze_video_with_gemini(args.video, gemini_api_key, args.prompt, prompts)
    else:
        script = expand_theme_with_gemini(args.prompt, gemini_api_key, prompts)

    # 步骤一（b）：生成文案（不阻塞后续流程，失败只警告）
    copy_data = generate_copy(script, gemini_api_key, prompts)

    # 步骤二：处理产品图片
    image_urls = get_image_urls(args.images, random_pick=args.random_image)
    if image_urls:
        print(f"  最终图片 URLs: {image_urls}\n")
        # 将产品图注入到 prompt 末尾，确保 Sora 在视频中实际呈现产品
        script = script + " The product shown in the reference image must appear clearly and prominently in the video."

    # 步骤三：创建视频任务
    task_ids = create_video_tasks(api_key, script, image_urls, args.orientation, args.duration, args.count)

    # 步骤四：轮询等待结果
    results = poll_tasks(api_key, task_ids)

    # 输出结果
    print(f"\n{'='*60}")
    print("📹 生成结果")
    print(f"{'='*60}")
    success_count = 0
    for task_id, res in results.items():
        if res["success"]:
            success_count += 1
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

    if success_count < len(results):
        sys.exit(1)


if __name__ == "__main__":
    main()
