import { ProxyAgent, request, type Dispatcher } from "undici";
import { API_BASE_URL, CODEX_MODEL, getAuthToken, PROBE_TIMEOUT_MS, shouldUseMockProbes } from "./config";
import { mockTtft } from "./mock";
import { getProxyUrl } from "./proxies";
import type { ProbeResult, Region } from "./types";

function resultId(regionId: string, measuredAt: Date) {
  return `${regionId}:${measuredAt.toISOString()}`;
}

function createResult(
  region: Region,
  measuredAt: Date,
  ttftMs: number | null,
  status: ProbeResult["status"],
  proxyConfigured: boolean,
  error?: string,
): ProbeResult {
  return {
    id: resultId(region.id, measuredAt),
    regionId: region.id,
    regionLabel: region.label,
    measuredAt: measuredAt.toISOString(),
    ttftMs,
    status,
    model: CODEX_MODEL,
    proxyConfigured,
    error,
  };
}

function parseSseEvents(buffer: string) {
  const events: string[] = [];
  let cursor = buffer.indexOf("\n\n");

  while (cursor >= 0) {
    events.push(buffer.slice(0, cursor));
    buffer = buffer.slice(cursor + 2);
    cursor = buffer.indexOf("\n\n");
  }

  return { events, rest: buffer };
}

function eventHasOutputText(eventBlock: string) {
  const dataLines = eventBlock
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  for (const dataLine of dataLines) {
    if (dataLine === "[DONE]") {
      continue;
    }

    try {
      const event = JSON.parse(dataLine) as {
        type?: string;
        delta?: unknown;
        text?: unknown;
        choices?: Array<{ delta?: { content?: unknown }; text?: unknown }>;
      };
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        return true;
      }

      if (event.type === "response.output_text.done" && typeof event.text === "string") {
        return true;
      }

      if (event.choices?.some((choice) => typeof choice.delta?.content === "string" || typeof choice.text === "string")) {
        return true;
      }

      if (event.type === "error") {
        throw new Error(dataLine);
      }
    } catch (error) {
      if (error instanceof Error && error.message === dataLine) {
        throw error;
      }
    }
  }

  return false;
}

async function readFirstTextDelta(body: AsyncIterable<Buffer>, startedAt: number) {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");
    const parsed = parseSseEvents(buffer);
    buffer = parsed.rest;

    for (const eventBlock of parsed.events) {
      if (eventHasOutputText(eventBlock)) {
        return Math.round(performance.now() - startedAt);
      }
    }
  }

  throw new Error("Stream completed without output text");
}

export async function probeRegion(region: Region) {
  const measuredAt = new Date();
  const proxyUrl = getProxyUrl(region);

  if (shouldUseMockProbes()) {
    return createResult(region, measuredAt, mockTtft(region, measuredAt), "mock", Boolean(proxyUrl));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const dispatcher: Dispatcher | undefined = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
  const startedAt = performance.now();
  const authToken = getAuthToken();

  try {
    if (!authToken) {
      throw new Error("No auth token configured");
    }

    const response = await request(`${API_BASE_URL}/responses`, {
      method: "POST",
      dispatcher,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: CODEX_MODEL,
        input: "Reply with exactly one word: ok",
        stream: true,
        store: false,
        max_output_tokens: 8,
        stream_options: {
          include_obfuscation: false,
        },
      }),
    });

    if (response.statusCode >= 400) {
      throw new Error(`OpenAI returned ${response.statusCode}: ${await response.body.text()}`);
    }

    const ttftMs = await readFirstTextDelta(response.body as AsyncIterable<Buffer>, startedAt);
    return createResult(region, measuredAt, ttftMs, "ok", Boolean(proxyUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown probe error";
    return createResult(region, measuredAt, null, "error", Boolean(proxyUrl), message);
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeRegions(regions: Region[], parallelism: number) {
  const results: ProbeResult[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < regions.length) {
      const region = regions[cursor];
      cursor += 1;
      results.push(await probeRegion(region));
    }
  }

  await Promise.all(Array.from({ length: Math.min(parallelism, regions.length) }, worker));
  return results.sort((a, b) => a.regionId.localeCompare(b.regionId));
}
