const { PumpChatClient } = require('pump-chat-client');

const ROUTE_VERSION = 'api-pumpfun-live-stream-2026-06-23-v1';
const DEFAULT_HISTORY_LIMIT = 50;
const DEFAULT_PUMP_WS_URL = 'wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket';

function encodeSse(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function writeJson(response, statusCode, payload) {
  response.status(statusCode).setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.json(payload);
}

function createActivity(level, type, title, detail) {
  return {
    timestamp: new Date().toISOString(),
    level,
    type,
    title,
    detail
  };
}

module.exports = async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (request.method !== 'GET') {
    writeJson(response, 405, {
      ok: false,
      error: 'Method not allowed.',
      debug: {
        routeVersion: ROUTE_VERSION
      }
    });
    return;
  }

  let pumpClient = null;
  let heartbeat = null;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (pumpClient) {
      pumpClient.removeAllListeners();
      try {
        pumpClient.disconnect();
      } catch (error) {
        console.warn('[pumpfun-live-stream] disconnect cleanup failed:', error instanceof Error ? error.message : String(error));
      }
      pumpClient = null;
    }
    if (!response.writableEnded) {
      response.end();
    }
  };

  try {
    const baseUrl = `https://${request.headers.host || 'www.harukacompanion.tech'}`;
    const requestUrl = new URL(request.url, baseUrl);
    const tokenAddress = requestUrl.searchParams.get('tokenAddress')?.trim() || '';
    const username = requestUrl.searchParams.get('username')?.trim() || 'HarukaRelay';
    const historyLimit = Number.parseInt(requestUrl.searchParams.get('historyLimit') || String(DEFAULT_HISTORY_LIMIT), 10);
    const requestedPumpWsUrl = requestUrl.searchParams.get('pumpWsUrl')?.trim() || '';

    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Haruka-Route-Version': ROUTE_VERSION
    });

    if (typeof response.flushHeaders === 'function') {
      response.flushHeaders();
    }

    const send = (event, payload) => {
      if (!response.writableEnded) {
        response.write(encodeSse(event, payload));
      }
    };

    if (!tokenAddress) {
      send('activity', createActivity('error', 'validation-error', 'Missing token address', 'Pump.fun token address is required before the live stream can start.'));
      cleanup();
      return;
    }

    if (requestedPumpWsUrl && requestedPumpWsUrl !== DEFAULT_PUMP_WS_URL) {
      send('activity', createActivity('warn', 'ws-override-ignored', 'Custom websocket ignored', 'The live stream currently uses the default Pump.fun websocket endpoint.'));
    }

    send('state', {
      running: true,
      pumpConnected: false,
      lastError: null,
      activeTokenAddress: tokenAddress
    });
    send('activity', createActivity('info', 'relay-started', 'Relay started', 'The Vercel Pump.fun stream is now listening for live comments.'));

    pumpClient = new PumpChatClient({
      roomId: tokenAddress,
      username,
      messageHistoryLimit: Number.isFinite(historyLimit) ? Math.max(1, historyLimit) : DEFAULT_HISTORY_LIMIT
    });

    heartbeat = setInterval(() => {
      if (!response.writableEnded) {
        response.write(': keepalive\n\n');
        return;
      }

      cleanup();
    }, 15000);

    pumpClient.on('connected', () => {
      send('state', {
        running: true,
        pumpConnected: true,
        lastError: null,
        activeTokenAddress: tokenAddress
      });
      send('activity', createActivity('info', 'pump-connected', 'Pump.fun chat connected', `Listening to ${tokenAddress}.`));
    });

    pumpClient.on('messageHistory', (messages) => {
      send('activity', createActivity('info', 'history', 'History synced', `Loaded ${Array.isArray(messages) ? messages.length : 0} recent Pump.fun messages.`));
    });

    pumpClient.on('message', (message) => {
      send('comment', {
        username: message && typeof message.username === 'string' && message.username.trim() ? message.username.trim() : 'anonymous',
        message: message && typeof message.message === 'string' ? message.message.trim() : ''
      });
    });

    pumpClient.on('error', (error) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.error('[pumpfun-live-stream] pump client error:', detail);
      send('state', {
        running: true,
        pumpConnected: false,
        lastError: detail,
        activeTokenAddress: tokenAddress
      });
      send('activity', createActivity('error', 'pump-error', 'Pump.fun chat error', detail));
    });

    pumpClient.on('disconnected', () => {
      send('state', {
        running: true,
        pumpConnected: false,
        lastError: null,
        activeTokenAddress: tokenAddress
      });
      send('activity', createActivity('warn', 'pump-disconnected', 'Pump.fun chat disconnected', 'The Pump.fun chat socket closed. The browser will reconnect by reopening this stream.'));
    });

    request.on('close', cleanup);
    request.on('aborted', cleanup);
    response.on('close', cleanup);

    pumpClient.connect();
  } catch (error) {
    console.error('[pumpfun-live-stream] route initialization failed:', error instanceof Error ? error.stack || error.message : String(error));
    cleanup();
    if (response.headersSent) {
      if (!response.writableEnded) {
        response.write(encodeSse('activity', createActivity('error', 'stream-init-error', 'Stream initialization failed', error instanceof Error ? error.message : String(error))));
        response.end();
      }
      return;
    }

    writeJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      debug: {
        routeVersion: ROUTE_VERSION
      }
    });
  }
};
