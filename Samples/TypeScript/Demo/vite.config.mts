import path from 'path';
import { createRequire } from 'module';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, type ConfigEnv, type Plugin, type UserConfig } from 'vite';

const require = createRequire(import.meta.url);
const { PumpChatClient } = require('pump-chat-client') as typeof import('pump-chat-client');

function createPumpfunStreamPlugin(): Plugin {
  return {
    name: 'pumpfun-live-stream',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }

        const requestUrl = req.url ? new URL(req.url, 'http://127.0.0.1') : null;
        if (requestUrl?.pathname !== '/api/pumpfun-live/stream') {
          next();
          return;
        }

        void handlePumpfunStreamRequest(req, res, requestUrl);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }

        const requestUrl = req.url ? new URL(req.url, 'http://127.0.0.1') : null;
        if (requestUrl?.pathname !== '/api/pumpfun-live/stream') {
          next();
          return;
        }

        void handlePumpfunStreamRequest(req, res, requestUrl);
      });
    }
  };
}

function writeSse(res: ServerResponse, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function handlePumpfunStreamRequest(
  req: IncomingMessage,
  res: ServerResponse,
  requestUrl: URL
): Promise<void> {
  const tokenAddress = requestUrl.searchParams.get('tokenAddress')?.trim() || '';
  const username = requestUrl.searchParams.get('username')?.trim() || 'HarukaRelay';
  const historyLimit = Number.parseInt(requestUrl.searchParams.get('historyLimit') || '50', 10);
  const requestedPumpWsUrl = requestUrl.searchParams.get('pumpWsUrl')?.trim();
  const defaultPumpWsUrl = 'wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket';

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });

  if (!tokenAddress) {
    writeSse(res, 'activity', {
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'validation-error',
      title: 'Missing token address',
      detail: 'Pump.fun token address is required before the live stream can start.'
    });
    res.end();
    return;
  }

  if (requestedPumpWsUrl && requestedPumpWsUrl !== defaultPumpWsUrl) {
    writeSse(res, 'activity', {
      timestamp: new Date().toISOString(),
      level: 'warn',
      type: 'ws-override-ignored',
      title: 'Custom websocket ignored',
      detail: 'The live stream currently uses the default Pump.fun websocket endpoint.'
    });
  }

  writeSse(res, 'state', {
    running: true,
    pumpConnected: false,
    lastError: null,
    activeTokenAddress: tokenAddress
  });
  writeSse(res, 'activity', {
    timestamp: new Date().toISOString(),
    level: 'info',
    type: 'relay-started',
    title: 'Relay started',
    detail: 'The Vercel-compatible Pump.fun stream is now listening for live comments.'
  });

  const pumpClient = new PumpChatClient({
    roomId: tokenAddress,
    username,
    messageHistoryLimit: Number.isFinite(historyLimit) ? Math.max(1, historyLimit) : 50
  });

  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  const cleanup = (): void => {
    clearInterval(heartbeat);
    pumpClient.removeAllListeners();
    try {
      pumpClient.disconnect();
    } catch {
      // Ignore teardown failures.
    }
    res.end();
  };

  pumpClient.on('connected', () => {
    writeSse(res, 'state', {
      running: true,
      pumpConnected: true,
      lastError: null,
      activeTokenAddress: tokenAddress
    });
    writeSse(res, 'activity', {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'pump-connected',
      title: 'Pump.fun chat connected',
      detail: `Listening to ${tokenAddress}.`
    });
  });

  pumpClient.on('messageHistory', (messages: Array<{ username?: string; message?: string }>) => {
    writeSse(res, 'activity', {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'history',
      title: 'History synced',
      detail: `Loaded ${messages.length} recent Pump.fun messages.`
    });
  });

  pumpClient.on('message', (message: { username?: string; message?: string }) => {
    writeSse(res, 'comment', {
      username: message.username?.trim() || 'anonymous',
      message: message.message?.trim() || ''
    });
  });

  pumpClient.on('error', (error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    writeSse(res, 'state', {
      running: true,
      pumpConnected: false,
      lastError: detail,
      activeTokenAddress: tokenAddress
    });
    writeSse(res, 'activity', {
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'pump-error',
      title: 'Pump.fun chat error',
      detail
    });
  });

  pumpClient.on('disconnected', () => {
    writeSse(res, 'state', {
      running: true,
      pumpConnected: false,
      lastError: null,
      activeTokenAddress: tokenAddress
    });
    writeSse(res, 'activity', {
      timestamp: new Date().toISOString(),
      level: 'warn',
      type: 'pump-disconnected',
      title: 'Pump.fun chat disconnected',
      detail: 'The Pump.fun chat socket closed. The browser will reconnect by reopening this stream.'
    });
  });

  pumpClient.connect();

  req.on('close', () => {
    cleanup();
  });
}

export default defineConfig((env: ConfigEnv): UserConfig => {
  return {
    plugins: [createPumpfunStreamPlugin()],
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
