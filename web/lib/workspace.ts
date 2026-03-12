export const WORKSPACE_HEADER = "x-workspace-id";
const STORAGE_KEY = "vidclaw-workspace-id";

export function normalizeWorkspaceId(value: string | null | undefined): string | null {
  const cleaned = (value ?? "").trim();
  if (!cleaned) {
    return null;
  }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function getWorkspaceIdFromHeaders(headers: Headers): string {
  return normalizeWorkspaceId(headers.get(WORKSPACE_HEADER)) ?? crypto.randomUUID().replace(/-/g, "");
}

export function getBrowserWorkspaceId(): string {
  if (typeof window === "undefined") {
    throw new Error("Workspace ID is only available in the browser");
  }

  const existing = normalizeWorkspaceId(window.localStorage.getItem(STORAGE_KEY));
  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID().replace(/-/g, "");
  window.localStorage.setItem(STORAGE_KEY, created);
  return created;
}
