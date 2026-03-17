#!/usr/bin/env python3
"""
Batch generate showcase videos, download, and upload to R2.
Run from the skill root: python3 scripts/batch_showcase.py
"""
import json, os, subprocess, sys, tempfile, time

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(SKILL_DIR)

# ── Load .env ──
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

load_env(os.path.join(SKILL_DIR, ".env"))
load_env(os.path.expanduser("~/.env"))

# ── Products to generate ──
PRODUCTS = [
    ("candle",     "一支高端香氛蜡烛在黑暗中燃烧的电影感广告。暖黄火焰特写，蜡油缓缓流淌，大理石台面上金色光影婆娑。烟雾优雅上升，光影氛围感十足。"),
    ("keyboard",   "一把RGB机械键盘的产品广告。手指快速敲击键帽的ASMR特写，彩色LED灯光在半透明键帽间律动。科技感桌面布局，暗色调画面。"),
    ("yoga",       "一位模特身穿时尚运动套装在阳光充沛的瑜伽室中优雅切换动作。落地窗透进自然光，极简美学风格，展示面料弹性和运动穿搭质感。"),
    ("smartwatch", "一块智能手表的功能演示短片广告。表盘切换显示步数、心率、睡眠数据。手表表面发出柔和光芒，色彩变换。科技生活风格，干净背景。"),
    ("catfood",    "一只可爱的毛茸茸猫咪走向一碗高端猫粮的萌宠广告。猫咪满足地吃食物的特写，食物看起来新鲜诱人。温暖的家居环境，猫咪表情满足。"),
]

R2_KEY_PREFIX = "files/vidclaw-assets/showcase"

def run_generate(prompt: str, name: str) -> str | None:
    """Run generate.py --prompt --images 0 --submit, return task_id."""
    cmd = [
        sys.executable, "scripts/generate.py",
        "--prompt", prompt,
        "--images", "0",
        "--duration", "10",
        "--submit",
    ]
    print(f"\n{'─'*50}")
    print(f"📤 提交: {name}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120,
                            env={**os.environ, "http_proxy": "", "https_proxy": "", "all_proxy": ""})
    output = result.stdout + result.stderr
    print(output[-500:] if len(output) > 500 else output)

    # Extract task_id from output
    for line in output.split("\n"):
        if "任务已提交:" in line:
            # Format: "  ✅ 任务已提交: task_xxx（当前状态: NOT_START）"
            parts = line.split("任务已提交:")[1].split("（")[0].strip()
            return parts
    return None


def check_tasks(task_ids: list[str]) -> dict:
    """Check task statuses via generate.py --check."""
    ids_str = ",".join(task_ids)
    cmd = [sys.executable, "scripts/generate.py", "--check", ids_str]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60,
                            env={**os.environ, "http_proxy": "", "https_proxy": "", "all_proxy": ""})
    output = result.stdout + result.stderr
    print(output[-800:] if len(output) > 800 else output)

    # Parse results
    results = {}
    for task_id in task_ids:
        short_id = task_id[:24]
        for line in output.split("\n"):
            if short_id in line:
                if "SUCCESS" in line.upper():
                    # Find URL
                    for l2 in output.split("\n"):
                        if "✅" in l2 and ("http" in l2):
                            url = l2.split("✅")[-1].strip()
                            if url.startswith("http") or "http" in url:
                                # Extract the URL
                                import re
                                urls = re.findall(r'https?://[^\s]+', l2)
                                if urls:
                                    results[task_id] = {"status": "SUCCESS", "url": urls[0]}
                                    break
                elif "FAILURE" in line.upper() or "FAIL" in line.upper():
                    results[task_id] = {"status": "FAILURE", "url": None}
    return results


def download_video(url: str, dest: str):
    """Download video from URL."""
    print(f"  ⬇️  下载: {url[:80]}...")
    subprocess.run(
        ["curl", "-sL", "--noproxy", "*", "--max-time", "120", "-o", dest, url],
        check=True, timeout=130,
    )
    size_mb = os.path.getsize(dest) / 1024 / 1024
    print(f"  ✅ 已下载: {size_mb:.1f} MB")


def upload_to_r2(filepath: str, object_key: str) -> str:
    """Upload file to R2 via upload gateway."""
    upload_url = os.environ["UPLOAD_API_URL"].rstrip("/")
    upload_key = os.environ["UPLOAD_API_KEY"]
    print(f"  ⬆️  上传到 R2: {object_key}")
    result = subprocess.run(
        [
            "curl", "-s", "-L", "--noproxy", "*", "--max-time", "120",
            "-X", "POST",
            "-H", "Content-Type: video/mp4",
            "-H", f"X-Upload-Key: {upload_key}",
            "--data-binary", f"@{filepath}",
            f"{upload_url}/upload?key={object_key}",
        ],
        capture_output=True, timeout=130,
    )
    raw = result.stdout.decode().strip()
    if not raw:
        raise RuntimeError(f"Upload failed: {result.stderr.decode()[:300]}")
    payload = json.loads(raw)
    url = payload.get("url")
    if url:
        print(f"  ✅ 已上传: {url}")
        return url
    raise RuntimeError(f"Upload failed: {raw[:300]}")


def main():
    print("=" * 60)
    print("🎬 批量生成 Showcase 视频")
    print("=" * 60)

    # Step 1: Submit all tasks
    task_map = {}  # task_id -> product_name
    for name, prompt in PRODUCTS:
        task_id = run_generate(prompt, name)
        if task_id:
            task_map[task_id] = name
            print(f"  ✅ {name}: {task_id}")
        else:
            print(f"  ❌ {name}: 提交失败", file=sys.stderr)

    if not task_map:
        print("❌ 没有成功提交的任务", file=sys.stderr)
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"📊 已提交 {len(task_map)} 个任务，开始轮询...")
    print(f"{'='*60}")

    # Step 2: Poll until all done
    task_ids = list(task_map.keys())
    api_key = os.environ.get("VIDEO_API_KEY") or os.environ.get("PLATO_API_KEY")

    # Import the query function from generate.py
    sys.path.insert(0, os.path.join(SKILL_DIR, "scripts"))
    from generate import query_task_status, get_video_base_url

    completed = {}
    pending = set(task_ids)
    max_wait = 1800  # 30 min
    interval = 30
    elapsed = 0

    while pending and elapsed < max_wait:
        time.sleep(interval)
        elapsed += interval
        print(f"\n  [轮询 {elapsed}s]")
        for tid in list(pending):
            status, progress, video_url, fail_reason = query_task_status(api_key, tid)
            name = task_map[tid]
            print(f"    {name}: status={status} progress={progress}")
            if status == "SUCCESS" and video_url:
                completed[tid] = video_url
                pending.remove(tid)
                print(f"    ✅ {name} 完成: {video_url[:80]}...")
            elif status == "FAILURE":
                pending.remove(tid)
                print(f"    ❌ {name} 失败: {fail_reason}")

    print(f"\n{'='*60}")
    print(f"📊 {len(completed)}/{len(task_map)} 个视频生成成功")
    print(f"{'='*60}")

    # Step 3: Download and upload each video
    results = {}
    for tid, video_url in completed.items():
        name = task_map[tid]
        print(f"\n{'─'*50}")
        print(f"📥 处理: {name}")

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            download_video(video_url, tmp_path)
            r2_key = f"{R2_KEY_PREFIX}/{name}.mp4"
            r2_url = upload_to_r2(tmp_path, r2_key)
            results[name] = r2_url
        except Exception as e:
            print(f"  ❌ 处理失败: {e}", file=sys.stderr)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    # Summary
    print(f"\n{'='*60}")
    print("🎉 最终结果")
    print(f"{'='*60}")
    for name, url in results.items():
        print(f"  {name}: {url}")

    failed = [task_map[tid] for tid in task_map if tid not in completed]
    if failed:
        print(f"\n  ❌ 失败: {', '.join(failed)}")

    print(f"{'='*60}")


if __name__ == "__main__":
    main()
