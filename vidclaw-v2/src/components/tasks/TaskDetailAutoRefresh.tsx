"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ACTIVE_STATUSES = new Set(["pending", "analyzing", "generating", "polling"]);

export function TaskDetailAutoRefresh({
  taskId,
  status,
}: {
  taskId: string;
  status: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!ACTIVE_STATUSES.has(status)) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const response = await fetch(`/api/tasks/refresh?taskId=${encodeURIComponent(taskId)}`, {
          cache: "no-store",
        });
        if (response.ok && !cancelled) {
          router.refresh();
        }
      } catch {
        // Ignore refresh errors; next interval will retry.
      }
    };

    void tick();
    const timer = window.setInterval(tick, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [router, status, taskId]);

  return null;
}
