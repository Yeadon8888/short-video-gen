import type { GenerateParams } from "@/stores/generate";

export interface GenerateReplayPreset {
  tab?: "theme" | "url" | "upload" | "batch";
  themeInput?: string;
  themeBrief?: string;
  urlInput?: string;
  urlBrief?: string;
  uploadUrl?: string;
  uploadName?: string;
  uploadBrief?: string;
  batchTheme?: string;
  selectedImageIds?: string[];
  batchImageIds?: string[];
  params?: Partial<GenerateParams>;
}

interface SearchParamsLike {
  get(name: string): string | null;
}

function withCsv(values: string[] | undefined): string | undefined {
  if (!values || values.length === 0) return undefined;
  return values.join(",");
}

function readCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildGenerateReplayHref(preset: GenerateReplayPreset): string {
  const searchParams = new URLSearchParams();

  if (preset.tab) searchParams.set("tab", preset.tab);
  if (preset.themeInput) searchParams.set("theme", preset.themeInput);
  if (preset.themeBrief) searchParams.set("themeBrief", preset.themeBrief);
  if (preset.urlInput) searchParams.set("url", preset.urlInput);
  if (preset.urlBrief) searchParams.set("urlBrief", preset.urlBrief);
  if (preset.uploadUrl) searchParams.set("uploadUrl", preset.uploadUrl);
  if (preset.uploadName) searchParams.set("uploadName", preset.uploadName);
  if (preset.uploadBrief) searchParams.set("uploadBrief", preset.uploadBrief);
  if (preset.batchTheme) searchParams.set("batchTheme", preset.batchTheme);

  const selectedImageIds = withCsv(preset.selectedImageIds);
  if (selectedImageIds) searchParams.set("selectedImageIds", selectedImageIds);

  const batchImageIds = withCsv(preset.batchImageIds);
  if (batchImageIds) searchParams.set("batchImageIds", batchImageIds);

  if (preset.params?.orientation) searchParams.set("orientation", preset.params.orientation);
  if (typeof preset.params?.duration === "number") {
    searchParams.set("duration", String(preset.params.duration));
  }
  if (typeof preset.params?.count === "number") {
    searchParams.set("count", String(preset.params.count));
  }
  if (preset.params?.platform) searchParams.set("platform", preset.params.platform);
  if (preset.params?.model) searchParams.set("model", preset.params.model);

  const query = searchParams.toString();
  return query ? `/generate?${query}` : "/generate";
}

export function parseGenerateReplayPreset(searchParams: SearchParamsLike): GenerateReplayPreset {
  const duration = Number(searchParams.get("duration"));
  const count = Number(searchParams.get("count"));

  return {
    tab: (searchParams.get("tab") as GenerateReplayPreset["tab"]) ?? undefined,
    themeInput: searchParams.get("theme") ?? undefined,
    themeBrief: searchParams.get("themeBrief") ?? undefined,
    urlInput: searchParams.get("url") ?? undefined,
    urlBrief: searchParams.get("urlBrief") ?? undefined,
    uploadUrl: searchParams.get("uploadUrl") ?? undefined,
    uploadName: searchParams.get("uploadName") ?? undefined,
    uploadBrief: searchParams.get("uploadBrief") ?? undefined,
    batchTheme: searchParams.get("batchTheme") ?? undefined,
    selectedImageIds: readCsv(searchParams.get("selectedImageIds")),
    batchImageIds: readCsv(searchParams.get("batchImageIds")),
    params: {
      orientation:
        searchParams.get("orientation") === "landscape" ? "landscape" : "portrait",
      duration: duration === 8 || duration === 10 || duration === 15 ? duration : undefined,
      count: Number.isFinite(count) && count > 0 ? count : undefined,
      platform:
        searchParams.get("platform") === "tiktok" ? "tiktok" : searchParams.get("platform") === "douyin" ? "douyin" : undefined,
      model: searchParams.get("model") ?? undefined,
    },
  };
}
