export const WORKSPACE_HEADER = "x-workspace-id";
const INVITE_STORAGE_KEY = "vidclaw-invite-code";

/** Valid invite codes — add new codes here to create isolated workspaces */
const VALID_INVITE_CODES = new Set(["1214"]);

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

/** Deterministic workspace ID from invite code — same code = same workspace */
export function workspaceIdFromInvite(code: string): string {
  return `invite-${code}`;
}

export function isValidInviteCode(code: string): boolean {
  return VALID_INVITE_CODES.has(code.trim());
}

export function getSavedInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(INVITE_STORAGE_KEY);
  return saved && isValidInviteCode(saved) ? saved : null;
}

export function saveInviteCode(code: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(INVITE_STORAGE_KEY, code.trim());
  }
}
