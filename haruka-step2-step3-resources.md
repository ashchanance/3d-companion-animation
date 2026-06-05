# HARUKA - Step 2 and Step 3 Resources

This file is aligned to the active checkout at:

`D:\whealthy people\CubismSdkForWeb-5-r.5\Samples\TypeScript\Demo`

The current repo already has a Vercel-compatible chat route and a bundled OpenSouls-style bridge path. Do not treat this checkout as "Railway required" unless you intentionally split Haruka into a separate persistent runtime later.

---

## Step 2 - API Backend

### Active backend surface in this repo

- `Samples/TypeScript/Demo/api/haruka/chat.js`
- `Samples/TypeScript/Demo/api/haruka/health.js`
- `Samples/TypeScript/Demo/src/server/harukaChatService.ts`
- `Samples/TypeScript/Demo/src/server/harukaOpenSoulsBridge.ts`
- `Samples/TypeScript/Demo/vite.config.mts`

### What is already true here

- Browser chat already posts to `/api/haruka/chat`
- Direct provider mode already works with MegaLLM/OpenAI-compatible APIs
- OpenSouls mode already has a bundled bridge fallback
- Vite dev and Vercel deploy paths both exist
- CORS is already enabled

### Recommended backend scope for this checkout

- Keep `/api/haruka/chat` as the single frontend-facing endpoint
- Keep direct provider mode for the default deployment path
- Keep bundled OpenSouls bridge as the no-extra-service option
- Use external persistent OpenSouls only as an optional upgrade path
- Protect embed traffic with `HARUKA_EMBED_API_KEYS` when distributing widget keys

### Environment variables used by this repo

```env
MEGALLM_API_KEY=
MEGALLM_BASE_URL=https://ai.megallm.io/v1
MEGALLM_MODEL=openai-gpt-oss-120b
VITE_MEGALLM_BASE_URL=https://ai.megallm.io/v1
VITE_MEGALLM_MODEL=openai-gpt-oss-120b
HARUKA_EMBED_API_KEYS=demo-key-1,demo-key-2
```

### Optional future split

Use Railway, Render, Bun, Hono, or Express only if you later decide to run:

- a real persistent soul process
- longer-lived memory outside browser history
- paid API middleware outside Vercel function limits

That is an upgrade path, not a requirement for this checkout.

---

## Step 3 - Embed Widget

### Active widget surface in this repo

- `Samples/TypeScript/Demo/public/embed.js`
- `Samples/TypeScript/Demo/public/widget.html`
- `Samples/TypeScript/Demo/src/widgetEmbedMode.ts`

### Current implementation approach

- `embed.js` injects a floating iframe launcher into external sites
- `widget.html` redirects into the main HARUKA app using `?embed=1`
- widget mode reuses the existing Live2D, chat, voice, and `/api/haruka/chat` flow
- this avoids duplicating a second chat frontend that would drift from the main app

### Embed snippet

```html
<script
  src="https://your-domain/embed.js"
  data-api-key="their-api-key"
  data-lang="en">
</script>
```

### Widget expectations

- opens in the bottom-right corner
- can be collapsed and reopened
- reuses the current HARUKA character runtime
- sends widget traffic through the same chat API

---

## Verification checklist

### Step 2

- [ ] `GET /api/haruka/health` returns provider and embed-key status
- [ ] `POST /api/haruka/chat` succeeds in direct mode
- [ ] `POST /api/haruka/chat` rejects invalid widget keys when `HARUKA_EMBED_API_KEYS` is set

### Step 3

- [ ] `/embed.js` is publicly reachable
- [ ] `/widget.html` is publicly reachable
- [ ] widget opens the HARUKA embed mode
- [ ] chat works inside the widget
- [ ] mic permission can be requested from the iframe host browser
