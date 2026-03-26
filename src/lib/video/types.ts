// ─── Video generation types ───

export interface VideoParams {
  prompt: string;
  imageUrls?: string[];
  orientation: "portrait" | "landscape";
  duration: 8 | 10 | 15;
  count: number;
  model?: string;
  providerOptions?: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  status: string;
  url?: string;
  failReason?: string;
}

export interface TaskStatusResult {
  taskId: string;
  status: string;
  progress: string;
  url?: string;
  failReason?: string;
}

// ─── Gemini / Script types ───

export interface Shot {
  id: number;
  scene_zh: string;
  sora_prompt: string;
  duration_s: number;
  camera: "close-up" | "wide" | "medium" | "overhead";
}

export interface ScriptResult {
  creative_points: string[];
  hook: string;
  plot_summary: string;
  shots: Shot[];
  full_sora_prompt: string;
  copy: {
    title: string;
    caption: string;
    first_comment: string;
  };
}

export type GenerateSourceMode = "theme" | "url" | "upload" | "batch";
export type ImageSelectionMode = "single" | "sequence";

export interface SelectedAssetSnapshot {
  id: string;
  url: string;
  filename?: string | null;
}

export interface GenerateInputSnapshot {
  sourceMode: GenerateSourceMode;
  primaryInput?: string;
  creativeBrief?: string;
  batchTheme?: string;
  selectionMode?: ImageSelectionMode;
  selectedImageIds?: string[];
  selectedAssets?: SelectedAssetSnapshot[];
  assignedAssetId?: string;
  assignedAssetIndex?: number;
  batchRunId?: string;
  batchIndex?: number;
  batchTotal?: number;
}

export interface TaskParamsSnapshot {
  orientation: "portrait" | "landscape";
  duration: 8 | 10 | 15;
  count: number;
  platform: "douyin" | "tiktok";
  model: string;
  imageUrls?: string[];
  sourceMode?: GenerateSourceMode;
  creativeBrief?: string;
  batchTheme?: string;
  selectionMode?: ImageSelectionMode;
  selectedImageIds?: string[];
  selectedAssets?: SelectedAssetSnapshot[];
  assignedAssetId?: string;
  assignedAssetIndex?: number;
  batchRunId?: string;
  batchIndex?: number;
  batchTotal?: number;
}

// ─── API request / SSE types ───

export interface GenerateRequest {
  type: "theme" | "video_key" | "url";
  input: string;
  modification?: string;
  creativeBrief?: string;
  sourceMode?: Exclude<GenerateSourceMode, "batch">;
  selectedImageIds?: string[];
  /** When true, task is saved as "scheduled" for later execution */
  scheduled?: boolean;
  params: {
    orientation: "portrait" | "landscape";
    duration: 8 | 10 | 15;
    count: number;
    platform?: "douyin" | "tiktok";
    model?: string;
  };
}

export interface BatchGenerateRequest {
  sourceMode: "batch";
  batchTheme: string;
  selectedImageIds: string[];
  selectionMode: ImageSelectionMode;
  params: {
    orientation: "portrait" | "landscape";
    duration: 8 | 10 | 15;
    count: number;
    platform?: "douyin" | "tiktok";
    model?: string;
  };
}

export type SSEEventType =
  | "log"
  | "stage"
  | "script"
  | "tasks"
  | "videos"
  | "error"
  | "done";

export interface SSEEvent {
  type: SSEEventType;
  [key: string]: unknown;
}

// ─── Storage types ───

export interface StoredAsset {
  key: string;
  url: string;
  size?: number;
  uploadedAt?: string;
}

export interface WorkspacePrompts {
  video_remix_base?: string;
  video_remix_with_modification?: string;
  theme_to_video?: string;
  copy_generation?: string;
}
