# Codex TTFT Dashboard

Realtime Vercel dashboard scaffold for monitoring Codex TTFT by region.

## What is included

- Next.js App Router dashboard UI.
- Vercel Cron at `/api/cron/ttft` every 10 minutes.
- `/api/metrics` aggregation endpoint for current regional TTFT and hourly medians.
- Redis REST storage support for Vercel KV or Upstash Redis.
- Local JSON storage for development.
- Mock probe mode so the deployment and UI can be tested before proxy and OpenAI credentials are ready.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Run one manual probe:

```bash
curl http://localhost:3000/api/cron/ttft
```

## Vercel deployment flow

```bash
npx vercel@latest login
npx vercel@latest link
npx vercel@latest env add OPENAI_API_KEY production
npx vercel@latest env add CODEX_MODEL production
npx vercel@latest env add CRON_SECRET production
npx vercel@latest env add KV_REST_API_URL production
npx vercel@latest env add KV_REST_API_TOKEN production
npx vercel@latest env add TTFT_PROXY_JSON production
npx vercel@latest deploy --prod
```

On Vercel Hobby, the default 10-minute Cron schedule will be rejected. Use this only to validate the deployment flow:

```bash
npx vercel@latest deploy --prod --local-config vercel.hobby.json
```

Switch back to the default `vercel.json` on a Pro project to enable the required 10-minute cadence.

Use Vercel KV or Upstash Redis for durable history. Without Redis REST env vars, Vercel can render demo data, but Cron samples are not durable across serverless invocations.

## Proxy notes

The local `clash.config.yaml` is ignored on purpose because it may contain credentials. Vercel functions cannot directly run Clash trojan/vmess nodes from that file. For production probes, expose each region as an HTTP(S) proxy endpoint and configure `TTFT_PROXY_JSON` or `TTFT_PROXY_<REGION_ID>` env vars.

Example:

```json
{
  "hong-kong": "http://user:pass@hk-proxy.example.com:8080",
  "japan": "http://user:pass@jp-proxy.example.com:8080",
  "united-states": "http://user:pass@us-proxy.example.com:8080"
}
```

## Cron frequency

The scaffold uses `*/10 * * * *` in `vercel.json`. Vercel plan limits apply; high-frequency Cron generally requires a paid plan.
