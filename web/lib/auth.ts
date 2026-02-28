import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "session";
const SESSION_TTL_DAYS = 7;

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  code: string;
  name: string;
}

/** Parse INVITE_CODES env: "ABC123:Alice,DEF456:Bob" → Map */
export function getInviteCodes(): Map<string, string> {
  const raw = process.env.INVITE_CODES ?? "";
  const map = new Map<string, string>();
  for (const entry of raw.split(",")) {
    const [code, name] = entry.trim().split(":");
    if (code && name) map.set(code.trim().toUpperCase(), name.trim());
  }
  return map;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ code: payload.code, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { code: payload.code as string, name: payload.name as string };
  } catch {
    return null;
  }
}

/** Read session from HttpOnly cookie (server component / route handler) */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export { COOKIE_NAME, SESSION_TTL_DAYS };
