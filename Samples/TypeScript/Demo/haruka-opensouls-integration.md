# HARUKA x OpenSouls Integration

This repo now treats OpenSouls as an internal engine mode, not as a separate browser dependency.

## Why This Shape

`opensouls/opensouls` is a Bun-first soul runtime model, while this HARUKA repo is a Vite + Vercel-friendly Live2D app. For this checkout, the clean default seam is:

1. Browser UI talks to `/api/haruka/chat`
2. `/api/haruka/chat` chooses either:
   - `direct` local adapter mode
   - `opensouls-bridge` mode
3. `opensouls-bridge` uses the bundled bridge path inside this repo by default

That keeps:

- Live2D rendering in this repo
- one frontend-facing chat route
- one deployment story for Vercel
- optional future split only when you truly need it

## Current Soul Profiles

The Character Card preset acts as Haruka's soul bias and branding profile:

- `classic`: bright forest companion
- `scholar`: analytical archive guide
- `sunset`: empathetic emotional anchor
- `cyberpunk`: sharp neon signal sprite

These profiles drive:

- system prompt composition in `src/harukaPromptComposer.ts`
- preview card branding in `src/harukaSoulProfiles.ts`
- the unified Haruka soul bias inside the bundled bridge

## Current Default Behavior

If `openSouls.baseUrl` is empty, or uses the legacy local bridge aliases:

- `bundled`
- `internal`
- `http://127.0.0.1:4100`
- `http://localhost:4100`

the server treats the request as a bundled bridge call and stays in the same deployment.

That means this checkout can stay Vercel-only for the default Step 4 path.

## OpenSouls Bridge Contract

When engine mode is `opensouls-bridge`, this repo sends:

`POST {OpenSoulsBaseUrl}/api/haruka/respond`

only if you intentionally provide an external bridge URL.

Otherwise it runs the bundled bridge internally and keeps the same output contract:

```json
{
  "reply": "Hi hi, I'm here"
}
```

## What Bundled Bridge Means Here

The bundled bridge is not a full separate Bun deployment.

It means:

- the browser still uses `/api/haruka/chat`
- the backend still owns profile selection
- the backend still composes the soul-style prompt
- the final provider call still runs in the current backend path

So you get one deployment, one route contract, and one frontend integration path.

## Optional Future Upgrade Path

Only move to an external OpenSouls service if you later need:

1. durable memory beyond browser/local history
2. longer-running soul processes
3. orchestration that no longer fits cleanly in serverless

If that day comes, keep the same `POST /api/haruka/respond` contract so the browser side does not need to change.
