import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, PROBE_PARALLELISM } from "@/lib/config";
import { probeRegions } from "@/lib/probe";
import { getEnabledRegions } from "@/lib/regions";
import { hasDurableStorage, saveProbeResults } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runProbe(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const regions = getEnabledRegions();
  const results = await probeRegions(regions, PROBE_PARALLELISM);
  await saveProbeResults(results);

  return NextResponse.json(
    {
      ok: true,
      measuredAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      regionCount: regions.length,
      savedCount: results.length,
      durableStorage: hasDurableStorage(),
      okCount: results.filter((result) => result.status === "ok").length,
      mockCount: results.filter((result) => result.status === "mock").length,
      errorCount: results.filter((result) => result.status === "error").length,
      results,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export function GET(request: NextRequest) {
  return runProbe(request);
}

export function POST(request: NextRequest) {
  return runProbe(request);
}
