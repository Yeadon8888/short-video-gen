/**
 * Next.js Instrumentation — runs once when the server starts.
 * Sets up a global HTTP proxy dispatcher so that server-side `fetch()`
 * respects the local proxy (e.g. Clash on 127.0.0.1:7897).
 *
 * Only activates when `https_proxy` or `HTTPS_PROXY` env var is set.
 * Has no effect in the browser or on Vercel (where no proxy is needed).
 */
export async function register() {
  // Only run in Node.js runtime, not edge
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const proxyUrl =
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY;

  if (proxyUrl && typeof globalThis.fetch !== "undefined") {
    try {
      // Use require() to prevent webpack from statically analyzing undici imports
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const undici = require("undici") as typeof import("undici");
      undici.setGlobalDispatcher(new undici.ProxyAgent(proxyUrl));
      console.log(`[instrumentation] Global fetch proxy → ${proxyUrl}`);
    } catch {
      // undici not installed or incompatible — skip silently
    }
  }
}
