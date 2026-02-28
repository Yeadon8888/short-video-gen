/**
 * Sora task submission and polling
 * Mirrors sora_primary.py + sora_fallback.py + sora.py
 */

const YUNWU_BASE = "https://yunwu.ai";
const PRIMARY_MODEL = "sora-2-vip-all";
const FALLBACK_MODEL = "sora-2";

const FALLBACK_TRIGGER_CODES = new Set(["10400", "10403", "task_failed"]);
const FALLBACK_TRIGGER_MSGS = [
  "cloudflare challenge",
  "something didn't look right",
  "heavy load",
  "负载已饱和",
  "task failed",
];

const SIZE_MAP: Record<string, string> = {
  portrait: "720x1280",
  landscape: "1280x720",
};

const SECONDS_MAP: Record<number, number> = {
  10: 8,
  15: 12,
  4: 4,
  8: 8,
  12: 12,
};

export interface SoraParams {
  prompt: string;
  imageUrls?: string[];
  orientation: "portrait" | "landscape";
  duration: 10 | 15;
  count: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  url?: string;
  enhancedPrompt?: string;
  status: string;
}

function getPrimaryApiKey(): string {
  return process.env.YUNWU_API_KEY ?? "";
}

function getFallbackApiKey(): string {
  return process.env.YUNWU_API_KEY2 || process.env.YUNWU_API_KEY || "";
}

function isOverload(result: Record<string, unknown>): boolean {
  const errStr = String(result.error ?? "") + String(result.message ?? "");
  return (
    result.code === "get_channel_failed" ||
    errStr.includes("负载已饱和") ||
    errStr.includes("get_channel_failed")
  );
}

async function apiRequest(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<Record<string, unknown>> {
  let url = YUNWU_BASE + path;
  if (queryParams) {
    url += "?" + new URLSearchParams(queryParams).toString();
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(300_000),
      });
      const data = (await res.json()) as Record<string, unknown>;

      // Retry on overload
      if (
        typeof data === "object" &&
        (data as Record<string, unknown>).code === 500 &&
        String((data as Record<string, unknown>).message ?? "").includes("负载已饱和")
      ) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 60_000));
          continue;
        }
      }
      return data;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 5_000));
        continue;
      }
      throw new Error(`Sora request failed after 3 attempts`);
    }
  }
  throw new Error("unreachable");
}

/** Submit primary model tasks, returns task_id list */
export async function createPrimaryTasks(params: SoraParams): Promise<string[]> {
  const apiKey = getPrimaryApiKey();
  if (!apiKey) throw new Error("YUNWU_API_KEY is not set");

  const taskIds: string[] = [];
  for (let i = 0; i < params.count; i++) {
    const payload = {
      images: params.imageUrls ?? [],
      model: PRIMARY_MODEL,
      orientation: params.orientation,
      prompt: params.prompt,
      size: "large",
      duration: params.duration,
      watermark: false,
      private: false,
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await apiRequest("POST", "/v1/video/create", apiKey, payload);
      const taskId = result.id as string | undefined;
      if (taskId) {
        taskIds.push(taskId);
        break;
      }
      if (isOverload(result) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 60_000));
        continue;
      }
      throw new Error(`Primary task creation failed: ${JSON.stringify(result).slice(0, 200)}`);
    }
  }
  return taskIds;
}

/** Submit fallback model (sora-2) task, returns task_id or null */
export async function createFallbackTask(params: SoraParams): Promise<string | null> {
  const apiKey = getFallbackApiKey();
  if (!apiKey) return null;

  const size = SIZE_MAP[params.orientation] ?? "720x1280";
  const seconds = SECONDS_MAP[params.duration] ?? 8;

  const formData = new FormData();
  formData.append("model", FALLBACK_MODEL);
  formData.append("prompt", params.prompt);
  formData.append("seconds", String(seconds));
  formData.append("size", size);
  formData.append("watermark", "false");
  formData.append("private", "false");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(YUNWU_BASE + "/v1/videos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        body: formData,
        signal: AbortSignal.timeout(130_000),
      });
      const result = (await res.json()) as Record<string, unknown>;
      const taskId = result.id as string | undefined;
      if (taskId) return taskId;
      if (isOverload(result) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 60_000));
        continue;
      }
      return null;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 5_000));
        continue;
      }
      return null;
    }
  }
  return null;
}

/** Query primary model task */
async function queryPrimary(apiKey: string, taskId: string): Promise<Record<string, unknown>> {
  return apiRequest("GET", "/v1/video/query", apiKey, undefined, { id: taskId });
}

/** Query fallback model task */
async function queryFallback(apiKey: string, taskId: string): Promise<Record<string, unknown>> {
  return apiRequest("GET", `/v1/videos/${taskId}`, apiKey);
}

const TERMINAL_STATUSES = new Set(["succeeded", "completed", "success", "failed", "error", "cancelled"]);

/**
 * Poll tasks with SSE progress callback.
 * onProgress: called with a log line string
 * Returns results map: taskId → TaskResult
 */
export async function pollTasks(
  taskIds: string[],
  onProgress: (msg: string) => void,
  options?: {
    pollIntervalMs?: number;
    maxWaitMs?: number;
    fallbackParams?: SoraParams;
  }
): Promise<Map<string, TaskResult>> {
  const pollInterval = options?.pollIntervalMs ?? 30_000;
  const maxWait = options?.maxWaitMs ?? 1_800_000; // 30 min

  const primaryApiKey = getPrimaryApiKey();
  const fallbackApiKey = getFallbackApiKey();
  const results = new Map<string, TaskResult>();
  const pending = new Set(taskIds);
  const fallbackSet = new Set<string>();
  const originalToFallback = new Map<string, string>(); // original → fallback task id
  let elapsed = 0;

  onProgress(`提交了 ${taskIds.length} 个任务，每 ${pollInterval / 1000}s 轮询一次`);

  while (pending.size > 0) {
    await new Promise((r) => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    if (elapsed > maxWait) {
      for (const taskId of pending) {
        onProgress(`任务 ${taskId.slice(0, 20)}... 等待超时`);
        results.set(taskId, { taskId, success: false, status: "timeout" });
      }
      break;
    }

    for (const taskId of [...pending]) {
      let result: Record<string, unknown>;
      try {
        if (fallbackSet.has(taskId)) {
          result = await queryFallback(fallbackApiKey, taskId);
        } else {
          result = await queryPrimary(primaryApiKey, taskId);
        }
      } catch (e) {
        onProgress(`查询 ${taskId.slice(0, 20)}... 失败（${e}），下轮重试`);
        continue;
      }

      const status = (result.status as string) ?? "unknown";
      onProgress(`[轮询] ${taskId.slice(0, 20)}... 状态=${status} 已等待=${elapsed / 1000}s`);

      if (!TERMINAL_STATUSES.has(status)) continue;

      const videoUrl = result.video_url as string | undefined;
      const enhancedPrompt = result.enhanced_prompt as string | undefined;
      const success = !["failed", "error", "cancelled"].includes(status);

      if (!success) {
        const failReason = String(
          result.fail_reason ?? result.error ?? result.message ?? ""
        ).toLowerCase();
        const errObj = result.error as Record<string, unknown> | undefined;
        const errorCode = String(
          typeof errObj === "object" ? (errObj?.code ?? "") : (errObj ?? "")
        ).toLowerCase();

        const isFallbackTrigger =
          FALLBACK_TRIGGER_CODES.has(errorCode) ||
          FALLBACK_TRIGGER_MSGS.some((m) => failReason.includes(m));

        if (isFallbackTrigger && options?.fallbackParams && !fallbackSet.has(taskId)) {
          onProgress(`主模型失败（${errorCode || failReason.slice(0, 40)}），切换 sora-2 备用模型...`);
          pending.delete(taskId);
          const newTaskId = await createFallbackTask(options.fallbackParams);
          if (newTaskId) {
            pending.add(newTaskId);
            fallbackSet.add(newTaskId);
            originalToFallback.set(taskId, newTaskId);
            onProgress(`备用任务已提交: ${newTaskId}`);
          } else {
            onProgress(`备用模型也无法提交任务，放弃`);
            results.set(taskId, { taskId, success: false, status: "fallback_failed" });
          }
          continue;
        } else {
          onProgress(`任务失败（${status}）— ${failReason.slice(0, 80)}`);
        }
      }

      // Map fallback task back to original id for caller
      const reportId =
        [...originalToFallback.entries()].find(([, v]) => v === taskId)?.[0] ?? taskId;

      results.set(reportId, {
        taskId: reportId,
        success,
        url: videoUrl,
        enhancedPrompt,
        status,
      });
      pending.delete(taskId);

      if (success) {
        onProgress(`完成！视频 URL: ${videoUrl}`);
      }
    }
  }

  return results;
}
