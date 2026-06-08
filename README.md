# Codex TTFT Dashboard

Realtime Vercel dashboard scaffold for monitoring Codex TTFT by region.

## What is included

- Next.js App Router dashboard UI.
- Cloudflare Worker Cron trigger for `/api/cron/ttft` every 10 minutes.
- `/api/metrics` aggregation endpoint for current regional TTFT and hourly medians.
- Redis REST storage support for Vercel KV or Upstash Redis.
- Local JSON storage for development.
- Mock probe mode so the deployment and UI can be tested before proxy and OpenAI credentials are ready.
- Redis writes are stored by probe run to stay comfortably inside low Upstash command quotas.

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

Use Vercel KV or Upstash Redis for durable history. Without Redis REST env vars, Vercel can render demo data, but Cron samples are not durable across serverless invocations.

At a 10-minute cadence, Redis writes are about 8,640 commands per month because each run is stored as one list item plus one trim. Dashboard reads are cached for 60 seconds by default through `TTFT_METRICS_CACHE_SECONDS`.

## Cloudflare Cron deployment

Vercel Hobby only supports daily Cron, so the 10-minute schedule is handled by the Cloudflare Worker in `cloudflare/cron-worker.js`.

```bash
npx wrangler login
npx wrangler secret put APP_URL
npx wrangler secret put CRON_SECRET
npm run cf:deploy
```

Set `APP_URL` to the production Vercel URL, for example `https://codex-dashboard.vercel.app`. Set `CRON_SECRET` to the same value used in Vercel.

After deployment, trigger once manually:

```bash
curl https://codex-dashboard-cron.<your-subdomain>.workers.dev
```

Check live Worker logs:

```bash
npm run cf:tail
```

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

The Cloudflare Worker uses `*/10 * * * *` in `wrangler.toml`. `vercel.json` intentionally does not define Vercel Cron so Hobby deployments are not rejected.
