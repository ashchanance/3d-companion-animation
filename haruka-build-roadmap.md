# HARUKA - Build Roadmap for This Repo

This roadmap is adjusted to the real implementation already living in:

`D:\whealthy people\CubismSdkForWeb-5-r.5\Samples\TypeScript\Demo`

The goal is to keep one clean frontend and one clean backend path, not fork the product into multiple drifting implementations.

---

## Overview

HARUKA in this repo should evolve in this order:

1. stable chat backend
2. stable embed frontend
3. optional persistent soul upgrade
4. optional payment / usage gate activation

Do not force a separate persistent backend before the current Vercel-compatible path is stable.

---

## Step 1 - Core personality and response path

### Current state

- HARUKA personality presets already exist
- direct provider mode already exists
- bundled OpenSouls-style mode already exists

### Done when

- HARUKA replies consistently in the main UI
- direct mode and bundled OpenSouls mode both work
- health/debug surfaces clearly show provider state

---

## Step 2 - Production chat backend

### Current state

This repo already has the correct backend seam:

- `/api/haruka/chat`
- `/api/haruka/health`

### What to maintain

- one frontend-facing chat endpoint
- one request contract for main UI and widget UI
- optional widget API key validation
- same behavior in Vite dev and Vercel deploy

### Request shape used in this repo

```json
{
  "message": "are you real?",
  "history": [],
  "language": "en",
  "profileId": "classic",
  "engineMode": "direct",
  "providerId": "openai-compatible",
  "clientType": "embed-widget",
  "apiKey": "their-widget-key",
  "userId": "user-123",
  "sessionId": "session-abc"
}
```

### Done when

- main site chat works
- widget chat works
- invalid widget keys are rejected when configured
- health route exposes provider and embed-key readiness

---

## Step 3 - Embed widget

### Goal

Developers should be able to paste one script tag and get HARUKA without you maintaining a second independent chat app.

### Implementation for this repo

- `public/embed.js`
- `public/widget.html`
- main app embed mode via `?embed=1`

### Why this shape is correct

- reuses existing Live2D runtime
- reuses existing chat manager
- reuses existing voice flow
- reuses existing `/api/haruka/chat`
- keeps main app and widget behavior aligned

### Embed snippet

```html
<script
  src="https://your-domain/embed.js"
  data-api-key="their-api-key"
  data-lang="en">
</script>
```

### Done when

- widget opens from external site
- widget can collapse and reopen
- HARUKA responds from inside widget
- same backend contract powers main UI and widget

---

## Step 4 - Optional persistent soul runtime

Only do this after Step 2 and Step 3 are stable.

Move to a separate long-running service only if you need:

- durable memory beyond local/browser history
- more advanced soul orchestration
- workloads that do not fit cleanly in serverless

This is an upgrade path, not a prerequisite for the current repo.

---

## Step 5 - Payment / usage gating

### Current state

This repo now has a baseline usage gate in front of `/api/haruka/chat`.

The current implementation is intentionally Vercel-friendly:

- in-memory windowed quotas
- optional per-web-app session limit
- optional per-widget global limit
- optional per-widget-key quota plan
- optional bypass keys for internal or unlimited embeds

### Environment contract

```env
HARUKA_USAGE_GATE_ENABLED=false
HARUKA_USAGE_WINDOW_MINUTES=60
HARUKA_USAGE_LIMIT_WEB_APP=0
HARUKA_USAGE_LIMIT_EMBED_WIDGET=0
HARUKA_USAGE_KEY_LIMITS=demo-key-1:500,demo-key-2:2000
HARUKA_USAGE_BYPASS_KEYS=
```

### Behavior

- gate stays off by default
- when enabled, quota is checked before provider calls
- over-limit requests return `402` with a user-facing reply
- the existing request body does not change
- `/api/haruka/health` exposes gate readiness and configured limit counts

### Done when

- web-app free session limits can be enabled without frontend breakage
- widget keys can be limited per window
- over-limit replies are visible inside the HARUKA bubble
- Vite dev and Vercel deploy behave the same way
