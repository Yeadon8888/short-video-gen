/**
 * End-to-end smoke test for video models.
 *
 * For every active video_generation model, submits one short generation
 * with a fixed prompt + reference image, polls until done/failed, and
 * prints a summary table. Bypasses /api/generate, credits, and Gemini
 * — the goal is to confirm each provider adapter actually completes a
 * round-trip with the live upstream.
 *
 * Run:  npx tsx scripts/test-video-models.ts [--slug=<modelSlug>]
 */
import "dotenv/config";
import {
  createVideoTasks,
  listActiveVideoModels,
  queryVideoTaskStatus,
  resolveActiveVideoModel,
  type VideoModelRecord,
} from "../src/lib/video/service";

const REFERENCE_IMAGE_URL =
  "https://vc-upload.yeadon.top/files/vidclaw-assets/31d91b2f-7184-4e7f-96db-58ee8a9c2d95/img-72bfb459-080b-4ca8-81bc-1f46a911a498.png";

const TEST_PROMPT =
  "A close-up product shot of the item in the reference image, on a clean white background, soft studio lighting, slight camera dolly-in, photorealistic.";

const POLL_INTERVAL_MS = 5_000;
const TIMEOUT_MS = 6 * 60_000;

interface TestResult {
  slug: string;
  provider: string;
  providerTaskId?: string;
  finalStatus: "succeeded" | "failed" | "timeout" | "submit_failed";
  videoUrl?: string;
  error?: string;
  elapsedSec: number;
}

async function testModel(model: VideoModelRecord): Promise<TestResult> {
  const start = Date.now();
  const tag = `[${model.slug} / ${model.provider}]`;
  console.log(`\n${tag} → submit`);

  let providerTaskId: string;
  try {
    const submitted = await createVideoTasks({
      model,
      request: {
        prompt: TEST_PROMPT,
        imageUrls: [REFERENCE_IMAGE_URL],
        orientation: "portrait",
        count: 1,
        model: model.slug,
      },
    });
    providerTaskId = submitted.providerTaskIds[0];
    console.log(`${tag} ✓ submitted: ${providerTaskId}`);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.log(`${tag} ✗ submit failed: ${error}`);
    return {
      slug: model.slug,
      provider: model.provider,
      finalStatus: "submit_failed",
      error: error.slice(0, 300),
      elapsedSec: Math.round((Date.now() - start) / 1000),
    };
  }

  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const status = await queryVideoTaskStatus({
        modelId: model.id,
        taskId: providerTaskId,
      });
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`${tag} [${elapsed}s] status=${status.status}`);
      if (status.status === "SUCCESS") {
        return {
          slug: model.slug,
          provider: model.provider,
          providerTaskId,
          finalStatus: "succeeded",
          videoUrl: status.url,
          elapsedSec: elapsed,
        };
      }
      if (status.status === "FAILED") {
        return {
          slug: model.slug,
          provider: model.provider,
          providerTaskId,
          finalStatus: "failed",
          error: status.failReason?.slice(0, 300),
          elapsedSec: elapsed,
        };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.log(`${tag} poll error: ${error.slice(0, 200)}`);
    }
  }

  return {
    slug: model.slug,
    provider: model.provider,
    providerTaskId,
    finalStatus: "timeout",
    elapsedSec: Math.round((Date.now() - start) / 1000),
  };
}

async function main() {
  const onlySlug = process.argv.find((a) => a.startsWith("--slug="))?.split("=")[1];

  let models: VideoModelRecord[];
  if (onlySlug) {
    models = [await resolveActiveVideoModel(onlySlug)];
  } else {
    const options = await listActiveVideoModels();
    models = await Promise.all(
      options.map((opt) => resolveActiveVideoModel(opt.slug)),
    );
  }

  console.log(`Testing ${models.length} model(s) in parallel...`);
  const results = await Promise.all(models.map(testModel));

  console.log("\n========== RESULTS ==========");
  console.table(
    results.map((r) => ({
      slug: r.slug,
      provider: r.provider,
      status: r.finalStatus,
      elapsed: `${r.elapsedSec}s`,
      videoUrl: r.videoUrl ?? "—",
      error: r.error ?? "—",
    })),
  );

  const passed = results.filter((r) => r.finalStatus === "succeeded").length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
