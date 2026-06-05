# HARUKA - Deployment Guide for This Checkout

This guide is for the active repo at:

`D:\whealthy people\CubismSdkForWeb-5-r.5\Samples\TypeScript\Demo`

The old assumption that Step 2 must live on Railway is not accurate for this checkout anymore.

---

## Recommended deployment split

### Step 1 - Optional full Soul Engine

Deploy separately only if you really need:

- persistent memory outside browser history
- a long-running soul runtime
- non-serverless orchestration

Recommended target if needed later:

- Railway
- Render
- any Bun/Node server host

### Step 2 - Chat API

Deploy on the same Vercel project as the frontend for this repo.

Why this works here:

- `/api/haruka/chat` is already serverless-friendly
- direct provider mode is request/response based
- bundled OpenSouls bridge path avoids requiring `127.0.0.1:4100`
- widget and main web app can share the same origin and API route

### Step 3 - Embed widget

Deploy on the same Vercel project as the frontend.

Files:

- `/embed.js`
- `/widget.html`
- main app embed mode via `?embed=1`

### Step 4 - Optional persistent soul runtime

Default for this checkout:

- stay on the same Vercel project
- keep `engineMode=opensouls-bridge`
- leave `openSouls.baseUrl` empty so the bundled bridge is used internally

Only split this into a separate Bun or Node service later if you truly need:

- durable memory outside browser history
- longer-running orchestration
- background soul processing that no longer fits well in serverless

### Step 5 - Payment / usage gate

Baseline usage gating is now implemented in this checkout.

Current shape:

- lives in front of `/api/haruka/chat`
- works in the same Vercel project as the frontend
- uses in-memory quota windows, so it is good for lightweight usage gating
- does not yet include a durable external billing ledger

Use this first if you want:

- free web session quotas
- widget quotas
- per-key message windows

Move beyond this only if you later need:

- durable billing state
- paid checkout and subscriptions
- quota sharing across long-lived multi-region workers

---

## Environment variables

### Vercel

```env
MEGALLM_API_KEY=
MEGALLM_BASE_URL=https://ai.megallm.io/v1
MEGALLM_MODEL=openai-gpt-oss-120b
HARUKA_EMBED_API_KEYS=demo-key-1,demo-key-2
HARUKA_USAGE_GATE_ENABLED=false
HARUKA_USAGE_WINDOW_MINUTES=60
HARUKA_USAGE_LIMIT_WEB_APP=0
HARUKA_USAGE_LIMIT_EMBED_WIDGET=0
HARUKA_USAGE_KEY_LIMITS=demo-key-1:500,demo-key-2:2000
HARUKA_USAGE_BYPASS_KEYS=
```

### Browser-exposed build vars

```env
VITE_MEGALLM_BASE_URL=https://ai.megallm.io/v1
VITE_MEGALLM_MODEL=openai-gpt-oss-120b
```

Do not expose `MEGALLM_API_KEY` to the browser.

---

## Domain layout

### Minimal and recommended now

```text
harukacompanion.tech -> Vercel
  /                main HARUKA app
  /api/haruka/chat chat backend
  /api/haruka/health health/debug
  /embed.js        embed loader
  /widget.html     widget entry
```

### Optional later split

```text
harukacompanion.tech      -> Vercel frontend + widget + API
api.harukacompanion.tech  -> separate backend only if you outgrow serverless
```

---

## Deployment checklist

- [ ] `npm run build` passes in `Samples/TypeScript/Demo`
- [ ] `/api/haruka/health` works after deploy
- [ ] main site chat works
- [ ] widget chat works through `/embed.js`
- [ ] invalid widget keys are rejected if embed keys are configured
- [ ] over-limit requests return `402` with a readable HARUKA reply when usage gate is enabled
