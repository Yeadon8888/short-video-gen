export const MODEL_CAPABILITIES = {
  videoGeneration: "video_generation",
  imageEdit: "image_edit",
  scriptGeneration: "script_generation",
} as const;

export type ModelCapability =
  | typeof MODEL_CAPABILITIES.videoGeneration
  | typeof MODEL_CAPABILITIES.imageEdit
  | typeof MODEL_CAPABILITIES.scriptGeneration;

export const MODEL_CAPABILITY_LABELS: Record<ModelCapability, string> = {
  [MODEL_CAPABILITIES.videoGeneration]: "视频生成",
  [MODEL_CAPABILITIES.imageEdit]: "图片编辑",
  [MODEL_CAPABILITIES.scriptGeneration]: "脚本分析",
};

export function isModelCapability(value: unknown): value is ModelCapability {
  return (
    value === MODEL_CAPABILITIES.videoGeneration ||
    value === MODEL_CAPABILITIES.imageEdit ||
    value === MODEL_CAPABILITIES.scriptGeneration
  );
}

export function getModelCapabilityLabel(capability: ModelCapability): string {
  return MODEL_CAPABILITY_LABELS[capability];
}
