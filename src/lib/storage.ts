import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProbeResult } from "./types";

const SAMPLE_KEY = "ttft:samples";
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
    await redisPipeline([
      ...results.map((result) => ["LPUSH", SAMPLE_KEY, JSON.stringify(result)]),
      ["LTRIM", SAMPLE_KEY, 0, SAMPLE_LIMIT - 1],
    ]);
    return;
  }

  const existing = await readLocalSamples();
  await writeLocalSamples([...results, ...existing]);
}

export async function readProbeResults(limit = SAMPLE_LIMIT) {
  if (redisConfig()) {
    const values = await redisCommand<string[]>(["LRANGE", SAMPLE_KEY, 0, limit - 1]);
    return values
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
