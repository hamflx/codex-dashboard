export const CODEX_MODEL = process.env.CODEX_MODEL || "gpt-5.5";
export const HISTORY_HOURS = Number(process.env.TTFT_HISTORY_HOURS || 24);
export const PROBE_TIMEOUT_MS = Number(process.env.TTFT_TIMEOUT_MS || 15000);
export const PROBE_PARALLELISM = Number(process.env.TTFT_PARALLELISM || 8);
export const METRICS_CACHE_SECONDS = Number(process.env.TTFT_METRICS_CACHE_SECONDS || 60);
export const OPENAI_API_BASE_URL = (process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
export const CODEX_OAUTH_BASE_URL = (process.env.CODEX_OAUTH_BASE_URL || "https://chatgpt.com/backend-api/codex").replace(
  /\/$/,
  "",
);
export const CODEX_OAUTH_CLIENT_ID = process.env.CODEX_OAUTH_CLIENT_ID || "app_EMoamEEZ73f0CkXaXp7hrann";

export type ProbeAuthMode = "oauth" | "api-key";

export function hasProbeAuth() {
  return Boolean(process.env.CODEX_OAUTH_ACCESS_TOKEN || process.env.CODEX_OAUTH_REFRESH_TOKEN || process.env.OPENAI_API_KEY);
}

export function shouldUseMockProbes() {
  return process.env.TTFT_USE_MOCK === "1" || !hasProbeAuth();
}

export function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || null;
}

export function getOAuthAccessToken() {
  return process.env.CODEX_OAUTH_ACCESS_TOKEN || null;
}

export function getOAuthRefreshToken() {
  return process.env.CODEX_OAUTH_REFRESH_TOKEN || null;
}

export function getOAuthAccountId() {
  return process.env.CODEX_OAUTH_ACCOUNT_ID || null;
}

export function getResponsesBaseUrl(mode: ProbeAuthMode) {
  return mode === "oauth" ? CODEX_OAUTH_BASE_URL : OPENAI_API_BASE_URL;
}

export function isCronAuthorized(authHeader: string | null) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return true;
  }

  return authHeader === `Bearer ${secret}`;
}
