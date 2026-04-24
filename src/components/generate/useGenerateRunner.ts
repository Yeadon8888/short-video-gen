"use client";

import { useEffect, useRef } from "react";
import { useGenerateStore, type DeliveryProgress, type PollResult } from "@/stores/generate";
import type { BatchGenerateRequest, FulfillmentMode, GenerateRequest } from "@/lib/video/types";
import type { BatchSummary } from "@/components/generate/generate-config";

interface SSEEvent {
  type: string;
  message?: string;
  stage?: string;
  data?: unknown;
  urls?: string[];
  code?: string;
  sora_prompt?: string;
  taskIds?: string[];
  dbTaskId?: string;
  fulfillmentMode?: FulfillmentMode;
  requestedCount?: number;
  deliveryDeadlineAt?: string;
}

export function useGenerateRunner(params: {
  onBatchSummaryChange: (summary: BatchSummary | null) => void;
}) {
  const abortRef = useRef<AbortController | null>(null);
  const pollingRef = useRef(false);

  const stage = useGenerateStore((state) => state.stage);
  const reset = useGenerateStore((state) => state.reset);
  const setStage = useGenerateStore((state) => state.setStage);
  const addLog = useGenerateStore((state) => state.addLog);
  const setScript = useGenerateStore((state) => state.setScript);
  const setSoraPrompt = useGenerateStore((state) => state.setSoraPrompt);
  const setVideoUrls = useGenerateStore((state) => state.setVideoUrls);
  const setError = useGenerateStore((state) => state.setError);
  const setPollResults = useGenerateStore((state) => state.setPollResults);
  const setDbTaskId = useGenerateStore((state) => state.setDbTaskId);
  const setFulfillmentMode = useGenerateStore((state) => state.setFulfillmentMode);
  const setDeliveryProgress = useGenerateStore((state) => state.setDeliveryProgress);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      pollingRef.current = false;
    };
  }, []);

  const isLoading = !["IDLE", "DONE", "ERROR"].includes(stage);

  // ── Standard mode: poll by providerTaskIds ──
  async function pollSoraTasks(taskIds: string[], soraPrompt?: string) {
    const POLL_INTERVAL = 15_000;
    const MAX_POLLS = 40;
    const STALE_LIMIT = 5;
    const signal = abortRef.current?.signal;

    let lastProgressKey = "";
    let staleCount = 0;

    async function pollOnce(poll: number) {
      const res = await fetch(
        `/api/generate/status?taskIds=${encodeURIComponent(taskIds.join(","))}`,
        { signal, cache: "no-store" },
      );
      if (!res.ok) {
        addLog(`[轮询] #${poll + 1} 失败: HTTP ${res.status}`);
        return false;
      }

      const data = await res.json();
      const results = data.results as PollResult[];
      setPollResults(results);

      for (const result of results) {
        addLog(
          `[轮询] ${result.taskId.slice(0, 14)}... 状态=${result.status} 进度=${result.progress}`,
        );
      }

      if (data.allDone) {
        const successUrls = results
          .filter((result) => result.status === "SUCCESS" && result.url)
          .map((result) => result.url!);

        if (successUrls.length > 0) {
          setVideoUrls(successUrls);
          setStage("DONE");
        } else {
          const reasons = results
            .filter((result) => result.status === "FAILED")
            .map((result) => result.failReason ?? "未知原因")
            .join("; ");
          setError("SORA_FAILED", `视频生成失败: ${reasons}`, soraPrompt);
        }
        pollingRef.current = false;
        return true;
      }

      const currentKey = results
        .map((result) => `${result.taskId}:${result.status}:${result.progress}`)
        .join("|");
      const maxProgress = Math.max(...results.map((result) => parseInt(result.progress, 10) || 0));

      if (currentKey === lastProgressKey) {
        if (maxProgress < 80) staleCount += 1;
        if (staleCount >= STALE_LIMIT) {
          setError("POLL_STALE", "视频生成进度停滞，请检查任务后台。", soraPrompt);
          pollingRef.current = false;
          return true;
        }
      } else {
        staleCount = 0;
        lastProgressKey = currentKey;
      }

      return false;
    }

    setPollResults(taskIds.map((taskId) => ({
      taskId,
      status: "SUBMITTED",
      progress: "0%",
    })));

    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      if (signal?.aborted) return;
      if (poll > 0) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
        if (signal?.aborted) return;
      }

      try {
        const finished = await pollOnce(poll);
        if (finished) return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        addLog(`[轮询] 异常: ${String(error).slice(0, 100)}`);
      }
    }

    if (signal?.aborted) return;
    setError("POLL_TIMEOUT", "视频生成超时，请检查任务后台。", soraPrompt);
    pollingRef.current = false;
  }

  // ── Fulfillment mode: poll by dbTaskId ──
  async function pollFulfillmentTask(
    dbTaskId: string,
    requestedCount: number,
    deliveryDeadlineAt: string | null,
    soraPrompt?: string,
  ) {
    const POLL_INTERVAL = 15_000;
    const MAX_POLLS = 60; // up to 15 min of polling
    const signal = abortRef.current?.signal;

    setDeliveryProgress({
      requestedCount,
      successfulCount: 0,
      failedCount: 0,
      pendingCount: requestedCount,
      isComplete: false,
      successUrls: [],
      deliveryDeadlineAt,
    });

    for (let poll = 0; poll < MAX_POLLS; poll += 1) {
      if (signal?.aborted) return;
      if (poll > 0) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
        if (signal?.aborted) return;
      }

      try {
        const res = await fetch(
          `/api/generate/status?dbTaskId=${encodeURIComponent(dbTaskId)}`,
          { signal, cache: "no-store" },
        );
        if (!res.ok) {
          addLog(`[补齐轮询] #${poll + 1} 失败: HTTP ${res.status}`);
          continue;
        }

        const data = (await res.json()) as DeliveryProgress & { isComplete: boolean };
        setDeliveryProgress({
          requestedCount: data.requestedCount,
          successfulCount: data.successfulCount,
          failedCount: data.failedCount,
          pendingCount: data.pendingCount,
          isComplete: data.isComplete,
          successUrls: data.successUrls,
          deliveryDeadlineAt,
        });

        addLog(
          `[补齐] ${data.successfulCount}/${requestedCount} 成功，${data.pendingCount} 进行中，${data.failedCount} 失败`,
        );

        if (data.isComplete) {
          if (data.successUrls.length > 0) {
            setVideoUrls(data.successUrls);
            setStage("DONE");
          } else {
            setError("SORA_FAILED", `目标补齐结束：${data.successfulCount}/${requestedCount} 成功`, soraPrompt);
          }
          pollingRef.current = false;
          return;
        }

        // Check deadline
        if (deliveryDeadlineAt && new Date() >= new Date(deliveryDeadlineAt)) {
          addLog("[补齐] 已超过 3 小时补齐窗口，停止轮询");
          if (data.successUrls.length > 0) {
            setVideoUrls(data.successUrls);
          }
          setStage("DONE");
          pollingRef.current = false;
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        addLog(`[补齐轮询] 异常: ${String(error).slice(0, 100)}`);
      }
    }

    if (signal?.aborted) return;
    addLog("[补齐] 轮询达到上限，请前往任务页查看最终状态。");
    setStage("DONE");
    pollingRef.current = false;
  }

  async function startStreamGenerate(body: GenerateRequest) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    params.onBatchSummaryChange(null);
    reset();
    setStage("ANALYZE");
    pollingRef.current = false;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        setError("HTTP_ERROR", `请求失败: HTTP ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("HTTP_ERROR", "服务端没有返回可读取的数据流。");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          let event: SSEEvent;
          try {
            event = JSON.parse(json);
          } catch {
            continue;
          }

          if (event.type === "stage") {
            setStage(event.stage as typeof stage);
            continue;
          }

          if (event.type === "log") {
            addLog(event.message ?? "");
            continue;
          }

          if (event.type === "script") {
            setScript(event.data as Parameters<typeof setScript>[0]);
            continue;
          }

          if (event.type === "videos") {
            setVideoUrls(event.urls ?? []);
            continue;
          }

          if (event.type === "tasks") {
            const taskIds = event.taskIds ?? [];
            const isFulfillmentTask =
              event.fulfillmentMode === "backfill_until_target" && Boolean(event.dbTaskId);

            if (taskIds.length > 0 || isFulfillmentTask) {
              pollingRef.current = true;
              setStage("POLL");
              if (event.sora_prompt) setSoraPrompt(event.sora_prompt);
              if (event.dbTaskId) setDbTaskId(event.dbTaskId);
              if (event.fulfillmentMode) setFulfillmentMode(event.fulfillmentMode);

              if (taskIds.length > 0) {
                addLog(`任务已提交: ${taskIds.join(", ").slice(0, 60)}`);
              } else {
                addLog("任务已进入生成队列，后台将分批提交");
              }

              if (isFulfillmentTask && event.dbTaskId) {
                addLog(`[目标补齐] 目标 ${event.requestedCount ?? taskIds.length} 条，补齐窗口 3 小时`);
                void pollFulfillmentTask(
                  event.dbTaskId,
                  event.requestedCount ?? taskIds.length,
                  event.deliveryDeadlineAt ?? null,
                  event.sora_prompt,
                );
              } else {
                void pollSoraTasks(taskIds, event.sora_prompt);
              }
            }
            continue;
          }

          if (event.type === "error") {
            setError(event.code ?? "UNKNOWN", event.message ?? "未知错误", event.sora_prompt);
            continue;
          }

          if (event.type === "done" && !pollingRef.current) {
            setStage("DONE");
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("NETWORK", String(error));
      pollingRef.current = false;
    }
  }

  async function startBatchGenerate(body: BatchGenerateRequest) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    reset();
    params.onBatchSummaryChange(null);
    setStage("ANALYZE");
    addLog("正在创建批量带货任务...");

    try {
      const res = await fetch("/api/generate/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ac.signal,
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as
        | {
            taskGroupId?: string;
            error?: string;
            createdCount?: number;
            failedCount?: number;
            taskIds?: string[];
            errors?: Array<{ index: number; message: string }>;
          }
        | null;

      if (!res.ok) {
        setError("BATCH_FAILED", data?.error ?? `请求失败: HTTP ${res.status}`);
        return;
      }

      params.onBatchSummaryChange({
        taskGroupId: data?.taskGroupId ?? "",
        createdCount: data?.createdCount ?? 0,
        failedCount: data?.failedCount ?? 0,
        taskIds: data?.taskIds ?? [],
        errors: data?.errors ?? [],
      });
      const createdTaskIds = data?.taskIds ?? [];
      const createdCount = data?.createdCount ?? 0;
      addLog(`批量任务创建完成：成功 ${createdCount} 条`);
      if (createdTaskIds.length > 0) {
        setPollResults(createdTaskIds.map((taskId) => ({
          taskId,
          status: "QUEUED",
          progress: "0%",
        })));
      }
      setStage("DONE");
      addLog("批量任务已进入后台队列，可在任务组持续查看进度。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError("BATCH_FAILED", String(error));
    }
  }

  return {
    isLoading,
    startBatchGenerate,
    startStreamGenerate,
  };
}
