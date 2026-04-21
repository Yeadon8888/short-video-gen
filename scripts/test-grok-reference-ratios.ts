/**
 * Empirical test: which reference-image aspect ratio does grok2api
 * actually use vs silently ignore?
 *
 * Takes ONE source image, generates 4 preprocessed variants (original 9:16,
 * 1:1 center-crop, 1:1 white-letterbox, 16:9 white-letterbox), submits each
 * as a grok video task with an identical prompt, polls until all complete,
 * extracts the first frame of each, and saves a side-by-side report to
 * /tmp/grok-ref-test/.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import postgres from "postgres";
import { generateVideoThumbnail } from "../src/lib/storage/thumbnail";
import { uploadAsset } from "../src/lib/storage/gateway";

const OUT_DIR = "/tmp/grok-ref-test";
const TEST_USER_ID = "8e497616-0abf-4ffe-8b28-477313654e9e"; // stripe-test user
const SOURCE_IMAGE_URL =
  "https://vc-upload.yeadon.top/files/vidclaw-assets/31d91b2f-7184-4e7f-96db-58ee8a9c2d95/img-ee14fb3e-2113-48d2-9365-813539c53784.png";

const PROMPT =
  "A Japanese woman wearing these exact sunglasses walks along a sunlit Tokyo street, cinematic slow-motion, product-focused, logo clearly visible.";

type Variant = {
  name: string;
  description: string;
  transform: (buf: Buffer) => Promise<Buffer>;
};

const VARIANTS: Variant[] = [
  {
    name: "A_original_9x16",
    description: "untouched (9:16)",
    transform: async (buf) => buf,
  },
  {
    name: "B_crop_1x1",
    description: "center-cropped to 1024×1024 (loses top/bottom)",
    transform: async (buf) =>
      sharp(buf)
        .resize(1024, 1024, { fit: "cover", position: "centre" })
        .jpeg({ quality: 92 })
        .toBuffer(),
  },
  {
    name: "C_letterbox_1x1",
    description: "letterboxed to 1024×1024 with white bars",
    transform: async (buf) =>
      sharp(buf)
        .resize(1024, 1024, {
          fit: "contain",
          position: "centre",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .jpeg({ quality: 92 })
        .toBuffer(),
  },
  {
    name: "D_letterbox_16x9",
    description: "letterboxed to 1920×1080 with white bars",
    transform: async (buf) =>
      sharp(buf)
        .resize(1920, 1080, {
          fit: "contain",
          position: "centre",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .jpeg({ quality: 92 })
        .toBuffer(),
  },
];

async function fetchGrokConfig() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    const [m] = await sql`
      SELECT base_url, api_key FROM models WHERE slug = 'grok-imagine-video'
    `;
    return {
      baseUrl: (m.base_url as string)?.replace(/\/+$/, "") ||
        "https://grok2api-production-3630.up.railway.app",
      apiKey: m.api_key as string,
    };
  } finally {
    await sql.end();
  }
}

async function submitGrok(params: {
  baseUrl: string;
  apiKey: string;
  imageUrl: string;
  size: string;
}): Promise<string> {
  const form = new FormData();
  form.append("model", "grok-imagine-video");
  form.append("prompt", PROMPT);
  form.append("input_reference[image_url]", params.imageUrl);
  form.append("seconds", "6");
  form.append("size", params.size);
  form.append("resolution_name", "720p");
  form.append("preset", "normal");

  const r = await fetch(`${params.baseUrl}/v1/videos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.apiKey}` },
    body: form,
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`submit HTTP ${r.status}: ${JSON.stringify(body)}`);
  return body.id;
}

async function pollGrok(params: {
  baseUrl: string;
  apiKey: string;
  taskId: string;
  maxSec?: number;
}): Promise<{ url: string | null; status: string; raw: Record<string, unknown> }> {
  const start = Date.now();
  const maxMs = (params.maxSec ?? 240) * 1000;
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 5000));
    const r = await fetch(`${params.baseUrl}/v1/videos/${params.taskId}`, {
      headers: { Authorization: `Bearer ${params.apiKey}` },
    });
    const body = (await r.json()) as { status?: string; video?: { url?: string } };
    if (body.status === "succeeded" || body.status === "completed") {
      return {
        url:
          body.video?.url ??
          `${params.baseUrl}/v1/videos/${params.taskId}/content`,
        status: body.status,
        raw: body as Record<string, unknown>,
      };
    }
    if (body.status === "failed") {
      return { url: null, status: "failed", raw: body as Record<string, unknown> };
    }
  }
  return { url: null, status: "timeout", raw: {} };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const cfg = await fetchGrokConfig();

  // Download source once
  const sourceBuf = Buffer.from(await (await fetch(SOURCE_IMAGE_URL)).arrayBuffer());
  const sourceMeta = await sharp(sourceBuf).metadata();
  console.log(
    `Source: ${sourceMeta.width}×${sourceMeta.height} (ratio ${(sourceMeta.width! / sourceMeta.height!).toFixed(3)})`,
  );
  await writeFile(join(OUT_DIR, "00_source.png"), sourceBuf);

  // Prepare and upload each variant
  type Prepared = {
    v: Variant;
    url: string;
    size: string;
    localPath: string;
  };
  const prepared: Prepared[] = [];

  for (const v of VARIANTS) {
    console.log(`[${v.name}] preparing...`);
    const buf = await v.transform(sourceBuf);
    const meta = await sharp(buf).metadata();
    const localPath = join(OUT_DIR, `${v.name}_input.jpg`);
    await writeFile(localPath, buf);

    // Upload to R2 so grok can fetch it
    const ab = new ArrayBuffer(buf.byteLength);
    new Uint8Array(ab).set(buf);
    const stored = await uploadAsset({
      userId: TEST_USER_ID,
      filename: `ratiotest-${v.name}.jpg`,
      data: ab,
      contentType: "image/jpeg",
    });

    // Size for grok output — keep all tasks on 1024x1792 portrait so the
    // only variable is the input image.
    prepared.push({ v, url: stored.url, size: "1024x1792", localPath });
    console.log(
      `   ${meta.width}×${meta.height} → ${stored.url}`,
    );
  }

  // Submit all 4 in parallel
  console.log(`\nSubmitting ${prepared.length} grok tasks in parallel...`);
  const submitted = await Promise.all(
    prepared.map(async (p) => {
      try {
        const id = await submitGrok({
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          imageUrl: p.url,
          size: p.size,
        });
        console.log(`  [${p.v.name}] submitted: ${id}`);
        return { ...p, taskId: id, error: null as string | null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  [${p.v.name}] SUBMIT FAILED: ${msg}`);
        return { ...p, taskId: null as string | null, error: msg };
      }
    }),
  );

  // Poll all in parallel
  console.log(`\nPolling...`);
  const results = await Promise.all(
    submitted.map(async (s) => {
      if (!s.taskId) return { ...s, finalStatus: "submit_failed", videoUrl: null };
      const res = await pollGrok({
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        taskId: s.taskId,
      });
      return { ...s, finalStatus: res.status, videoUrl: res.url };
    }),
  );

  // Extract first frame of each successful video
  console.log(`\nExtracting frames...`);
  for (const r of results) {
    if (!r.videoUrl) {
      console.log(`  [${r.v.name}] skipped (no video)`);
      continue;
    }
    try {
      const thumb = await generateVideoThumbnail({
        videoUrl: r.videoUrl,
        seekSec: 0.8,
        width: 600,
      });
      await writeFile(join(OUT_DIR, `${r.v.name}_output.jpg`), thumb.buffer);
      console.log(`  [${r.v.name}] frame saved`);
    } catch (e) {
      console.log(`  [${r.v.name}] frame extract failed: ${(e as Error).message}`);
    }
  }

  console.log(`\n========== RESULTS ==========`);
  for (const r of results) {
    console.log(
      `${r.v.name.padEnd(22)} | ${r.v.description.padEnd(50)} | ${r.finalStatus.padEnd(12)} | ${r.videoUrl ?? "-"}`,
    );
  }
  console.log(`\nVisual comparison files in ${OUT_DIR}/`);
  console.log(`  00_source.png — your original reference`);
  console.log(`  *_input.jpg    — what we sent to grok`);
  console.log(`  *_output.jpg   — first frame of generated video`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
