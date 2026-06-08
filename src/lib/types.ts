export type Region = {
  id: string;
  label: string;
  shortLabel: string;
  timezone: string;
};

export type ProbeStatus = "ok" | "error" | "mock";

export type ProbeResult = {
  id: string;
  regionId: string;
  regionLabel: string;
  measuredAt: string;
  ttftMs: number | null;
  status: ProbeStatus;
  model: string;
  proxyConfigured: boolean;
  error?: string;
};

export type HourlyMedian = {
  hour: string;
  ttftMs: number | null;
  sampleCount: number;
};

export type RegionMetric = {
  region: Region;
  current: ProbeResult | null;
  hourly: HourlyMedian[];
};

export type DashboardMetrics = {
  generatedAt: string;
  model: string;
  sampleCount: number;
  summaryHourly: HourlyMedian[];
  regions: RegionMetric[];
};
