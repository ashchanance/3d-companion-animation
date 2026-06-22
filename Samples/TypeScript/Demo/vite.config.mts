import path from 'path';
import { createRequire } from 'module';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, loadEnv, type ConfigEnv, type Plugin, type UserConfig } from 'vite';
import type { HarukaChatRequest } from './src/harukaChatContract';
import { runHarukaChat } from './src/server/harukaChatService';
import type { HarukaGameFrameRequest } from './src/server/harukaGameFrameService';
import { runHarukaGameFrame } from './src/server/harukaGameFrameService';

const require = createRequire(import.meta.url);
const { PumpChatClient } = require('pump-chat-client') as typeof import('pump-chat-client');
const harukaHealthHandler = require('./api/haruka/health.js') as (
  request: IncomingMessage & { body?: unknown },
  response: ServerResponse
) => void | Promise<void>;
const harukaPortfolioSnapshotHandler = require('./api/haruka/portfolio-snapshot.js') as (
  request: IncomingMessage & { body?: unknown },
  response: ServerResponse
) => void | Promise<void>;
const harukaRewardStateHandler = require('./api/haruka/reward-state.js') as (
  request: IncomingMessage & { body?: unknown },
  response: ServerResponse
) => void | Promise<void>;
const harukaRewardClaimHandler = require('./api/haruka/reward-claim.js') as (
  request: IncomingMessage & { body?: unknown },
  response: ServerResponse
) => void | Promise<void>;

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

function createStaticRouteAliasPlugin(): Plugin {
  const routeMap = new Map<string, string>([
    ['/about-us', '/about-us.html'],
    ['/roadmap', '/roadmap.html'],
    ['/docs', '/docs.html'],
    ['/features', '/features.html'],
    ['/x402', '/x402.html'],
    ['/lore', '/lore.html'],
    ['/utility', '/utility.html'],
    ['/game', '/game/index.html'],
  ]);

  const attach = (server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, _res, next) => {
      if (req.method !== 'GET' || !req.url) {
        next();
        return;
      }

      const requestUrl = new URL(req.url, 'http://127.0.0.1');
      const rewriteTarget = routeMap.get(requestUrl.pathname);
      if (!rewriteTarget) {
        next();
        return;
      }

      requestUrl.pathname = rewriteTarget;
      req.url = `${requestUrl.pathname}${requestUrl.search}`;
      next();
    });
  };

  return {
    name: 'haruka-static-route-alias',
    configureServer(server) {
      attach(server);
    },
    configurePreviewServer(server) {
      attach(server);
    }
  };
}

function createHarukaChatPlugin(): Plugin {
  const handleNodeRequest = (req: IncomingMessage, res: ServerResponse): void => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Haruka-Api-Key'
      });
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, {
        'Content-Type': 'application/json',
        Allow: 'POST'
      });
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed.' }));
      return;
    }

    void readJsonBody<HarukaChatRequest>(req)
      .then((payload) => runHarukaChat(payload))
      .then((result) => {
        const statusCode =
          typeof result.statusCode === 'number'
            ? result.statusCode
            : result.ok
              ? 200
              : result.error === 'Embed API key validation failed.'
                ? 401
                : 502;
        res.writeHead(statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result));
      })
      .catch((error: unknown) => {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(
          JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          })
        );
      });
  };

  const handleGameFrameNodeRequest = (req: IncomingMessage, res: ServerResponse): void => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, {
        'Content-Type': 'application/json',
        Allow: 'POST'
      });
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed.' }));
      return;
    }

    void readJsonBody<HarukaGameFrameRequest>(req)
      .then((payload) => runHarukaGameFrame(payload))
      .then((result) => {
        const statusCode = result.ok ? 200 : 502;
        res.writeHead(statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(result));
      })
      .catch((error: unknown) => {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(
          JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          })
        );
      });
  };

  const adaptNodeResponse = (
    res: ServerResponse
  ): ServerResponse & {
    status: (code: number) => ServerResponse;
    json: (payload: unknown) => void;
  } => {
    const response = res as ServerResponse & {
      status?: (code: number) => ServerResponse;
      json?: (payload: unknown) => void;
    };

    if (typeof response.status !== 'function') {
      response.status = (code: number) => {
        response.statusCode = code;
        return response;
      };
    }

    if (typeof response.json !== 'function') {
      response.json = (payload: unknown) => {
        if (!response.headersSent) {
          response.setHeader('Content-Type', 'application/json');
        }
        response.end(JSON.stringify(payload));
      };
    }

    return response as ServerResponse & {
      status: (code: number) => ServerResponse;
      json: (payload: unknown) => void;
    };
  };

  const handleVercelNodeRoute = async (
    req: IncomingMessage & { body?: unknown },
    res: ServerResponse,
    routeHandler: (request: IncomingMessage & { body?: unknown }, response: ServerResponse) => void | Promise<void>
  ): Promise<void> => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
      req.body = await readJsonBody<Record<string, unknown>>(req);
    }

    const adaptedResponse = adaptNodeResponse(res);
    await routeHandler(req, adaptedResponse);
  };

  const attach = (server: { middlewares: { use: (handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      const requestUrl = req.url ? new URL(req.url, 'http://127.0.0.1') : null;
      if (requestUrl?.pathname === '/api/haruka/health') {
        void handleVercelNodeRoute(req, res, harukaHealthHandler).catch((error: unknown) => {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error)
            })
          );
        });
        return;
      }

      if (requestUrl?.pathname === '/api/haruka/game-frame') {
        handleGameFrameNodeRequest(req, res);
        return;
      }

      if (requestUrl?.pathname === '/api/haruka/portfolio-snapshot') {
        void handleVercelNodeRoute(req, res, harukaPortfolioSnapshotHandler).catch((error: unknown) => {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error)
            })
          );
        });
        return;
      }

      if (requestUrl?.pathname === '/api/haruka/reward-state') {
        void handleVercelNodeRoute(req, res, harukaRewardStateHandler).catch((error: unknown) => {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error)
            })
          );
        });
        return;
      }

      if (requestUrl?.pathname === '/api/haruka/reward-claim') {
        void handleVercelNodeRoute(req, res, harukaRewardClaimHandler).catch((error: unknown) => {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error)
            })
          );
        });
        return;
      }

      if (requestUrl?.pathname !== '/api/haruka/chat') {
        next();
        return;
      }

      handleNodeRequest(req, res);
    });
  };

  return {
    name: 'haruka-chat-adapter',
    configureServer(server) {
      attach(server);
    },
    configurePreviewServer(server) {
      attach(server);
    }
  };
}

function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(raw) as T);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
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
  const resolvedEnv = loadEnv(env.mode, __dirname, '');
  for (const [key, value] of Object.entries(resolvedEnv)) {
    if (typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  }

  return {
    plugins: [createPumpfunStreamPlugin(), createStaticRouteAliasPlugin(), createHarukaChatPlugin()],
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
          features: path.resolve(__dirname, 'features.html'),
          x402: path.resolve(__dirname, 'x402.html'),
          utility: path.resolve(__dirname, 'utility.html'),
          game: path.resolve(__dirname, 'game/index.html')
        }
      }
    }
  };
});
