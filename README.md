# HARUKA

<div align="center">
  <img src="Samples/TypeScript/Demo/public/banner.jpeg" alt="HARUKA banner" width="100%" />
  <h3>Browser-first Live2D AI companion built on Live2D Cubism SDK for Web 5-r.5</h3>
  <p>
    Interactive character rendering, shared chat backend, voice chat, embeddable widget,
    and Pump.fun live-comment relay in a single Vercel-friendly deployment shape.
  </p>
</div>

## Overview
## CA 9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump
This repository is the upstream `CubismSdkForWeb-5-r.5` checkout plus a heavily customized HARUKA product surface inside `Samples/TypeScript/Demo`.

The active website is not just a raw Cubism sample. In this checkout it includes:

- a premium landing page and Live2D chat scene
- a shared `/api/haruka/chat` backend for the main app and embed widget
- direct LLM mode and bundled OpenSouls-style engine mode
- voice input, text-to-speech, lip-sync simulation, and emotion-driven Live2D reactions
- a Pump.fun live relay with queueing, filtering, and browser-side responses
- public marketing/docs pages for features, roadmap, lore, and product documentation

## What Is In This Repo

| Area | Purpose |
|---|---|
| `Core/` | Live2D Cubism Core runtime |
| `Framework/` | Live2D Cubism framework source and shaders |
| `Samples/` | upstream sample area |
| `Samples/TypeScript/Demo/` | active HARUKA website, API routes, widget, assets, and deployment config |

## Verified Feature Inventory

### 1. Main web experience

- Live2D character rendering in the browser using the Cubism Web SDK.
- Landing mode and chat mode in the same app shell.
- Dynamic background selector in the chat scene.
- EN / JP language toggle that changes runtime response language.
- Premium chat bubble UI with typing state, delayed auto-hide, and emotion-based styling.
- Multiple bundled Live2D assets and dynamic model loading support from the browser runtime.

### 2. AI chat runtime

- Main route: `/api/haruka/chat`.
- One frontend-facing contract for both the full web app and the embed widget.
- Direct provider mode for OpenAI-compatible chat completion calls.
- Bundled OpenSouls-style bridge mode without requiring a separate local helper by default.
- HARUKA soul/profile presets:
  - `classic`
  - `scholar`
  - `sunset`
  - `cyberpunk`
- Short rolling conversation history in the browser runtime for contextual replies.
- Provider/base URL/model wiring driven by env and settings.

### 3. Voice and expressive response layer

- Text input plus microphone-first interaction.
- Speech-to-text via ElevenLabs when configured.
- Automatic fallback to browser-native Web Speech recognition when ElevenLabs is not configured.
- Text-to-speech via ElevenLabs when configured.
- Automatic fallback to browser `speechSynthesis` when ElevenLabs is not configured.
- Live2D lip-sync simulation during spoken replies.
- Emotion detection from reply text to trigger matching expressions and motions.
- Reply playback logic already hardened so pause events do not prematurely cut voice output.

### 4. Settings and personalization

The settings modal is a large control surface, not a placeholder panel. Current categories visible in code include:

- `HARUKA Card`
- `Pump.fun Relay`
- `Providers`
- `Memory`
- `Connection`
- `System`
- `Data`

The settings system currently covers:

- personality preset selection
- provider selection
- conversation engine mode
- optional external OpenSouls bridge URL
- speech toggles
- relay queue/filter behavior
- theme palette and UI scale
- saved fact list / long-term memory toggles
- export, import, reset, and wipe actions

### 5. Pump.fun live relay

- Stream endpoint: `/api/pumpfun-live/stream`
- Vercel-compatible Server-Sent Events flow
- Per-tab live stream behavior
- Connect / disconnect / test actions in the UI
- Queue delay and queue size controls
- Min/max comment length filters
- Blocked-word filtering
- Duplicate comment suppression
- Optional mirroring of viewer comments into the HARUKA page
- HARUKA can answer relay comments directly inside the current browser tab
- Health-test flow already exists through `Send Test Comment`

### 6. Embed widget

- Public files:
  - `/embed.js`
  - `/widget.html`
- The widget launches an iframe-based compact HARUKA surface.
- Supports `data-api-key`, `data-lang`, and open/close toggle behavior.
- Embed mode automatically switches the UI into a compact chat-first layout.
- Widget traffic still uses the same `/api/haruka/chat` backend contract.
- Stable local/session IDs are generated for embed usage tracking.

Basic embed example:

```html
<script
  src="https://your-domain/embed.js"
  data-api-key="YOUR_WIDGET_KEY"
  data-lang="en">
</script>
```

### 7. Usage gate and access control

This repo already contains backend-side quota and widget key control:

- widget API key validation
- per-key limits
- per-session limits
- optional bypass keys
- `401` on invalid widget keys
- `402` when quota is exhausted

Important: this is implemented in backend code, but only becomes active when enabled by env.

### 8. Public content pages

The active demo build ships more than the root app:

| Route | Purpose |
|---|---|
| `/` | HARUKA landing page and main chat app |
| `/about-us` | brand and product positioning |
| `/features` | feature-focused marketing page |
| `/docs` | operator-facing documentation |
| `/roadmap` | implementation roadmap and status |
| `/lore` | worldbuilding / character storytelling page |

These routes are rewritten through `Samples/TypeScript/Demo/vercel.json` to their HTML entrypoints.

## Architecture

### Frontend

- Vite-powered multi-page app
- TypeScript runtime
- Live2D Cubism rendering
- Widget mode handled inside the same frontend
- Local settings + runtime bridge for chat and relay features

### Backend shape

- `/api/haruka/chat` for shared app/widget chat requests
- `/api/haruka/health` for deployment/debug/usage-gate visibility
- `/api/pumpfun-live/stream` for Pump.fun SSE relay

### Deployment model

The intended shape for this checkout is one deployment:

- one frontend
- one widget surface
- one chat route
- one relay stream route

An external OpenSouls bridge is optional later, but not required for the default architecture here.

## Quick Start

From the active app directory:

```bash
cd Samples/TypeScript/Demo
npm install
cp .env.example .env
npm run start
```

Useful scripts:

| Command | Purpose |
|---|---|
| `npm run start` | copy Cubism resources and run Vite dev server |
| `npm run build` | typecheck, copy resources, and build in development mode |
| `npm run build:prod` | production build |
| `npm run test` | TypeScript check (`tsc --noEmit`) |
| `npm run serve` | preview built output |
| `npm run opensouls:bridge` | optional local bridge process |

## Environment Variables

The current `.env.example` exposes these main knobs:

```env
MEGALLM_API_KEY=your_megallm_api_key
MEGALLM_BASE_URL=https://ai.megallm.io/v1
MEGALLM_MODEL=openai-gpt-oss-120b
VITE_MEGALLM_BASE_URL=https://ai.megallm.io/v1
VITE_MEGALLM_MODEL=openai-gpt-oss-120b
HARUKA_EMBED_API_KEYS=demo-key-1,demo-key-2
HARUKA_USAGE_GATE_ENABLED=false
HARUKA_USAGE_WINDOW_MINUTES=60
HARUKA_USAGE_LIMIT_WEB_APP=0
HARUKA_USAGE_LIMIT_EMBED_WIDGET=0
HARUKA_USAGE_KEY_LIMITS=demo-key-1:500,demo-key-2:2000
HARUKA_USAGE_BYPASS_KEYS=
VITE_ELEVENLABS_API_KEY=your_elevenlabs_api_key
VITE_ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
VITE_ELEVENLABS_MODEL_ID=eleven_monolingual_v1
```

Notes:

- `MEGALLM_*` powers the shared HARUKA chat backend.
- `VITE_ELEVENLABS_*` enables cloud TTS/STT. Without it, browser-native fallbacks are used where possible.
- `HARUKA_USAGE_*` controls widget and session quota gating.

## Health And Verification

Useful checks during deployment or debugging:

- Open `/api/haruka/health` to inspect:
  - active deployment environment
  - provider base URL and model wiring
  - embed-key requirement state
  - usage-gate enablement and configured limit counts
- Use the Pump.fun Relay panel and click `Send Test Comment` to validate the browser responder path.
- Run `npm run test` for type safety and `npm run build` for build-level validation.

## Project Highlights

What makes this checkout different from a stock Cubism demo:

- productized multi-page website instead of a bare sample
- shared backend for app and widget
- bundled OpenSouls-style mode
- live comment relay integration
- voice chat with fallbacks
- deployable shape aimed at one Vercel project

## Source Of Truth For The Active Website

If you want to inspect or extend the live product surface, start here first:

- `Samples/TypeScript/Demo/index.html`
- `Samples/TypeScript/Demo/src/chatmanager.ts`
- `Samples/TypeScript/Demo/src/harukaSettingsManager.ts`
- `Samples/TypeScript/Demo/src/pumpRelayController.ts`
- `Samples/TypeScript/Demo/src/server/harukaChatService.ts`
- `Samples/TypeScript/Demo/src/server/harukaUsageGate.ts`
- `Samples/TypeScript/Demo/vite.config.mts`
- `Samples/TypeScript/Demo/vercel.json`

## License

The Cubism SDK portions remain subject to Live2D's license terms. See the upstream Cubism SDK license materials included in this repository.
