import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProbeResult } from "./types";

const RUN_KEY = "ttft:runs";
const SAMPLE_LIMIT = Number(process.env.TTFT_SAMPLE_LIMIT || 50000);

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url: url.replace(/\/$/, ""), token };
}

async function redisCommand<T>(command: Array<string | number>) {
  const config = redisConfig();
  if (!config) {
    throw new Error("Redis REST is not configured");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`Redis command failed: ${response.status} ${await response.text()}`);
  }

  const payload = (await response.json()) as { result: T };
  return payload.result;
}

async function redisPipeline(commands: Array<Array<string | number>>) {
  const config = redisConfig();
  if (!config) {
    throw new Error("Redis REST is not configured");
  }

  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    throw new Error(`Redis pipeline failed: ${response.status} ${await response.text()}`);
  }
}

function localDataPath() {
  const baseDir = process.env.VERCEL ? path.join(os.tmpdir(), "codex-dashboard") : path.join(process.cwd(), ".data");
  return path.join(baseDir, "samples.json");
}

async function readLocalSamples() {
  try {
    const content = await readFile(localDataPath(), "utf8");
    const parsed = JSON.parse(content) as ProbeResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLocalSamples(samples: ProbeResult[]) {
  const filePath = localDataPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(samples.slice(0, SAMPLE_LIMIT), null, 2));
}

export function hasDurableStorage() {
  return Boolean(redisConfig());
}

export async function saveProbeResults(results: ProbeResult[]) {
  if (!results.length) {
    return;
  }

  if (redisConfig()) {
    const newestFirst = [...results].sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
    const runLimit = Math.max(1, Math.ceil(SAMPLE_LIMIT / Math.max(1, results.length)));

    await redisPipeline([
      ["LPUSH", RUN_KEY, JSON.stringify(newestFirst)],
      ["LTRIM", RUN_KEY, 0, runLimit - 1],
    ]);
    return;
  }

  const existing = await readLocalSamples();
  await writeLocalSamples([...results, ...existing]);
}

export async function readProbeResults(limit = SAMPLE_LIMIT) {
  if (redisConfig()) {
    const values = await redisCommand<string[]>(["LRANGE", RUN_KEY, 0, limit - 1]);
    const samples: ProbeResult[] = [];

    for (const value of values) {
      try {
        const parsed = JSON.parse(value) as ProbeResult[] | ProbeResult;
        if (Array.isArray(parsed)) {
          samples.push(...parsed);
        } else {
          samples.push(parsed);
        }
      } catch {
        continue;
      }
    }

    if (samples.length) {
      return samples.slice(0, limit);
    }

    const legacyValues = await redisCommand<string[]>(["LRANGE", "ttft:samples", 0, limit - 1]);
    return legacyValues
      .map((value) => {
        try {
          return JSON.parse(value) as ProbeResult;
        } catch {
          return null;
        }
      })
      .filter((result): result is ProbeResult => Boolean(result));
  }

  return readLocalSamples();
}
