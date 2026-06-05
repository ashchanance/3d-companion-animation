# Documentation: Haruka

---

## Section Eyebrow
Documentation

## Headline
Operate Haruka with clarity.

## Desc
Where the features live, what they do, and how this checkout is meant to be deployed.

---

## 1. Getting Started

### What Haruka is in this repo
Haruka in this checkout is a browser-first Live2D companion with a shared chat backend.

The active app combines:

- Live2D rendering in the browser
- text chat and voice chat
- a settings-driven soul/profile system
- one backend route for both the main app and the widget

### Browser recommendation
Use Chrome or Edge for the most reliable voice and media behavior.

---

## 2. Main UI Map

### Where to click

- `Settings` button: top-right gear button in the chat scene
- `Background` button: top-right image button next to Settings
- `EN / JP` toggle: bottom-right language bar
- microphone button: next to the chat input
- send button: blue round button in the chat input row

### What each area controls

| UI Surface | What it controls |
|---|---|
| Settings -> HARUKA Card | personality preset and soul bias |
| Settings -> Providers | chat provider and soul engine mode |
| Settings -> Pump.fun Relay | live comment relay behavior |
| Background button | scene/background selection |
| EN / JP toggle | response language |
| microphone button | browser voice input |

---

## 3. Providers and Soul Engine

### Where it is
Open `Settings` -> `Providers`.

### What you can change

| Control | Purpose |
|---|---|
| Provider dropdown | choose the active LLM adapter |
| `Conversation Engine` | switch between direct chat and OpenSouls-style bridge mode |
| `External OpenSouls Bridge URL (optional)` | only used if you intentionally split runtime into another service later |

### Engine modes

- `Direct LLM Adapter`: browser talks to `/api/haruka/chat`, and the backend calls the provider directly
- `OpenSouls Bridge`: still uses `/api/haruka/chat`, but the backend applies the bundled Haruka soul bridge behavior first

### HARUKA Card
The `HARUKA Card` preset changes Haruka's response bias.

The current presets are:

- `classic`
- `scholar`
- `sunset`
- `cyberpunk`

These presets affect tone, structure, emotional warmth, and response posture.

---

## 4. Voice Chat

### How to enable it

1. Click the microphone button next to the chat input
2. Allow browser microphone access
3. Speak naturally

### Notes

- Chrome and Edge are the safest choice
- Safari support is limited
- if speech feels interrupted, stop and retry once permissions are granted cleanly

---

## 5. Embed Widget

### What it is
Haruka can be embedded into another website without maintaining a second app.

The widget reuses:

- the same Live2D frontend
- the same `/api/haruka/chat` backend
- the same provider and soul behavior

### Public widget files

- `/embed.js`
- `/widget.html`

### Basic embed snippet

```html
<script
  src="https://harukacompanion.tech/embed.js"
  data-api-key="YOUR_WIDGET_KEY"
  data-lang="en">
</script>
```

### How it works

1. another site loads `embed.js`
2. `embed.js` opens `widget.html`
3. `widget.html` runs Haruka in compact embed mode
4. requests still go to `/api/haruka/chat`

---

## 6. Pump.fun Relay

### Where it is
Open `Settings` -> `Pump.fun Relay`.

### What it does
This mode listens to Pump.fun live comments and lets Haruka answer from the current page while the tab stays open.

### Main controls

| Control | Purpose |
|---|---|
| `Enable Relay` | start or stop relay behavior |
| `Mirror comments in UI` | show live relay messages inside the page |
| `Pump.fun Token Address` | target live room identifier |
| `Relay Username Label` | label used for relay identity |
| `History sync size` | how many recent messages are considered |
| `Queue delay (ms)` | pause between processed relay items |
| `Queue max size` | queue capacity before dropping |
| `Blocked words` | reject unwanted comments |
| `Relay message template` | viewer context injected into Haruka |

---

## 7. Usage Gate and Widget Keys

### What this feature is
Step 5 is a backend-side usage gate.

It is not a normal end-user settings panel yet.

### What it can do

- require valid widget API keys
- limit requests per widget key
- limit requests per browser session
- return `401` for invalid widget keys
- return `402` when quota is exhausted

### Main environment variables

```env
HARUKA_EMBED_API_KEYS=your-widget-key
HARUKA_USAGE_GATE_ENABLED=true
HARUKA_USAGE_WINDOW_MINUTES=60
HARUKA_USAGE_LIMIT_WEB_APP=0
HARUKA_USAGE_LIMIT_EMBED_WIDGET=0
HARUKA_USAGE_KEY_LIMITS=your-widget-key:25
HARUKA_USAGE_BYPASS_KEYS=
```

### How to verify it
Check `/api/haruka/health`.

The important fields are:

- `embedApiKeyRequired`
- `configuredEmbedKeyCount`
- `usageGateEnabled`
- `configuredUsageKeyCount`

---

## 8. Deployment Shape

### Recommended shape for this repo
This checkout is designed to work as one Vercel deployment.

### Main routes

| Route | Purpose |
|---|---|
| `/` | main Haruka app |
| `/api/haruka/chat` | shared chat backend |
| `/api/haruka/health` | health and debug info |
| `/embed.js` | widget loader |
| `/widget.html` | widget entry |

### Optional later split
Only move to a separate backend later if you truly need:

- durable memory outside browser history
- longer-running orchestration
- external billing state

---

## 9. Roadmap Concepts and Current Status

### What the roadmap means in this repo

| Step | Meaning in this checkout | Current status |
|---|---|---|
| Step 2 | stable shared chat backend | implemented |
| Step 3 | embeddable widget using the same app and API | implemented |
| Step 4 | optional persistent soul runtime beyond serverless | optional path only |
| Step 5 | usage gate and widget key control in front of chat | implemented in backend, enabled only when env is set |

### Important distinction

- `implemented in code` does not automatically mean `enabled in production`
- Step 5 becomes active only when the production env values are present and the project is redeployed

### FAQ

**Does Haruka need a separate backend for embeds?**  
No. The widget uses the same backend route.

**Can I use bundled OpenSouls on Vercel only?**  
Yes. That is the default shape for this repo.

**Where do I see quota state?**  
Use `/api/haruka/health` and backend responses, not the end-user settings panel.
