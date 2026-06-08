"use client";

import { Activity, AlertTriangle, Clock3, Database, Gauge, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatDuration } from "@/lib/math";
import type { DashboardMetrics, RegionMetric } from "@/lib/types";
import Sparkline from "./sparkline";

type DashboardProps = {
  initialMetrics: DashboardMetrics;
};

function relativeTime(isoDate: string | null | undefined) {
  if (!isoDate) {
    return "no sample";
  }

  const seconds = Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  return `${Math.round(minutes / 60)}h ago`;
}

function statusLabel(region: RegionMetric) {
  if (!region.current) {
    return "pending";
  }

  if (region.current.status === "ok") {
    return region.current.proxyConfigured ? "live" : "direct";
  }

  return region.current.status;
}

function percentile(values: number[], ratio: number) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

export default function Dashboard({ initialMetrics }: DashboardProps) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(new Date().toISOString());
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/metrics", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Metrics request failed with ${response.status}`);
      }

      setMetrics((await response.json()) as DashboardMetrics);
      setLastUpdatedAt(new Date().toISOString());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh();
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  const currentValues = useMemo(
    () =>
      metrics.regions
        .map((region) => region.current?.ttftMs)
        .filter((value): value is number => typeof value === "number"),
    [metrics.regions],
  );

  const fastest = currentValues.length ? Math.min(...currentValues) : null;
  const slowest = currentValues.length ? Math.max(...currentValues) : null;
  const p90 = percentile(currentValues, 0.9);
  const latestProbeAt = metrics.regions.map((region) => region.current?.measuredAt).filter(Boolean).sort().at(-1);
  const mockCount = metrics.regions.filter((region) => region.current?.status === "mock").length;
  const errorCount = metrics.regions.filter((region) => region.current?.status === "error").length;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Codex TTFT Monitor</p>
          <h1>Regional latency board</h1>
        </div>
        <div className="header-actions">
          <div className="clock-pill">
            <Clock3 size={16} aria-hidden="true" />
            <span>{relativeTime(latestProbeAt)}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh metrics">
            <RefreshCw size={18} className={loading ? "spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="summary-band" aria-label="Summary hourly TTFT median">
        <div className="summary-copy">
          <div className="summary-title-row">
            <Gauge size={22} aria-hidden="true" />
            <h2>Hourly median TTFT</h2>
          </div>
          <div className="summary-stats">
            <div>
              <span>Fastest</span>
              <strong>{formatDuration(fastest)}</strong>
            </div>
            <div>
              <span>P90</span>
              <strong>{formatDuration(p90)}</strong>
            </div>
            <div>
              <span>Slowest</span>
              <strong>{formatDuration(slowest)}</strong>
            </div>
            <div>
              <span>Regions</span>
              <strong>{metrics.regions.length}</strong>
            </div>
          </div>
        </div>
        <div className="summary-chart">
          <Sparkline data={metrics.summaryHourly} height={168} strokeWidth={3} label="Global hourly median TTFT" />
        </div>
      </section>

      <section className="meta-row" aria-label="Monitor status">
        <div className="meta-item">
          <Activity size={16} aria-hidden="true" />
          <span>{metrics.model}</span>
        </div>
        <div className="meta-item">
          <Database size={16} aria-hidden="true" />
          <span>{metrics.sampleCount.toLocaleString()} samples</span>
        </div>
        <div className={errorCount ? "meta-item warn" : "meta-item"}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{errorCount} errors</span>
        </div>
        <div className={mockCount ? "meta-item mock" : "meta-item"}>
          <span>{mockCount ? "mock mode active" : "live probes"}</span>
        </div>
        <div className="meta-item push-right">
          <span>UI refreshed {relativeTime(lastUpdatedAt)}</span>
        </div>
      </section>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="region-grid" aria-label="Regions sorted by current TTFT">
        {metrics.regions.map((region, index) => (
          <article className="region-card" key={region.region.id}>
            <div className="region-card-header">
              <div className="rank">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <h3>{region.region.label}</h3>
                <p>{region.region.shortLabel}</p>
              </div>
              <span className={`status-badge status-${statusLabel(region)}`}>{statusLabel(region)}</span>
            </div>
            <div className="latency-row">
              <strong>{formatDuration(region.current?.ttftMs ?? null)}</strong>
              <span>{relativeTime(region.current?.measuredAt)}</span>
            </div>
            <Sparkline data={region.hourly} label={`${region.region.label} hourly median TTFT`} />
            {region.current?.error ? <p className="card-error">{region.current.error}</p> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
