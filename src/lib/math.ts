import type { HourlyMedian, ProbeResult } from "./types";

export function median(values: number[]) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export function floorToHour(isoDate: string) {
  const date = new Date(isoDate);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

export function lastHours(hours: number, now = new Date()) {
  const end = new Date(now);
  end.setUTCMinutes(0, 0, 0);

  return Array.from({ length: hours }, (_, index) => {
    const hour = new Date(end);
    hour.setUTCHours(end.getUTCHours() - (hours - index - 1));
    return hour.toISOString();
  });
}

export function hourlyMedians(samples: ProbeResult[], hours = 24): HourlyMedian[] {
  const buckets = new Map<string, number[]>();

  for (const sample of samples) {
    if (typeof sample.ttftMs !== "number") {
      continue;
    }

    const hour = floorToHour(sample.measuredAt);
    const bucket = buckets.get(hour) ?? [];
    bucket.push(sample.ttftMs);
    buckets.set(hour, bucket);
  }

  return lastHours(hours).map((hour) => {
    const values = buckets.get(hour) ?? [];
    return {
      hour,
      ttftMs: median(values),
      sampleCount: values.length,
    };
  });
}

export function formatDuration(ms: number | null) {
  if (ms === null) {
    return "--";
  }

  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }

  return `${(ms / 1000).toFixed(2)} s`;
}
