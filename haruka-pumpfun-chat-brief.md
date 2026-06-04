# Developer Brief — HARUKA x Pump.fun Live Chat Integration

---

## OVERVIEW

Integrate Pump.fun live chat into HARUKA so that during a livestream,
comments from viewers are read by Haruka in real-time and she responds naturally.

---

## HOW IT WORKS

```
Viewer comment on Pump.fun live
↓
pump-chat-client picks up the message via WebSocket
↓
Message formatted as HARUKA input
↓
Sent to HARUKA conversation pipeline
↓
Haruka responds via voice + text in real-time
```

---

## TECH STACK

- **pump-chat-client** — WebSocket client untuk Pump.fun chat
- **TypeScript / Node.js** — runtime
- **HARUKA existing WebSocket** — `wss://engine.moeru.ai/haruka/ws`

---

## STEP 1 — INSTALL DEPENDENCY

```bash
npm install pump-chat-client
```

---

## STEP 2 — CONNECT TO PUMP.FUN CHAT

```typescript
import { PumpChatClient } from 'pump-chat-client';

const TOKEN_ADDRESS = '9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump';

const client = new PumpChatClient(TOKEN_ADDRESS);

client.on('message', (msg) => {
  const { username, text } = msg;
  console.log(`[${username}]: ${text}`);
  handleIncomingComment(username, text);
});

client.connect();
```

---

## STEP 3 — FORMAT MESSAGE FOR HARUKA

```typescript
function formatForHaruka(username: string, text: string): string {
  return `viewer ${username} says: "${text}"`;
}
```

---

## STEP 4 — SEND TO HARUKA WEBSOCKET

```typescript
import WebSocket from 'ws';

const HARUKA_WS = 'wss://engine.moeru.ai/haruka/ws';
const harukaSocket = new WebSocket(HARUKA_WS);

function sendToHaruka(username: string, text: string) {
  const message = formatForHaruka(username, text);
  
  harukaSocket.send(JSON.stringify({
    type: 'chat',
    content: message
  }));
}
```

---

## STEP 5 — QUEUE SYSTEM (PENTING)

Kalau komentar masuk ramai-ramai sekaligus,
Haruka tidak boleh respond semua — harus antri.

```typescript
const messageQueue: Array<{ username: string; text: string }> = [];
let isProcessing = false;

function handleIncomingComment(username: string, text: string) {
  // Filter komentar kosong atau spam
  if (!text || text.length < 2) return;
  
  messageQueue.push({ username, text });
  
  if (!isProcessing) {
    processQueue();
  }
}

async function processQueue() {
  isProcessing = true;
  
  while (messageQueue.length > 0) {
    const next = messageQueue.shift();
    if (next) {
      sendToHaruka(next.username, next.text);
      // Wait 5 seconds before processing next message
      await delay(5000);
    }
  }
  
  isProcessing = false;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## STEP 6 — FILTER SPAM / IRRELEVANT COMMENTS

```typescript
const BLOCKED_WORDS = ['spam', 'rug', 'scam'];
const MIN_LENGTH = 3;
const MAX_LENGTH = 200;

function isValidComment(text: string): boolean {
  if (text.length < MIN_LENGTH) return false;
  if (text.length > MAX_LENGTH) return false;
  
  const lower = text.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) return false;
  }
  
  return true;
}
```

---

## FULL INTEGRATION (COMBINED)

```typescript
import { PumpChatClient } from 'pump-chat-client';
import WebSocket from 'ws';

const TOKEN_ADDRESS = '9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump';
const HARUKA_WS = 'wss://engine.moeru.ai/haruka/ws';

const BLOCKED_WORDS = ['spam', 'rug', 'scam'];
const messageQueue: Array<{ username: string; text: string }> = [];
let isProcessing = false;

// Connect to HARUKA
const harukaSocket = new WebSocket(HARUKA_WS);

harukaSocket.on('open', () => {
  console.log('Connected to HARUKA');
});

// Connect to Pump.fun chat
const client = new PumpChatClient(TOKEN_ADDRESS);

client.on('message', (msg) => {
  const { username, text } = msg;
  
  if (!isValidComment(text)) return;
  
  messageQueue.push({ username, text });
  if (!isProcessing) processQueue();
});

client.connect();

// Functions
function isValidComment(text: string): boolean {
  if (!text || text.length < 3 || text.length > 200) return false;
  const lower = text.toLowerCase();
  return !BLOCKED_WORDS.some(word => lower.includes(word));
}

function formatForHaruka(username: string, text: string): string {
  return `viewer ${username} says: "${text}"`;
}

function sendToHaruka(username: string, text: string) {
  if (harukaSocket.readyState !== WebSocket.OPEN) return;
  
  harukaSocket.send(JSON.stringify({
    type: 'chat',
    content: formatForHaruka(username, text)
  }));
}

async function processQueue() {
  isProcessing = true;
  while (messageQueue.length > 0) {
    const next = messageQueue.shift();
    if (next) {
      sendToHaruka(next.username, next.text);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  isProcessing = false;
}
```

---

## NOTES UNTUK DEV

- Queue delay **5 detik** bisa disesuaikan — kalau chat sepi bisa 3 detik,
  kalau ramai bisa 8-10 detik
- `BLOCKED_WORDS` tambahkan sesuai kebutuhan
- Test dulu dengan connect ke token address tanpa live stream
  buat pastikan WebSocket connection stabil
- Pastikan `wss://engine.moeru.ai/haruka/ws` message format
  sesuai dengan yang sudah dipakai di HARUKA existing codebase

---

## ESTIMASI WAKTU

| Task | Estimasi |
|---|---|
| Setup & connect pump-chat-client | 2-3 jam |
| Integrate ke HARUKA WebSocket | 3-4 jam |
| Queue system + filter spam | 2-3 jam |
| Testing & debugging | 4-6 jam |
| **Total** | **1-2 hari** |
