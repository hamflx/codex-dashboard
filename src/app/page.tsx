import Dashboard from "@/components/dashboard";
import { generateDemoSamples } from "@/lib/demo";
import { buildDashboardMetrics } from "@/lib/metrics";
import { readProbeResults } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const samples = await readProbeResults();
  const metrics = buildDashboardMetrics(samples.length ? samples : generateDemoSamples());

  return <Dashboard initialMetrics={metrics} />;
}
