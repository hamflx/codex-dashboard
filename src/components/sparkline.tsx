"use client";

import type { HourlyMedian } from "@/lib/types";

type SparklineProps = {
  data: HourlyMedian[];
  height?: number;
  strokeWidth?: number;
  label?: string;
};

function pointsFor(data: HourlyMedian[], width: number, height: number, padding: number) {
  const values = data.map((point) => point.ttftMs).filter((value): value is number => typeof value === "number");

  if (!values.length) {
    return "";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const xStep = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  return data
    .map((point, index) => {
      if (typeof point.ttftMs !== "number") {
        return null;
      }

      const x = padding + index * xStep;
      const y = height - padding - ((point.ttftMs - min) / span) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
}

export default function Sparkline({ data, height = 96, strokeWidth = 2.5, label = "TTFT trend" }: SparklineProps) {
  const width = 520;
  const padding = 10;
  const points = pointsFor(data, width, height, padding);
  const values = data.map((point) => point.ttftMs).filter((value): value is number => typeof value === "number");
  const latest = [...data].reverse().find((point) => typeof point.ttftMs === "number");

  if (!points) {
    return (
      <div className="sparkline-empty" style={{ height }}>
        No samples
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="none">
      <line x1="0" x2={width} y1={height - padding} y2={height - padding} className="sparkline-grid" />
      <line x1="0" x2={width} y1={padding} y2={padding} className="sparkline-grid" />
      <polyline points={points} className="sparkline-line" fill="none" strokeWidth={strokeWidth} />
      <text x="8" y="18" className="sparkline-text">
        {max} ms
      </text>
      <text x="8" y={height - 8} className="sparkline-text">
        {min} ms
      </text>
      {latest?.ttftMs ? (
        <circle
          cx={width - padding}
          cy={height - padding - ((latest.ttftMs - min) / Math.max(1, max - min)) * (height - padding * 2)}
          r="4"
          className="sparkline-dot"
        />
      ) : null}
    </svg>
  );
}
