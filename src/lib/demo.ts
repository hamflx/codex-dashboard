import { CODEX_MODEL } from "./config";
import { mockTtft } from "./mock";
import { getEnabledRegions } from "./regions";
import type { ProbeResult } from "./types";

export function generateDemoSamples() {
  const now = new Date();
  now.setUTCSeconds(0, 0);
  const regions = getEnabledRegions();
  const samples: ProbeResult[] = [];

  for (let offset = 0; offset < 24 * 6; offset += 1) {
    const measuredAt = new Date(now.getTime() - offset * 10 * 60 * 1000);

    for (const region of regions) {
      samples.push({
        id: `demo:${region.id}:${measuredAt.toISOString()}`,
        regionId: region.id,
        regionLabel: region.label,
        measuredAt: measuredAt.toISOString(),
        ttftMs: mockTtft(region, measuredAt),
        status: "mock",
        model: CODEX_MODEL,
        proxyConfigured: false,
      });
    }
  }

  return samples;
}
