import { NextResponse } from "next/server";
import { generateDemoSamples } from "@/lib/demo";
import { buildDashboardMetrics } from "@/lib/metrics";
import { readProbeResults } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const samples = await readProbeResults();
  const metrics = buildDashboardMetrics(samples.length ? samples : generateDemoSamples());

  return NextResponse.json(metrics, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
