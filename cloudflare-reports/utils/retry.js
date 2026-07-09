// utils/retry.js
// Shared fetch wrapper for every outbound API call (Beehiiv, Airtable, Slack webhook).
// Retries transient failures (network errors, 429, 5xx); never retries other 4xx since
// those are non-transient (bad auth, bad params) and retrying just burns CPU budget.

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} url
 * @param {RequestInit} [fetchOptions]
 * @param {{attempts?: number, baseDelayMs?: number, timeoutMs?: number}} [retryOptions]
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, fetchOptions = {}, retryOptions = {}) {
  const { attempts = 3, baseDelayMs = 500, timeoutMs = 10000 } = retryOptions;
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) return res;
      if (!RETRYABLE_STATUS.has(res.status) || attempt === attempts - 1) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt === attempts - 1) throw lastError;
    }
    const backoff = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
    await sleep(backoff);
  }
  throw lastError;
}
