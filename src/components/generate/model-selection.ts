import type { VideoDuration } from "@/lib/video/types";

export interface GenerateModelOption {
  slug: string;
  name: string;
  provider: string;
  creditsPerGen: number;
  allowedDurations: VideoDuration[];
  defaultDuration: VideoDuration;
}

export interface GenerateParamSnapshot {
  model: string;
  duration: VideoDuration;
}

export function resolveModelSelectionPatch(
  modelOptions: GenerateModelOption[],
  params: GenerateParamSnapshot,
): Partial<GenerateParamSnapshot> | null {
  if (modelOptions.length === 0) return null;

  const currentModel =
    modelOptions.find((model) => model.slug === params.model) ?? modelOptions[0];

  if (currentModel.slug !== params.model) {
    return {
      model: currentModel.slug,
      duration: currentModel.defaultDuration,
    };
  }

  if (!currentModel.allowedDurations.includes(params.duration)) {
    return {
      duration: currentModel.defaultDuration,
    };
  }

  return null;
}
