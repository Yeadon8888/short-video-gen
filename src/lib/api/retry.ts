/**
 * Shared retry logic for external API calls.
 * Handles 429 rate limiting and 5xx server errors with exponential backoff.
 */

export interface RetryConfig {
  /** Maximum attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay for 429 in ms (default: 15000). Actual delay = base * attempt. */
  rateLimitDelayMs?: number;
  /** Base delay for 5xx in ms (default: 5000). Actual delay = base * attempt. */
  serverErrorDelayMs?: number;
}

/**
 * Execute a fetch-like function with automatic retry on 429 / 5xx.
 *
 * @param fn - Function that performs the request. Must return a Response.
 * @param config - Retry configuration.
 * @returns The successful Response.
 * @throws The last error if all attempts fail.
 */
export async function fetchWithRetry(
  fn: () => Promise<Response>,
  config?: RetryConfig,
): Promise<Response> {
  const maxAttempts = config?.maxAttempts ?? 3;
  const rateLimitDelay = config?.rateLimitDelayMs ?? 15_000;
  const serverErrorDelay = config?.serverErrorDelayMs ?? 5_000;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fn();

    if (response.status === 429 && attempt < maxAttempts - 1) {
      await new Promise((r) =>
        setTimeout(r, rateLimitDelay * (attempt + 1)),
      );
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      lastError = new Error(
        `HTTP ${response.status}: ${text.slice(0, 200)}`,
      );
      if (attempt < maxAttempts - 1 && response.status >= 500) {
        await new Promise((r) =>
          setTimeout(r, serverErrorDelay * (attempt + 1)),
        );
        continue;
      }
      throw lastError;
    }

    return response;
  }

  throw lastError ?? new Error("Request failed after retries");
}
