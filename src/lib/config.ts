export const CODEX_MODEL = process.env.CODEX_MODEL || "gpt-5-codex";
export const HISTORY_HOURS = Number(process.env.TTFT_HISTORY_HOURS || 24);
export const PROBE_TIMEOUT_MS = Number(process.env.TTFT_TIMEOUT_MS || 15000);
export const PROBE_PARALLELISM = Number(process.env.TTFT_PARALLELISM || 8);
export const METRICS_CACHE_SECONDS = Number(process.env.TTFT_METRICS_CACHE_SECONDS || 60);
export const API_BASE_URL = (process.env.CODEX_API_BASE_URL || process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(
  /\/$/,
  "",
);

export function shouldUseMockProbes() {
  return process.env.TTFT_USE_MOCK === "1" || !getAuthToken();
}

export function getAuthToken() {
  return process.env.OPENAI_API_KEY || process.env.CODEX_OAUTH_ACCESS_TOKEN || null;
}

export function isCronAuthorized(authHeader: string | null) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return true;
  }

  return authHeader === `Bearer ${secret}`;
}
