import type { GenerateSourceMode } from "@/lib/video/types";

export type GenerateTab = GenerateSourceMode;

export interface GenerateTabConfig {
  id: GenerateTab;
  title: string;
  description: string;
}

export interface PendingVideo {
  url: string;
  name: string;
  sizeMB: string;
}

export interface BatchSummary {
  taskGroupId: string;
  createdCount: number;
  failedCount: number;
  taskIds: string[];
  errors: Array<{ index: number; message: string }>;
}

export const GENERATE_TABS: GenerateTabConfig[] = [
  { id: "theme", title: "主题原创", description: "从 0 到 1 生成单条带货视频" },
  { id: "url", title: "链接二创", description: "拆解爆款链接，再结合你的产品图重做" },
  { id: "upload", title: "上传视频二创", description: "上传本地视频，再加你的创意补充" },
  { id: "batch", title: "批量带货", description: "同一份创意主题，批量为多张产品图出片" },
];

export const GENERATE_SOURCE_LABELS: Record<GenerateTab, string> = {
  theme: "主题原创",
  url: "链接二创",
  upload: "上传视频二创",
  batch: "批量带货",
};
