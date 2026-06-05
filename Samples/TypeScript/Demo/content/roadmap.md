# Roadmap

## Section Eyebrow
Roadmap

## Headline
What is live now, and what comes next.

## Desc
This roadmap follows the real HARUKA implementation in this checkout, not a generic multi-app template.

---

## Phase 1 - Core companion surface
**Status:** Completed
**Period:** Live now

- Main Haruka web app
- Live2D companion rendering
- Text chat
- Voice input and TTS flow
- Language toggle
- Background switching

---

## Phase 2 - Soul control and live relay
**Status:** Completed
**Period:** Live now

- HARUKA Card personality presets
- Providers panel
- bundled OpenSouls bridge mode
- Pump.fun Relay panel
- Vercel-compatible backend health surface

---

## Phase 3 - Distribution and embed
**Status:** Implemented
**Period:** Live in code and deploy

- Shared backend for main app and widget
- Public `embed.js`
- Public `widget.html`
- compact widget mode for external sites
- one Vercel deployment shape for app + widget + backend

---

## Phase 4 - Optional deeper runtime
**Status:** Optional path
**Period:** Later if needed

- separate persistent soul runtime
- durable memory beyond browser history
- longer-running orchestration
- external bridge service only if serverless is no longer enough

---

## Phase 5 - Usage gate and key control
**Status:** Implemented in backend, env-driven
**Period:** Ready to enable

- widget API key validation
- per-key quota windows
- per-session usage limits
- backend `401` for invalid widget keys
- backend `402` for exhausted quota
- production activation depends on env and redeploy
