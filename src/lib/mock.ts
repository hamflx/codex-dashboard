import type { Region } from "./types";

const BASELINES: Record<string, number> = {
  "hong-kong": 850,
  taiwan: 910,
  singapore: 980,
  japan: 1050,
  "united-states": 1380,
  canada: 1510,
  "united-kingdom": 1660,
  germany: 1710,
  netherlands: 1680,
  italy: 1840,
  spain: 1880,
  turkey: 2100,
  australia: 1760,
  argentina: 2380,
  brazil: 2250,
  chile: 2310,
  korea: 1120,
  india: 1450,
  israel: 1980,
  thailand: 1180,
  vietnam: 1210,
  malaysia: 1080,
  "south-africa": 2460,
};

function stableHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function mockTtft(region: Region, measuredAt: Date) {
  const baseline = BASELINES[region.id] ?? 1500;
  const hourWave = Math.sin((measuredAt.getUTCHours() / 24) * Math.PI * 2) * 120;
  const jitter = stableHash(`${region.id}:${Math.floor(measuredAt.getTime() / 600000)}`) % 360;
  return Math.max(120, Math.round(baseline + hourWave + jitter - 180));
}
