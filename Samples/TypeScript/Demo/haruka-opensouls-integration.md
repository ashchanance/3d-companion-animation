# HARUKA x OpenSouls Integration

This repo now treats OpenSouls as a local engine mode, not as a browser dependency.

## Why This Shape

`opensouls/opensouls` is a Bun-first local runtime with a soul process model, static memories, and mental processes. This Live2D repo is a Vite browser app. The clean integration seam is:

1. Browser UI talks to `/api/haruka/chat`
2. `/api/haruka/chat` chooses either:
   - `direct` local adapter mode
   - `opensouls-bridge` mode
3. The OpenSouls bridge runs from this repo as a local Bun process

That keeps:

- Live2D rendering in this repo
- Soul orchestration in OpenSouls
- Persona selection and branding in one UI

## Current Soul Profiles

The Character Card preset now acts as Haruka's soul bias and branding profile:

- `classic`: bright forest companion
- `scholar`: analytical archive guide
- `sunset`: empathetic emotional anchor
- `cyberpunk`: sharp neon signal sprite

These profiles drive:

- system prompt composition in `src/harukaPromptComposer.ts`
- preview card branding in `src/harukaSoulProfiles.ts`
- the unified Haruka soul bias inside the local bridge

## OpenSouls Bridge Contract

When engine mode is `opensouls-bridge`, this repo sends:

`POST {OpenSoulsBaseUrl}/api/haruka/respond`

```json
{
  "soulName": "haruka",
  "source": "chat-ui",
  "username": null,
  "message": "hello there",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "profileId": "classic",
  "systemPrompt": "..."
}
```

Expected response:

```json
{
  "reply": "Hi hi, I'm here 🌸"
}
```

## Suggested Bun Bridge Responsibilities

Inside the OpenSouls-side bridge, map the request into:

1. `staticMemories/core.md`
   - mirror the selected profile identity, world, speaking style, and bias
2. `memoryIntegrator`
   - inject incoming browser turns as perception memories
3. `initialProcess` or a live-chat process
   - use short reply behavior for UI chat
   - use even shorter crowd-aware behavior for Pump.fun relay mode
4. `summarizeConversation`
   - keep long-term scene memory compact

## Recommended Next Bridge Step

This repo now includes a local bridge entrypoint:

```bash
bun run opensouls:bridge
```

It exposes:

- `GET /health`
- `POST /api/haruka/respond`

The bridge keeps a single Haruka soul identity and lets the active `profileId` decide bias, memory posture, and branding.

If you later swap the bridge internals with a full OpenSouls runtime, keep the same HTTP contract so the browser side does not need to change.

## Optional Full OpenSouls Upgrade Path

Replace the bundled bridge internals with a Bun service that:

1. loads one `haruka` soul runtime
2. receives `/api/haruka/respond`
3. applies `profileId` as the selected memory/process bias
4. returns the final utterance as `{ "reply": "..." }`
