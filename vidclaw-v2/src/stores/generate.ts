import { create } from "zustand";
import type { FulfillmentMode } from "@/lib/video/types";

export interface ScriptResult {
  creative_points: string[];
  hook: string;
  plot_summary: string;
  shots: {
    id: number;
    scene_zh: string;
    sora_prompt: string;
    duration_s: number;
    camera: string;
  }[];
  full_sora_prompt: string;
  copy: {
    title: string;
    caption: string;
    first_comment: string;
  };
}

export interface GenerateParams {
  orientation: "portrait" | "landscape";
  duration: 8 | 10 | 15;
  count: number;
  platform: "douyin" | "tiktok";
  model: string;
}

export type GenerateStage =
  | "IDLE"
  | "DOWNLOAD"
  | "ANALYZE"
  | "GENERATE"
  | "POLL"
  | "DONE"
  | "ERROR";

export interface PollResult {
  taskId: string;
  status: string;
  progress: string;
  url?: string;
  failReason?: string;
}

export interface DeliveryProgress {
  requestedCount: number;
  successfulCount: number;
  failedCount: number;
  pendingCount: number;
  isComplete: boolean;
  successUrls: string[];
  deliveryDeadlineAt: string | null;
}

interface GenerateState {
  stage: GenerateStage;
  logs: string[];
  script: ScriptResult | null;
  videoUrls: string[];
  errorMessage: string | null;
  errorCode: string | null;
  soraPrompt: string | null;
  pollResults: PollResult[];

  /** db task ID returned after submission — used for fulfillment mode polling */
  dbTaskId: string | null;
  fulfillmentMode: FulfillmentMode;
  deliveryProgress: DeliveryProgress | null;

  params: GenerateParams;

  setStage: (stage: GenerateStage) => void;
  addLog: (msg: string) => void;
  setScript: (script: ScriptResult) => void;
  setVideoUrls: (urls: string[]) => void;
  setError: (code: string, message: string, soraPrompt?: string) => void;
  setSoraPrompt: (prompt: string) => void;
  setPollResults: (results: PollResult[]) => void;
  setDbTaskId: (id: string | null) => void;
  setFulfillmentMode: (mode: FulfillmentMode) => void;
  setDeliveryProgress: (progress: DeliveryProgress | null) => void;
  setParams: (params: Partial<GenerateParams>) => void;
  reset: () => void;
}

const defaultParams: GenerateParams = {
  orientation: "portrait",
  duration: 10,
  count: 1,
  platform: "douyin",
  model: "",
};

export const useGenerateStore = create<GenerateState>((set) => ({
  stage: "IDLE",
  logs: [],
  script: null,
  videoUrls: [],
  errorMessage: null,
  errorCode: null,
  soraPrompt: null,
  pollResults: [],
  dbTaskId: null,
  fulfillmentMode: "standard",
  deliveryProgress: null,
  params: defaultParams,

  setStage: (stage) => set({ stage }),
  addLog: (msg) => set((s) => {
    const logs = [...s.logs, msg];
    return { logs: logs.length > 200 ? logs.slice(-200) : logs };
  }),
  setScript: (script) => set({ script }),
  setVideoUrls: (urls) => set({ videoUrls: urls }),
  setError: (code, message, soraPrompt) =>
    set({ stage: "ERROR", errorCode: code, errorMessage: message, soraPrompt: soraPrompt ?? null }),
  setSoraPrompt: (prompt) => set({ soraPrompt: prompt }),
  setPollResults: (results) => set({ pollResults: results }),
  setDbTaskId: (id) => set({ dbTaskId: id }),
  setFulfillmentMode: (mode) => set({ fulfillmentMode: mode }),
  setDeliveryProgress: (progress) => set({ deliveryProgress: progress }),
  setParams: (partial) => set((s) => ({ params: { ...s.params, ...partial } })),
  reset: () =>
    set({
      stage: "IDLE",
      logs: [],
      script: null,
      videoUrls: [],
      errorMessage: null,
      errorCode: null,
      soraPrompt: null,
      pollResults: [],
      dbTaskId: null,
      fulfillmentMode: "standard",
      deliveryProgress: null,
    }),
}));
