const TEN_SECONDS = 10_000;

function requireEnv(env, name) {
  const value = env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.replace(/\/$/, "");
}

async function triggerProbe(env) {
  const appUrl = requireEnv(env, "APP_URL");
  const cronSecret = requireEnv(env, "CRON_SECRET");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Timed out triggering probe"), TEN_SECONDS);

  try {
    const response = await fetch(`${appUrl}/api/cron/ttft`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "User-Agent": "codex-dashboard-cloudflare-cron",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Probe trigger failed: ${response.status} ${body.slice(0, 500)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(triggerProbe(env));
  },

  async fetch(_request, env) {
    await triggerProbe(env);
    return new Response("Triggered\n", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  },
};
