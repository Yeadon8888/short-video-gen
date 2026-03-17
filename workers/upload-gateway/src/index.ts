interface Env {
  ASSETS_BUCKET: R2Bucket;
  UPLOAD_API_KEY: string;
  UPLOAD_PREFIX?: string;
  PUBLIC_BASE_URL?: string;
  MAX_UPLOAD_BYTES?: string;
  /** Comma-separated allowed origins, e.g. "https://vidclaw.com,https://app.vidclaw.com" */
  ALLOWED_ORIGINS?: string;
}

function getAllowedOrigins(env: Env): Set<string> {
  const raw = env.ALLOWED_ORIGINS?.trim();
  if (!raw) return new Set(); // empty = restrict to no browser origin (API-key only)
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = getAllowedOrigins(env);

  // If ALLOWED_ORIGINS is configured and origin matches, reflect it
  // If ALLOWED_ORIGINS is not set, don't include Access-Control-Allow-Origin (server-to-server only)
  const headers: Record<string, string> = {
    "access-control-allow-methods": "GET,HEAD,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type,X-Upload-Key",
    "access-control-max-age": "86400",
  };

  if (allowed.size > 0 && allowed.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "Origin";
  }

  return headers;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json(
        {
          service: "vidclaw-upload-gateway",
          upload: "POST /upload?key=<object-key>",
          list: "GET /list?prefix=<object-prefix>",
          file: "GET /files/<object-key>",
          delete: "DELETE /files/<object-key>",
          health: "GET /healthz",
        },
        200,
      );
    }

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ ok: true, timestamp: new Date().toISOString() }, 200);
    }

    if (request.method === "POST" && url.pathname === "/upload") {
      return handleUpload(request, env, url, corsHeaders);
    }

    if (request.method === "GET" && url.pathname === "/list") {
      return handleList(request, env, url, corsHeaders);
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/files/")) {
      return handleGetFile(request, env, url, corsHeaders);
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/files/")) {
      return handleDelete(request, env, url, corsHeaders);
    }

    return json({ error: "Not found" }, 404, corsHeaders);
  },
};

async function handleUpload(request: Request, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  const authError = authorize(request, env, corsHeaders);
  if (authError) {
    return authError;
  }

  const contentLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  const maxUploadBytes = Number.parseInt(env.MAX_UPLOAD_BYTES ?? "15728640", 10);
  if (Number.isFinite(contentLength) && contentLength > maxUploadBytes) {
    return json({ error: "Payload too large", maxUploadBytes }, 413, corsHeaders);
  }

  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const key = normalizeKey(url.searchParams.get("key"), env.UPLOAD_PREFIX, contentType);
  if (!key) {
    return json({ error: "Invalid object key" }, 400, corsHeaders);
  }
  if (!request.body) {
    return json({ error: "Missing request body" }, 400, corsHeaders);
  }

  const uploadedAt = new Date().toISOString();
  const object = await env.ASSETS_BUCKET.put(key, request.body, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      uploadedAt,
      source: "vidclaw-upload-gateway",
    },
  });

  return json(
    {
      success: true,
      key,
      size: object?.size ?? contentLength,
      uploadedAt,
      url: buildPublicUrl(url, env, key),
      contentType,
    },
    200,
    corsHeaders,
  );
}

async function handleList(request: Request, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  const authError = authorize(request, env, corsHeaders);
  if (authError) {
    return authError;
  }

  const prefix = normalizePrefix(url.searchParams.get("prefix"), env.UPLOAD_PREFIX);
  if (!prefix) {
    return json({ error: "Invalid prefix" }, 400, corsHeaders);
  }

  const listed = await env.ASSETS_BUCKET.list({ prefix });
  const assets = listed.objects
    .map((object) => ({
      key: object.key,
      url: buildPublicUrl(url, env, object.key),
      size: object.size,
      uploadedAt: object.customMetadata?.uploadedAt || object.uploaded?.toISOString() || "",
    }))
    .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));

  return json({ assets }, 200, corsHeaders);
}

async function handleGetFile(request: Request, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  const key = decodeURIComponent(url.pathname.replace(/^\/files\//, ""));
  if (!key || key.includes("..") || key.startsWith("/")) {
    return json({ error: "Invalid key" }, 400, corsHeaders);
  }

  // Restrict access to files under the configured prefix only
  const prefix = (env.UPLOAD_PREFIX ?? "vidclaw-assets").replace(/^\/+|\/+$/g, "");
  if (!key.startsWith(prefix + "/")) {
    return json({ error: "Access denied" }, 403, corsHeaders);
  }

  const object = await env.ASSETS_BUCKET.get(key);
  if (!object) {
    return json({ error: "File not found" }, 404, corsHeaders);
  }

  const headers = new Headers(corsHeaders);
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  // Prevent browsers from executing uploaded files (XSS via SVG/HTML)
  headers.set("content-disposition", "inline");
  headers.set("x-content-type-options", "nosniff");

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers });
  }

  return new Response(object.body, { status: 200, headers });
}

async function handleDelete(request: Request, env: Env, url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  const authError = authorize(request, env, corsHeaders);
  if (authError) {
    return authError;
  }

  const key = url.pathname.replace(/^\/files\//, "");
  if (!key || key.includes("..")) {
    return json({ error: "Invalid key" }, 400, corsHeaders);
  }

  await env.ASSETS_BUCKET.delete(key);
  return json({ ok: true, key }, 200, corsHeaders);
}

function authorize(request: Request, env: Env, corsHeaders: Record<string, string>): Response | null {
  const expectedKey = env.UPLOAD_API_KEY?.trim();
  const providedKey = request.headers.get("x-upload-key")?.trim() ?? "";
  if (!expectedKey || providedKey !== expectedKey) {
    return json({ error: "Unauthorized" }, 401, corsHeaders);
  }
  return null;
}

function normalizePrefix(rawPrefix: string | null, fallbackPrefix: string | undefined): string | null {
  const raw = (rawPrefix ?? "").trim().replace(/^\/+|\/+$/g, "");
  const fallback = (fallbackPrefix ?? "vidclaw-assets").trim().replace(/^\/+|\/+$/g, "");
  const candidate = raw || fallback;

  if (!candidate || candidate.includes("..")) {
    return null;
  }

  return candidate
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[^A-Za-z0-9._-]/g, "-"))
    .join("/");
}

function normalizeKey(rawKey: string | null, prefix: string | undefined, contentType: string): string | null {
  const cleanPrefix = normalizePrefix(prefix, "vidclaw-assets");
  if (!cleanPrefix) {
    return null;
  }

  let key = (rawKey ?? "").trim().replace(/^\/+/, "");
  if (!key) {
    const extension = extensionFromContentType(contentType);
    key = `${cleanPrefix}/uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
  } else if (!key.startsWith(`${cleanPrefix}/`)) {
    key = `${cleanPrefix}/${key}`;
  }

  if (key.includes("..") || key.startsWith("/")) {
    return null;
  }

  return key
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[^A-Za-z0-9._-]/g, "-"))
    .join("/");
}

function extensionFromContentType(contentType: string): string {
  if (contentType.includes("jpeg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("mp4")) return ".mp4";
  if (contentType.includes("quicktime")) return ".mov";
  if (contentType.includes("webm")) return ".webm";
  return ".bin";
}

function buildPublicUrl(url: URL, env: Env, key: string): string {
  const base = (env.PUBLIC_BASE_URL || url.origin).replace(/\/+$/, "");
  return `${base}/files/${encodePath(key)}`;
}

function encodePath(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function json(payload: unknown, status: number, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders,
    },
  });
}
