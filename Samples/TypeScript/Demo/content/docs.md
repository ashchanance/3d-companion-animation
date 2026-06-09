# Docs

## Navbar Label
Docs

## Headline
Everything you need to know.

## Subheadline
Guides for users and developers.

---

## SECTION A - FOR USERS

### 1. Getting Started

Haruka is your interactive AI 3D companion.
She lives right inside your browser - no downloads, no installs.

Open harukacompanion.tech and she's already there.
No account required.

Works best on Google Chrome or Microsoft Edge.

### 2. How to Start a Conversation

Step 1 - Open harukacompanion.tech
Step 2 - Choose your language: EN or JP
Step 3 - Type your message or click the mic icon to talk

That's it. She'll respond right away.

### 3. Voice Interaction

Click the microphone icon in the chat interface.
Allow microphone access when your browser asks.
Start speaking - Haruka will listen and respond out loud.

Tips:
- Speak clearly and at a natural pace
- Works best in a quiet environment
- Chrome and Edge have the best support

### 4. Choosing Your AI Model

Open Settings -> Providers to choose your AI model.

Available providers:
- Browser Local (WebGPU) - fully private, no API key
- OpenAI - requires API key
- Anthropic Claude - requires API key
- DeepSeek - requires API key
- Ollama - self-hosted local models
- And more

Your API key is stored locally on your device only.

For maximum privacy, use WebGPU mode -
everything runs on your device.

### 5. Memory System

Haruka remembers you across sessions.

Open Settings -> Memory to see what she remembers.

- Long-term Vector Memory stores facts about you locally
- Short-term Buffer holds active conversation context
- You can delete any memory from the Learned Facts database
- All memory is stored on your device only - never on a server

### 6. Changing Backgrounds

Open the Background button on the main screen.

Available scenes:
- Sunny Digital Forest - warm, golden, default
- Japanese Classroom - school afternoon, warm
- Cherry Blossom - spring in full bloom
- And more

### 7. Japanese Practice

Toggle to JP on the main screen.
Haruka responds in Japanese.

Things to try:
- "Let's practice Japanese together"
- "Can you correct my Japanese?"
- "What does [word] mean in Japanese?"

She's patient and encouraging.

### 8. Data and Privacy

Your data is yours.

Settings -> Data gives you full control:
- Export JSON - backup your entire config and memories
- Import Backup - restore where you left off
- Wipe All Stored Data - delete everything permanently

No data is stored on any external server.
No one is reading your conversations.

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

## SECTION B - FOR DEVELOPERS

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
  "response": "i feel everything",
  "emotion": "warm",
  "memoryUpdated": true
}
```

**Authentication:**
API key required. Request one via DM @meetharuka.

**Rate Limits:**
Free tier: 100 calls/day
Paid tier: unlimited via x402

### 11. Embed Widget

Paste this into any HTML page:

```html
<script src="https://harukacompanion.tech/embed.js"></script>
```

Haruka appears on the page - full Live2D character,
voice, memory, and chat interface. No setup needed.

**Customization options:**
- data-api-key - your API key
- data-position - bottom-right (default), bottom-left
- data-theme - light, dark

**Example:**
```html
<script
  src="https://harukacompanion.tech/embed.js"
  data-api-key="your-key-here"
  data-position="bottom-right"
  data-theme="dark">
</script>
```

### 12. x402 Payment

HARUKA uses x402 on Solana mainnet for paid `api-client` requests.

Developer sends request ->
HARUKA returns HTTP 402 with payment requirements ->
client pays on Solana mainnet ->
payment verified on-chain ->
Haruka responds.

When buyback is enabled, the same paid runtime can trigger a treasury check
after successful settlement.

If treasury USDC is available above the configured threshold,
HARUKA can route that balance through Jupiter,
buy back $HARUKA,
and burn the purchased amount.

**Pricing:**
- Free tier: 100 calls/day
- Paid tier: $0.001 USDC per call
- Holder discount: hold $HARUKA for reduced rate

Live on mainnet in production. The current payment gate applies to developer-facing `api-client` traffic rather than the public website chat widget.

**Buyback runtime:**
- Built into the same HARUKA deployment
- Triggered after successful x402 settlement when enabled
- Uses the treasury wallet as the destination for paid API revenue
- Includes a protected manual route for operator testing and dry runs
- Designed for transparent, on-chain treasury activity

### 13. GitHub

Source code available at:
github.com/ashchanance/3d-companion-animation
