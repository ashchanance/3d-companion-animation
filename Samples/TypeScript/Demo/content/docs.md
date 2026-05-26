# Documentation

## Section Eyebrow
Documentation

## Headline
Get up and running.

## Desc
Everything you need to use, configure, and self-host Haruka.

---

## 1. Overview

### What is Haruka?
Haruka is an open-source, self-hosted AI companion platform featuring an animated 3D character powered by large language models. It runs directly in your browser using WebGPU for private, high-speed AI inference.

Unlike cloud-based chatbots, Haruka processes conversations locally — your data never leaves your device unless you explicitly connect to an external LLM provider.

> 💡 Haruka works best on Chrome or Edge with WebGPU enabled. No installation required for the web version.

### Core Concepts

| Concept | Description |
|---|---|
| Character | Your animated VRM 3D companion — Haruka |
| LLM Provider | The language model powering Haruka's intelligence |
| WebGPU Mode | Runs AI inference entirely on your GPU — fully local & private |
| Voice Mode | Real-time speech recognition + text-to-speech for voice chat |

---

## 2. Quick Start

### Option A — Use the Web App
Simply visit the Haruka web app and click **Start Chat**. No setup needed.

### Option B — Self-Host Locally

```bash
# 1. Clone the repository
git clone https://github.com/faxxxan/KIRA-AI-Companion
cd KIRA-AI-Companion

# 2. Install dependencies (requires pnpm)
pnpm install

# 3. Copy and configure environment
cp .env.example .env

# 4. Start development server
pnpm dev
```

The app will be available at `http://localhost:5173`

> ⚠️ Requires Node.js ≥ 20 and pnpm ≥ 9. Do not use npm or yarn — this project uses pnpm workspaces.

---

## 3. Configuration

### Required Dependencies

| Service | Version | Purpose |
|---|---|---|
| Node.js | ≥ 20 | Runtime environment |
| pnpm | ≥ 9 | Package manager |
| PostgreSQL | ≥ 15 | User data & chat history |
| Redis | ≥ 7 | Session & caching |

### Build Commands

```bash
# Build all apps
pnpm build

# Build web app only
pnpm -F @proj-airi/stage-web build

# Run tests
pnpm test

# Lint codebase
pnpm lint
```

---

## 4. Voice Interaction

Haruka supports real-time, bidirectional voice interaction using the Web Speech API for recognition and a TTS engine for character responses.

### How to Enable
Click the microphone icon in the chat interface. Grant browser microphone permissions when prompted. Haruka will begin listening and responding vocally.

> ℹ️ Voice recognition works best in Chrome or Edge. Safari support is limited due to Web Speech API availability.

### Voice Style
Haruka's voice is cheerful, bright, and energetic — available in English and Japanese.

---

## 5. LLM Providers

Haruka connects to 20+ language model providers. You can switch providers anytime from the settings panel.

| Provider | Status | Notes |
|---|---|---|
| OpenAI (GPT-4o, etc.) | ✓ Supported | Requires API key |
| Anthropic Claude | ✓ Supported | Requires API key |
| DeepSeek | ✓ Supported | Requires API key |
| Google Gemini | ✓ Supported | Requires API key |
| Local (WebGPU) | ✓ Built-in | No API key — fully private |
| Ollama | ✓ Supported | Self-hosted local models |

> ✦ For maximum privacy, use **WebGPU mode** — your conversations are processed entirely on your device.

---

## 6. Self-Hosting Guide

### Project Structure

```
Haruka/
├── apps/
│   ├── stage-web/         # Web application
│   ├── stage-tamagotchi/  # Desktop (Electron)
│   ├── stage-pocket/      # Mobile (iOS/Android)
│   └── server/            # Backend API
├── packages/              # Shared components & utilities
├── plugins/               # Extensions & integrations
└── docs/                  # Documentation source
```

### Platform Commands

```bash
# Desktop app (Electron)
pnpm dev:tamagotchi

# Mobile — iOS
pnpm dev:pocket:ios

# Mobile — Android
pnpm dev:pocket:android
```

---

## 7. Environment Variables

Create a `.env` file in the project root. All required variables must be set before running the server.

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/haruka

# Redis
REDIS_URL=redis://localhost:6379

# Auth secret (generate a long random string)
BETTER_AUTH_SECRET=your-secret-key

# OAuth — optional
AUTH_GOOGLE_CLIENT_ID=your-google-client-id
AUTH_GOOGLE_CLIENT_SECRET=your-google-client-secret
AUTH_GITHUB_CLIENT_ID=your-github-client-id
AUTH_GITHUB_CLIENT_SECRET=your-github-client-secret
```

> ⚠️ `DATABASE_URL`, `REDIS_URL`, and `BETTER_AUTH_SECRET` are required. OAuth variables are optional.

---

## 8. Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

Please read `CONTRIBUTING.md` for details on code of conduct and submission process.
