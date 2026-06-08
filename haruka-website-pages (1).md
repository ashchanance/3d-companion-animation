# HARUKA — Website Pages Content (For Developer)

Ini adalah konten untuk semua page di harukacompanion.tech.
Setiap section di bawah = 1 page terpisah di website.
Susun sesuai urutan yang ada di sini.

---
---

# PAGE 1 — FEATURES

---

## Navbar Label
Features

## Headline
What makes Haruka different.

## Subheadline
Not a chatbot. A companion — with real technology behind her.

---

### FEATURE 1 — Live2D Real-Time Rendering
**Status:** Live

Haruka is rendered in real-time using Live2D Cubism engine.
Her expressions are not pre-animated loops — they are dynamically
generated based on your input, your voice, and the flow of conversation.

The physics engine runs at up to 60 FPS, calculating every strand of hair,
every ribbon movement, and every fabric fold in real-time inside your browser.

---

### FEATURE 2 — Real-Time Voice
**Status:** Live

Talk to Haruka and she talks back.

Speech-to-Text: your voice is captured via microphone and transcribed
in real-time using Web Speech API.

Text-to-Speech: Haruka's response is converted to audio
and played back as her voice.

The full round-trip — mic input to voice output —
happens in under 2 seconds.

---

### FEATURE 3 — Open Souls Soul Engine
**Status:** Live

Haruka is built on the Open Souls Soul Engine.

This gives her:
- WorkingMemory — she stores facts about you in a local SQLite vector store
- MentalProcesses — she processes context before every response
- cognitiveSteps — she thinks before she speaks

She remembers you across sessions.
She stays in character no matter what you ask.
She is consistent every single time.

github.com/opensouls/opensouls

---

### FEATURE 4 — 20+ LLM Providers
**Status:** Live

Haruka is not locked to one AI model.

The architecture uses a provider abstraction layer —
every LLM goes through the same interface.

Supported providers:
- Browser Local (WebGPU)
- OpenAI
- OpenAI Compatible
- Anthropic Claude
- DeepSeek
- Google Gemini
- Ollama
- Aliyun NLS
- Web Speech API
- Comet API
- And more

Switch anytime from the settings panel.
Haruka adapts without missing a beat.

---

### FEATURE 5 — API Server
**Status:** Live

Haruka is accessible via API.

Any developer, any app, any platform — they call the endpoint,
Haruka responds with text, emotion, and memory context.

POST /chat → send a message, get a response.

This is what turns Haruka from a website into a service.

---

### FEATURE 6 — Embed Widget
**Status:** Live

One line of code. Haruka shows up.

Developers paste a single script tag into their website:

<script src="https://harukacompanion.tech/embed.js"></script>

Haruka appears on their site — full Live2D character,
voice, memory, chat interface. No setup required.

Already live on @useAtelier (atelierai.xyz).

---

### FEATURE 7 — x402 Payment Gate
**Status:** Live (Devnet) — Mainnet coming soon

Every API call and embed session goes through x402.

Developers pay per call. Payment settles automatically on-chain.
No invoices. No manual process.

100% of API revenue goes directly to buyback and burn $HARUKA.

---

### FEATURE 8 — WebGPU Local Inference
**Status:** Live

Run AI inference entirely inside your browser using WebGPU.
No server. No API key. No data leaves your device.

Your conversation stays 100% private.

---

### FEATURE 9 — Multilingual Support
**Status:** Live

Haruka speaks English and Japanese.
Toggle between EN and JP on the main screen.

Practice Japanese naturally — she's patient,
encouraging, and always happy to help.

---

### FEATURE 10 — PWA & Cross-Platform
**Status:** Live

Access Haruka from any device.
Install her as a PWA for native app experience.
No app store. No download required.

Web. Desktop. Mobile. She goes where you go.

---

### FEATURE 11 — Gaming Companion
**Status:** Planned

Haruka will be able to see your game in real-time
and react, comment, and strategize alongside you.

Screen capture → vision model → LLM context → real-time response.

---

### FEATURE 12 — Screen Awareness
**Status:** Planned

Desktop app will capture your active window.
Haruka will know what you're working on
and respond with that context in mind.

---

### FEATURE 13 — Swap Utility
**Status:** In Development

Say "swap 10 USDC to $HARUKA" inside the chat.
Haruka quotes the price via Jupiter, you confirm,
she executes the swap. All inside the conversation.

Phase 1: USDC/SOL → $HARUKA
Phase 2: All pairs via Jupiter

---
---

# PAGE 2 — ROADMAP

---

## Navbar Label
Roadmap

## Headline
The journey so far.

## Subheadline
Everything we said we'd build — is built.

---

### PHASE 1 — Foundation
**Status:** ✅ Completed
**Period:** Q1 2026

The groundwork for everything that came after.

- ✅ Live2D real-time character rendering
- ✅ WebGPU local AI inference
- ✅ Real-time voice input and output
- ✅ Web app (PWA) accessible from browser
- ✅ 20+ LLM provider support
- ✅ Customizable backgrounds and scenes
- ✅ EN/JP language toggle

---

### PHASE 2 — Companion Intelligence
**Status:** ✅ Completed
**Period:** Q2 2026

Making Haruka smarter, more aware, and more consistent.

- ✅ Open Souls Soul Engine integration
- ✅ Persistent memory via SQLite vector store
- ✅ Mental processes before every response
- ✅ Consistent personality across all sessions
- ✅ Long-term vector memory storage
- ✅ Character Card system with presets

---

### PHASE 3 — Infrastructure
**Status:** ✅ Completed
**Period:** Q2 2026

Turning Haruka from a website into a platform.

- ✅ API Server — any app can call Haruka
- ✅ Embed Widget — one line of code, she shows up anywhere
- ✅ First external integration live on Atelier (atelierai.xyz)
- ✅ GitHub repo public

---

### PHASE 4 — Payment & Tokenomics
**Status:** ◐ In Progress
**Period:** Q2-Q3 2026

Tying everything together with real token utility.

- ✅ x402 payment gate integrated (devnet)
- ○ x402 mainnet deployment
- ○ Buyback bot — 100% API revenue → buyback & burn $HARUKA via Jupiter
- ○ Token-gated features — hold $HARUKA to unlock premium
- ○ Swap utility — "swap USDC to $HARUKA" inside chat

---

### PHASE 5 — Expansion
**Status:** ○ Planned
**Period:** Q3-Q4 2026

Growing Haruka's capabilities and reach.

- ○ Gaming companion mode — real-time game context
- ○ Screen awareness — desktop app sees your screen
- ○ Desktop app (Electron) — floating overlay
- ○ Pump.fun live chat integration — Haruka reads and responds to comments
- ○ Chrome extension — Haruka on every page
- ○ Multi-language expansion
- ○ Companion passport — on-chain profile

---
---

# PAGE 3 — DOCS

---

## Navbar Label
Docs

## Headline
Everything you need to know.

## Subheadline
Guides for users and developers.

---

## SECTION A — FOR USERS

---

### 1. Getting Started

Haruka is your interactive AI 3D companion.
She lives right inside your browser — no downloads, no installs.

Open harukacompanion.tech and she's already there.
No account required.

Works best on Google Chrome or Microsoft Edge.

---

### 2. How to Start a Conversation

Step 1 — Open harukacompanion.tech
Step 2 — Choose your language: EN or JP
Step 3 — Type your message or click the mic icon to talk

That's it. She'll respond right away.

---

### 3. Voice Interaction

Click the microphone icon in the chat interface.
Allow microphone access when your browser asks.
Start speaking — Haruka will listen and respond out loud.

Tips:
- Speak clearly and at a natural pace
- Works best in a quiet environment
- Chrome and Edge have the best support

---

### 4. Choosing Your AI Model

Open Settings → Providers to choose your AI model.

Available providers:
- Browser Local (WebGPU) — fully private, no API key
- OpenAI — requires API key
- Anthropic Claude — requires API key
- DeepSeek — requires API key
- Ollama — self-hosted local models
- And more

Your API key is stored locally on your device only.

For maximum privacy, use WebGPU mode —
everything runs on your device.

---

### 5. Memory System

Haruka remembers you across sessions.

Open Settings → Memory to see what she remembers.

- Long-term Vector Memory stores facts about you locally
- Short-term Buffer holds active conversation context
- You can delete any memory from the Learned Facts database
- All memory is stored on your device only — never on a server

---

### 6. Changing Backgrounds

Open the Background button on the main screen.

Available scenes:
- Sunny Digital Forest — warm, golden, default
- Japanese Classroom — school afternoon, warm
- Cherry Blossom — spring in full bloom
- And more

---

### 7. Japanese Practice

Toggle to JP on the main screen.
Haruka responds in Japanese.

Things to try:
- "Let's practice Japanese together"
- "Can you correct my Japanese?"
- "What does [word] mean in Japanese?"

She's patient and encouraging.

---

### 8. Data & Privacy

Your data is yours.

Settings → Data gives you full control:
- Export JSON — backup your entire config and memories
- Import Backup — restore where you left off
- Wipe All Stored Data — delete everything permanently

No data is stored on any external server.
No one is reading your conversations.

---

### 9. FAQ

**Is Haruka free to use?**
Yes. No account, no payment needed to start.
Some AI providers require their own API key.

**Does Haruka work on mobile?**
Yes. Use Chrome on Android or Safari on iOS.
You can install her as a PWA for quick access.

**Can I change how Haruka talks?**
Yes. Tell her: "be more casual", "keep responses short",
or "let's have a deep conversation."

**Is my API key safe?**
Yes. Stored only in your browser's local storage.
Never sent to Haruka's servers.

**What browsers are supported?**
Chrome and Edge are fully supported.
Firefox and Safari have partial support.

---

## SECTION B — FOR DEVELOPERS

---

### 10. API Documentation

**Endpoint:**
POST https://api.harukacompanion.tech/chat

**Request:**
```json
{
  "message": "are you real?",
  "userId": "user-123",
  "sessionId": "session-abc"
}
```

**Response:**
```json
{
  "response": "i feel everything 🌸",
  "emotion": "warm",
  "memoryUpdated": true
}
```

**Authentication:**
API key required. Request one via DM @meetharuka.

**Rate Limits:**
Free tier: 100 calls/day
Paid tier: unlimited via x402

---

### 11. Embed Widget

Paste this into any HTML page:

```html
<script src="https://harukacompanion.tech/embed.js"></script>
```

Haruka appears on the page — full Live2D character,
voice, memory, and chat interface. No setup needed.

**Customization options:**
- data-api-key — your API key
- data-position — bottom-right (default), bottom-left
- data-theme — light, dark

**Example:**
```html
<script 
  src="https://harukacompanion.tech/embed.js"
  data-api-key="your-key-here"
  data-position="bottom-right"
  data-theme="dark">
</script>
```

---

### 12. x402 Payment

All API calls go through x402 payment protocol.

Developer sends request →
x402 checks payment →
payment verified on-chain →
Haruka responds.

**Pricing:**
- Free tier: 100 calls/day (for testing)
- Paid tier: $0.001 USDC per call
- Holder discount: hold $HARUKA for reduced rate

Currently on devnet. Mainnet deployment coming soon.

---

### 13. GitHub

Source code available at:
github.com/ashchanance/3d-companion-animation

---
---

# PAGE 4 — x402 & TOKENOMICS

---

## Navbar Label
x402

## Headline
Every API call buys back $HARUKA.

## Subheadline
100% of revenue. Automatic. On-chain. Transparent.

---

### What is x402?

x402 is an open payment protocol that embeds
payments directly into API requests using
HTTP status code 402 "Payment Required."

When a developer calls the Haruka API,
x402 handles the payment automatically.
No invoices. No accounts. No manual process.
Everything settles on Solana.

---

### How It Works in HARUKA

```
Developer calls Haruka API
↓
x402 middleware checks: paid?
↓
NO  → return 402 with payment instructions
YES → request goes through, Haruka responds
↓
USDC payment lands in HARUKA treasury wallet
↓
Buyback bot detects incoming USDC
↓
Auto swap USDC → $HARUKA via Jupiter DEX
↓
$HARUKA gets burned permanently
↓
Circulating supply decreases
```

---

### Buyback & Burn

100% of every payment from API usage goes directly to
buying back and burning $HARUKA.

Not 50%. Not 70%. All of it.

No team cut.
No operational budget.
The full amount goes back to the token.

The more developers that build with Haruka,
the more $HARUKA gets bought and burned.
Usage directly benefits holders.

---

### Pricing Tiers

| Tier | Rate | Access |
|---|---|---|
| Free | $0 | 100 calls/day (testing) |
| Basic | $0.001 USDC/call | Unlimited |
| Holder | $0.0005 USDC/call | Hold $HARUKA for 50% discount |

---

### Token Utility — $HARUKA

**For Holders:**
- 100% API revenue → buyback & burn
- Token-gated features — hold to unlock premium
- Holder discount on API pricing
- Supply decreases with every API call

**For Developers:**
- Hold $HARUKA → reduced API rate
- Access to premium embed features

**For Users:**
- Hold $HARUKA → unlock deeper memory
- Hold $HARUKA → unlock custom personality
- Hold $HARUKA → unlock priority response
- Swap utility — buy $HARUKA inside the chat

---

### Supply Mechanics

```
Total supply    : Fixed — no new minting
Burn mechanism  : Every API payment = burn
Deflationary    : More usage = less supply
Lock            : 34M tokens locked via Streamflow
```

---

### Treasury

Treasury wallet is public and verifiable on-chain.
Anyone can check the balance and transaction history.

All buybacks and burns are visible on Solana explorer.

---

### Token Info

- Token: $HARUKA
- Network: Solana
- CA: 9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump

---

### Status

x402 is currently running on devnet.
Mainnet deployment coming soon.
Buyback bot will activate once x402 is on mainnet.
