import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

export interface StoredAsset {
  key: string;
  url: string;
  size?: number;
  uploadedAt?: string;
}

const execFileAsync = promisify(execFile);

interface UploadGatewayConfig {
  baseUrl: string;
  apiKey: string;
  prefix: string;
}

function getConfig(): UploadGatewayConfig | null {
  const baseUrl = process.env.UPLOAD_API_URL?.trim().replace(/\/+$/, "") ?? "";
  const apiKey = process.env.UPLOAD_API_KEY?.trim() ?? "";
  const prefix = (process.env.UPLOAD_PREFIX?.trim() ?? "vidclaw-assets").replace(/^\/+|\/+$/g, "");

  if (!baseUrl || !apiKey) {
    return null;
  }

  return { baseUrl, apiKey, prefix };
}

function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  const ext = parts.length > 1 ? parts.pop() : "bin";
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : "bin";
}

function isVideoContentType(contentType: string): boolean {
  return contentType.startsWith("video/");
}

export function isUploadGatewayEnabled(): boolean {
  return getConfig() !== null;
}

function shouldPreferCurl(): boolean {
  const raw = process.env.UPLOAD_USE_CURL ?? "0";
  return raw === "1" || raw.toLowerCase() === "true";
}

async function requestJson<T>(params: {
  method: "GET" | "POST" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: ArrayBuffer;
  timeoutSeconds?: number;
}): Promise<T> {
  if (!shouldPreferCurl()) {
    const response = await fetch(params.url, {
      method: params.method,
      headers: params.headers,
      body: params.body,
      signal: AbortSignal.timeout((params.timeoutSeconds ?? 60) * 1000),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  }

  const curlArgs = [
    "-sS",
    "-L",
    "--max-time",
    String(params.timeoutSeconds ?? 60),
    "-X",
    params.method,
  ];

  for (const [key, value] of Object.entries(params.headers)) {
    curlArgs.push("-H", `${key}: ${value}`);
  }

  let tempFilePath: string | null = null;
  if (params.body) {
    tempFilePath = join(tmpdir(), `vidclaw-upload-${crypto.randomUUID()}`);
    await fs.writeFile(tempFilePath, Buffer.from(params.body));
    curlArgs.push("--data-binary", `@${tempFilePath}`);
  }

  curlArgs.push("-w", "\n__HTTP_STATUS__:%{http_code}", params.url);

  try {
    const { stdout } = await execFileAsync("curl", curlArgs, {
      maxBuffer: 10 * 1024 * 1024,
    });
    const marker = "\n__HTTP_STATUS__:";
    const index = stdout.lastIndexOf(marker);
    const rawBody = index >= 0 ? stdout.slice(0, index) : stdout;
    const rawStatus = index >= 0 ? stdout.slice(index + marker.length).trim() : "200";

    if (!rawStatus.startsWith("2")) {
      throw new Error(`HTTP ${rawStatus}: ${rawBody.slice(0, 200)}`);
    }

    return JSON.parse(rawBody) as T;
  } finally {
    if (tempFilePath) {
      await fs.rm(tempFilePath, { force: true });
    }
  }
}

function buildWorkspacePrefix(config: UploadGatewayConfig, workspaceId: string): string {
  return `${config.prefix}/${workspaceId}`;
}

export async function listAssets(workspaceId: string): Promise<StoredAsset[]> {
  const config = getConfig();
  if (!config) {
    return [];
  }

  const prefix = buildWorkspacePrefix(config, workspaceId);
  const data = await requestJson<{ assets?: StoredAsset[] }>({
    method: "GET",
    url: `${config.baseUrl}/list?prefix=${encodeURIComponent(prefix)}`,
    headers: {
      "x-upload-key": config.apiKey,
      Accept: "application/json",
    },
  });
  return data.assets ?? [];
}

export async function uploadAsset(params: {
  workspaceId: string;
  filename: string;
  data: ArrayBuffer;
  contentType: string;
}): Promise<StoredAsset> {
  const config = getConfig();
  if (!config) {
    throw new Error("UPLOAD_API_URL or UPLOAD_API_KEY is not set");
  }

  const key = `${buildWorkspacePrefix(config, params.workspaceId)}/img-${crypto.randomUUID()}.${getExtension(params.filename)}`;
  const result = await requestJson<StoredAsset & { success?: boolean }>({
    method: "POST",
    url: `${config.baseUrl}/upload?key=${encodeURIComponent(key)}`,
    headers: {
      "x-upload-key": config.apiKey,
      "Content-Type": params.contentType || "application/octet-stream",
    },
    body: params.data,
    timeoutSeconds: 120,
  });
  return {
    key: result.key,
    url: result.url,
    size: result.size,
    uploadedAt: result.uploadedAt,
  };
}

export async function deleteAsset(workspaceId: string, key: string): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    throw new Error("UPLOAD_API_URL or UPLOAD_API_KEY is not set");
  }

  const prefix = `${buildWorkspacePrefix(config, workspaceId)}/`;
  if (!key.startsWith(prefix)) {
    throw new Error("Asset key does not belong to this workspace");
  }

  await requestJson<{ ok?: boolean }>({
    method: "DELETE",
    url: `${config.baseUrl}/files/${encodeKey(key)}`,
    headers: {
      "x-upload-key": config.apiKey,
      Accept: "application/json",
    },
  });

  return true;
}

/**
 * Upload a video file to the gateway (supports larger payloads).
 * Returns the stored asset with a public URL.
 */
export async function uploadVideo(params: {
  workspaceId: string;
  filename: string;
  data: ArrayBuffer;
  contentType: string;
}): Promise<StoredAsset> {
  const config = getConfig();
  if (!config) {
    throw new Error("UPLOAD_API_URL or UPLOAD_API_KEY is not set");
  }

  const ext = getExtension(params.filename);
  const key = `${buildWorkspacePrefix(config, params.workspaceId)}/vid-${crypto.randomUUID()}.${ext}`;
  const result = await requestJson<StoredAsset & { success?: boolean }>({
    method: "POST",
    url: `${config.baseUrl}/upload?key=${encodeURIComponent(key)}`,
    headers: {
      "x-upload-key": config.apiKey,
      "Content-Type": params.contentType || "video/mp4",
    },
    body: params.data,
    timeoutSeconds: 180,
  });
  return {
    key: result.key,
    url: result.url,
    size: result.size,
    uploadedAt: result.uploadedAt,
  };
}

/**
 * Download an asset from its public URL and return the raw bytes
 * along with its MIME type. Used to fetch videos for Gemini analysis.
 */
export async function fetchAssetBuffer(url: string): Promise<{
  buffer: ArrayBuffer;
  mimeType: string;
}> {
  if (shouldPreferCurl()) {
    const tmpPath = join(tmpdir(), `fetch-asset-${Date.now()}`);
    try {
      const { stdout } = await execFileAsync("curl", [
        "-sS", "-L", "--fail", "--max-time", "120",
        "-o", tmpPath,
        "-w", "%{content_type}",
        url,
      ], { maxBuffer: 200 * 1024 * 1024 });
      const ct = (stdout.trim() || "application/octet-stream").split(";")[0].trim();
      const data = await fs.readFile(tmpPath);
      return { buffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), mimeType: ct };
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }
  }

  const res = await fetch(url, {
    signal: AbortSignal.timeout(120_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch asset: HTTP ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  const ct = res.headers.get("content-type") ?? "application/octet-stream";
  return { buffer, mimeType: ct.split(";")[0].trim() };
}

// ── Per-workspace custom prompts (stored as JSON on R2) ──

export interface WorkspacePrompts {
  video_remix_base?: string;
  video_remix_with_modification?: string;
  theme_to_video?: string;
  copy_generation?: string;
}

const PROMPTS_FILENAME = "prompts.json";

export async function loadWorkspacePrompts(workspaceId: string): Promise<WorkspacePrompts> {
  const config = getConfig();
  if (!config) return {};

  const key = `${buildWorkspacePrefix(config, workspaceId)}/${PROMPTS_FILENAME}`;
  const url = `${config.baseUrl}/files/${encodeKey(key)}`;

  try {
    const result = await fetchAssetBuffer(url);
    const text = new TextDecoder().decode(result.buffer);
    return JSON.parse(text) as WorkspacePrompts;
  } catch {
    // File doesn't exist or invalid JSON → return empty (use defaults)
    return {};
  }
}

export async function saveWorkspacePrompts(
  workspaceId: string,
  prompts: WorkspacePrompts
): Promise<void> {
  const config = getConfig();
  if (!config) throw new Error("Upload gateway not configured");

  const key = `${buildWorkspacePrefix(config, workspaceId)}/${PROMPTS_FILENAME}`;
  const body = new TextEncoder().encode(JSON.stringify(prompts, null, 2));

  await requestJson<{ success?: boolean }>({
    method: "POST",
    url: `${config.baseUrl}/upload?key=${encodeURIComponent(key)}`,
    headers: {
      "x-upload-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    timeoutSeconds: 30,
  });
}
