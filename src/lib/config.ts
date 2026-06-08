export const CODEX_MODEL = process.env.CODEX_MODEL || "gpt-5-codex";
export const HISTORY_HOURS = Number(process.env.TTFT_HISTORY_HOURS || 24);
export const PROBE_TIMEOUT_MS = Number(process.env.TTFT_TIMEOUT_MS || 15000);
export const PROBE_PARALLELISM = Number(process.env.TTFT_PARALLELISM || 8);

export function shouldUseMockProbes() {
  return process.env.TTFT_USE_MOCK === "1" || !process.env.OPENAI_API_KEY;
}

export function isCronAuthorized(authHeader: string | null) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return true;
  }

  return authHeader === `Bearer ${secret}`;
}
