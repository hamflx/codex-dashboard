import { CODEX_MODEL, HISTORY_HOURS } from "./config";
import { hourlyMedians } from "./math";
import { getEnabledRegions } from "./regions";
import type { DashboardMetrics, ProbeResult } from "./types";

function byNewestFirst(a: ProbeResult, b: ProbeResult) {
  return new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime();
}

function byCurrentLatency(a: DashboardMetrics["regions"][number], b: DashboardMetrics["regions"][number]) {
  const aValue = a.current?.ttftMs ?? Number.POSITIVE_INFINITY;
  const bValue = b.current?.ttftMs ?? Number.POSITIVE_INFINITY;

  if (aValue !== bValue) {
    return aValue - bValue;
  }

  return a.region.label.localeCompare(b.region.label);
}

export function buildDashboardMetrics(samples: ProbeResult[]): DashboardMetrics {
  const regions = getEnabledRegions();
  const sortedSamples = [...samples].sort(byNewestFirst);

  const regionMetrics = regions
    .map((region) => {
      const regionSamples = sortedSamples.filter((sample) => sample.regionId === region.id);

      return {
        region,
        current: regionSamples[0] ?? null,
        hourly: hourlyMedians(regionSamples, HISTORY_HOURS),
      };
    })
    .sort(byCurrentLatency);

  return {
    generatedAt: new Date().toISOString(),
    model: sortedSamples[0]?.model ?? CODEX_MODEL,
    sampleCount: samples.length,
    summaryHourly: hourlyMedians(sortedSamples, HISTORY_HOURS),
    regions: regionMetrics,
  };
}
