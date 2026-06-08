import { randomUUID } from "node:crypto";
import { ProxyAgent, request, type Dispatcher } from "undici";
import {
  CODEX_MODEL,
  CODEX_OAUTH_CLIENT_ID,
  getOAuthAccessToken,
  getOAuthAccountId,
  getOAuthRefreshToken,
  getOpenAiApiKey,
  getResponsesBaseUrl,
  PROBE_TIMEOUT_MS,
  type ProbeAuthMode,
  shouldUseMockProbes,
} from "./config";
import { mockTtft } from "./mock";
import { getProxyUrl } from "./proxies";
import type { ProbeResult, Region } from "./types";

let runtimeOAuthAuth: { token: string; accountId: string | null } | null = null;
let refreshOAuthPromise: Promise<{ token: string; accountId: string | null } | null> | null = null;

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

function createConversationId() {
  return randomUUID();
}

function getProbeAuth(): { mode: ProbeAuthMode; token: string; accountId: string | null } | null {
  if (runtimeOAuthAuth) {
    return { mode: "oauth", ...runtimeOAuthAuth };
  }

  const oauthAccessToken = getOAuthAccessToken();

  if (oauthAccessToken) {
    return { mode: "oauth", token: oauthAccessToken, accountId: getOAuthAccountId() };
  }

  const apiKey = getOpenAiApiKey();
  if (apiKey) {
    return { mode: "api-key", token: apiKey, accountId: null };
  }

  return null;
}

function getChatGptAccountId(token: string) {
  const payload = token.split(".")[1];

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as {
      "https://api.openai.com/auth"?: { chatgpt_account_id?: unknown };
    };
    const accountId = decoded["https://api.openai.com/auth"]?.chatgpt_account_id;
    return typeof accountId === "string" ? accountId : null;
  } catch {
    return null;
  }
}

async function refreshOAuthAccessToken() {
  const refreshToken = getOAuthRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const response = await request("https://auth.openai.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: CODEX_OAUTH_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: "openid profile email",
    }),
  });

  const body = (await response.body.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (response.statusCode >= 400 || !body.access_token) {
    throw new Error(`OAuth refresh failed with ${response.statusCode}: ${body.error_description || body.error || "unknown error"}`);
  }

  return {
    token: body.access_token,
    accountId: getOAuthAccountId() || getChatGptAccountId(body.access_token),
  };
}

async function refreshOAuthAccessTokenOnce() {
  refreshOAuthPromise ??= refreshOAuthAccessToken()
    .then((refreshed) => {
      runtimeOAuthAuth = refreshed;
      return refreshed;
    })
    .finally(() => {
      refreshOAuthPromise = null;
    });

  return refreshOAuthPromise;
}

function createRequestPayload(mode: ProbeAuthMode, conversationId: string) {
  if (mode === "oauth") {
    return {
      model: CODEX_MODEL,
      instructions: "Reply with exactly one word: ok",
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Reply with exactly one word: ok" }],
        },
      ],
      tools: [],
      tool_choice: "auto",
      parallel_tool_calls: false,
      store: false,
      stream: true,
      include: [],
      prompt_cache_key: conversationId,
    };
  }

  return {
    model: CODEX_MODEL,
    input: "Reply with exactly one word: ok",
    stream: true,
    store: false,
    max_output_tokens: 8,
    stream_options: {
      include_obfuscation: false,
    },
  };
}

async function createResponsesRequest(
  auth: { mode: ProbeAuthMode; token: string; accountId: string | null },
  dispatcher: Dispatcher | undefined,
  signal: AbortSignal,
) {
  const conversationId = createConversationId();
  const accountId = auth.mode === "oauth" ? auth.accountId || getChatGptAccountId(auth.token) : null;

  return request(`${getResponsesBaseUrl(auth.mode)}/responses`, {
    method: "POST",
    dispatcher,
    signal,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "OpenAI-Beta": "responses=experimental",
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(auth.mode === "oauth"
        ? {
            conversation_id: conversationId,
            session_id: conversationId,
            "Codex-Task-Type": "standard",
            ...(accountId ? { "chatgpt-account-id": accountId } : {}),
          }
        : {}),
    },
    body: JSON.stringify(createRequestPayload(auth.mode, conversationId)),
  });
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

  try {
    let auth = getProbeAuth();

    if (!auth && getOAuthRefreshToken()) {
      const refreshed = await refreshOAuthAccessTokenOnce();
      auth = refreshed ? { mode: "oauth", ...refreshed } : null;
    }

    if (!auth) {
      throw new Error("No auth token configured");
    }

    let startedAt = performance.now();
    let response = await createResponsesRequest(auth, dispatcher, controller.signal);

    if (response.statusCode === 401 && auth.mode === "oauth") {
      await response.body.text();
      const refreshed = await refreshOAuthAccessTokenOnce();

      if (refreshed) {
        startedAt = performance.now();
        response = await createResponsesRequest({ ...auth, ...refreshed }, dispatcher, controller.signal);
      }
    }

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
