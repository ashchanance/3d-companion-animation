import path from 'path';
import { createRequire } from 'module';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, type ConfigEnv, type Plugin, type UserConfig } from 'vite';

const require = createRequire(import.meta.url);
const { PumpChatClient } = require('pump-chat-client') as typeof import('pump-chat-client');

type RelayLevel = 'info' | 'warn' | 'error';

interface PumpBridgeState {
  running: boolean;
  pumpConnected: boolean;
  lastError: string | null;
  activeTokenAddress: string;
}

interface RelayActivityPayload {
  level: RelayLevel;
  type: string;
  title: string;
  detail: string;
  username?: string;
  message?: string;
}

interface BridgeConnectPayload {
  tokenAddress?: string;
  username?: string;
  historyLimit?: number;
  pumpWsUrl?: string;
}

interface PumpChatMessage {
  username?: string;
  message?: string;
}

function createPumpLiveBridgePlugin(): Plugin {
  const sseClients = new Set<ServerResponse>();
  const defaultPumpWsUrl = 'wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket';

  let pumpClient: import('pump-chat-client').PumpChatClient | null = null;
  let state: PumpBridgeState = {
    running: false,
    pumpConnected: false,
    lastError: null,
    activeTokenAddress: ''
  };

  const sendJson = (res: ServerResponse, statusCode: number, payload: unknown): void => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
  };

  const sendSse = (res: ServerResponse, event: string, payload: unknown): void => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const broadcast = (event: string, payload: unknown): void => {
    for (const client of sseClients) {
      sendSse(client, event, payload);
    }
  };

  const broadcastState = (): void => {
    broadcast('state', state);
  };

  const emitActivity = (payload: RelayActivityPayload): void => {
    broadcast('activity', {
      timestamp: new Date().toISOString(),
      ...payload
    });
  };

  const destroyPumpClient = (): void => {
    if (!pumpClient) {
      return;
    }

    pumpClient.removeAllListeners();
    try {
      pumpClient.disconnect();
    } catch {
      // Ignore disconnect failures during teardown.
    }
    pumpClient = null;
  };

  const stopBridge = (emitStopActivity: boolean): void => {
    destroyPumpClient();
    state = {
      ...state,
      running: false,
      pumpConnected: false,
      lastError: null
    };
    broadcastState();

    if (emitStopActivity) {
      emitActivity({
        level: 'info',
        type: 'relay-stopped',
        title: 'Relay stopped',
        detail: 'The local Pump.fun helper has been stopped.'
      });
    }
  };

  const startBridge = (payload: BridgeConnectPayload): { ok: boolean; error?: string } => {
    const tokenAddress = payload.tokenAddress?.trim() ?? '';
    const username = payload.username?.trim() || 'HarukaRelay';
    const historyLimit = Number.isFinite(payload.historyLimit) ? Math.max(1, Number(payload.historyLimit)) : 50;
    const pumpWsUrl = payload.pumpWsUrl?.trim() || defaultPumpWsUrl;

    if (!tokenAddress) {
      return { ok: false, error: 'Pump.fun token address is required.' };
    }

    if (pumpWsUrl !== defaultPumpWsUrl) {
      return {
        ok: false,
        error: 'Pump.fun currently rejects custom browser websocket origins. Keep the default websocket URL and use the local helper.'
      };
    }

    destroyPumpClient();
    state = {
      running: true,
      pumpConnected: false,
      lastError: null,
      activeTokenAddress: tokenAddress
    };
    broadcastState();

    const client = new PumpChatClient({
      roomId: tokenAddress,
      username,
      messageHistoryLimit: historyLimit
    });
    pumpClient = client;

    client.on('connected', () => {
      state = {
        ...state,
        pumpConnected: true,
        lastError: null
      };
      broadcastState();
      emitActivity({
        level: 'info',
        type: 'pump-connected',
        title: 'Pump.fun chat connected',
        detail: `Listening to ${tokenAddress}.`
      });
    });

    client.on('messageHistory', (messages: PumpChatMessage[]) => {
      emitActivity({
        level: 'info',
        type: 'history',
        title: 'History synced',
        detail: `Loaded ${messages.length} recent Pump.fun messages.`
      });
    });

    client.on('message', (message: PumpChatMessage) => {
      broadcast('comment', {
        username: message.username?.trim() || 'anonymous',
        message: message.message?.trim() || ''
      });
    });

    client.on('error', (error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      state = {
        ...state,
        pumpConnected: false,
        lastError: detail
      };
      broadcastState();
      emitActivity({
        level: 'error',
        type: 'pump-error',
        title: 'Pump.fun chat error',
        detail
      });
    });

    client.on('disconnected', () => {
      state = {
        ...state,
        pumpConnected: false
      };
      broadcastState();
      if (state.running) {
        emitActivity({
          level: 'warn',
          type: 'pump-disconnected',
          title: 'Pump.fun chat disconnected',
          detail: 'The Pump.fun chat socket closed. The local helper may reconnect automatically.'
        });
      }
    });

    client.connect();
    emitActivity({
      level: 'info',
      type: 'relay-started',
      title: 'Relay started',
      detail: 'The local Pump.fun helper is now listening for live comments.'
    });
    return { ok: true };
  };

  const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }

    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  };

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> => {
    const requestUrl = req.url ? new URL(req.url, 'http://127.0.0.1') : null;
    const pathname = requestUrl?.pathname ?? '';

    if (req.method === 'GET' && pathname === '/__pumpfun_live/state') {
      sendJson(res, 200, state);
      return;
    }

    if (req.method === 'GET' && pathname === '/__pumpfun_live/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write('\n');
      sseClients.add(res);
      sendSse(res, 'state', state);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/__pumpfun_live/connect') {
      try {
        const payload = (await readJsonBody(req)) as BridgeConnectPayload;
        const result = startBridge(payload);
        if (!result.ok) {
          sendJson(res, 400, result);
          return;
        }
        sendJson(res, 200, { ok: true, state });
      } catch (error) {
        sendJson(res, 500, {
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown connect error.'
        });
      }
      return;
    }

    if (req.method === 'POST' && pathname === '/__pumpfun_live/disconnect') {
      stopBridge(true);
      sendJson(res, 200, { ok: true, state });
      return;
    }

    next();
  };

  return {
    name: 'pumpfun-live-bridge',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void middleware(req, res, next);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void middleware(req, res, next);
      });
    }
  };
}

export default defineConfig((env: ConfigEnv): UserConfig => {
  return {
    plugins: [createPumpLiveBridgePlugin()],
    server: {
      port: 5000
    },
    root: './',
    base: '/',
    publicDir: './public',
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@framework': path.resolve(__dirname, '../../../Framework/src')
      }
    },
    build: {
      target: 'baseline-widely-available',
      assetsDir: 'assets',
      outDir: './dist',
      sourcemap: env.mode === 'development',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          lore: path.resolve(__dirname, 'lore.html'),
          'about-us': path.resolve(__dirname, 'about-us.html'),
          roadmap: path.resolve(__dirname, 'roadmap.html'),
          docs: path.resolve(__dirname, 'docs.html'),
          features: path.resolve(__dirname, 'features.html')
        }
      }
    }
  };
});
