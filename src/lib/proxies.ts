import type { Region } from "./types";

function envKeyForRegion(regionId: string) {
  return `TTFT_PROXY_${regionId.replace(/-/g, "_").toUpperCase()}`;
}

function parseProxyJson() {
  const raw = process.env.TTFT_PROXY_JSON;

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getProxyUrl(region: Region) {
  const byJson = parseProxyJson();
  return process.env[envKeyForRegion(region.id)] || byJson[region.id] || null;
}
