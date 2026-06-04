import { PumpChatClient } from 'pump-chat-client';

function encodeSse(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed.' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    try {
      const requestUrl = new URL(request.url);
      const tokenAddress = requestUrl.searchParams.get('tokenAddress')?.trim() || '';
      const username = requestUrl.searchParams.get('username')?.trim() || 'HarukaRelay';
      const historyLimit = Number.parseInt(requestUrl.searchParams.get('historyLimit') || '50', 10);
      const requestedPumpWsUrl = requestUrl.searchParams.get('pumpWsUrl')?.trim();
      const defaultPumpWsUrl = 'wss://livechat.pump.fun/socket.io/?EIO=4&transport=websocket';

      const stream = new ReadableStream({
        start(controller) {
          const send = (event: string, payload: unknown) => {
            controller.enqueue(new TextEncoder().encode(encodeSse(event, payload)));
          };

          if (!tokenAddress) {
            send('activity', {
              timestamp: new Date().toISOString(),
              level: 'error',
              type: 'validation-error',
              title: 'Missing token address',
              detail: 'Pump.fun token address is required before the live stream can start.'
            });
            controller.close();
            return;
          }

          if (requestedPumpWsUrl && requestedPumpWsUrl !== defaultPumpWsUrl) {
            send('activity', {
              timestamp: new Date().toISOString(),
              level: 'warn',
              type: 'ws-override-ignored',
              title: 'Custom websocket ignored',
              detail: 'The live stream currently uses the default Pump.fun websocket endpoint.'
            });
          }

          send('state', {
            running: true,
            pumpConnected: false,
            lastError: null,
            activeTokenAddress: tokenAddress
          });
          send('activity', {
            timestamp: new Date().toISOString(),
            level: 'info',
            type: 'relay-started',
            title: 'Relay started',
            detail: 'The Vercel Pump.fun stream is now listening for live comments.'
          });

          const pumpClient: any = new PumpChatClient({
            roomId: tokenAddress,
            username,
            messageHistoryLimit: Number.isFinite(historyLimit) ? Math.max(1, historyLimit) : 50
          });

          const heartbeat = setInterval(() => {
            controller.enqueue(new TextEncoder().encode(': keepalive\n\n'));
          }, 15000);

          const cleanup = () => {
            clearInterval(heartbeat);
            pumpClient.removeAllListeners();
            try {
              pumpClient.disconnect();
            } catch {
              // Ignore teardown failures.
            }
            controller.close();
          };

          pumpClient.on('connected', () => {
            send('state', {
              running: true,
              pumpConnected: true,
              lastError: null,
              activeTokenAddress: tokenAddress
            });
            send('activity', {
              timestamp: new Date().toISOString(),
              level: 'info',
              type: 'pump-connected',
              title: 'Pump.fun chat connected',
              detail: `Listening to ${tokenAddress}.`
            });
          });

          pumpClient.on('messageHistory', (messages: Array<{ username?: string; message?: string }>) => {
            send('activity', {
              timestamp: new Date().toISOString(),
              level: 'info',
              type: 'history',
              title: 'History synced',
              detail: `Loaded ${messages.length} recent Pump.fun messages.`
            });
          });

          pumpClient.on('message', (message: { username?: string; message?: string }) => {
            send('comment', {
              username: message.username?.trim() || 'anonymous',
              message: message.message?.trim() || ''
            });
          });

          pumpClient.on('error', (error: unknown) => {
            const detail = error instanceof Error ? error.message : String(error);
            send('state', {
              running: true,
              pumpConnected: false,
              lastError: detail,
              activeTokenAddress: tokenAddress
            });
            send('activity', {
              timestamp: new Date().toISOString(),
              level: 'error',
              type: 'pump-error',
              title: 'Pump.fun chat error',
              detail
            });
          });

          pumpClient.on('disconnected', () => {
            send('state', {
              running: true,
              pumpConnected: false,
              lastError: null,
              activeTokenAddress: tokenAddress
            });
            send('activity', {
              timestamp: new Date().toISOString(),
              level: 'warn',
              type: 'pump-disconnected',
              title: 'Pump.fun chat disconnected',
              detail: 'The Pump.fun chat socket closed. The browser will reconnect by reopening this stream.'
            });
          });

          request.signal.addEventListener('abort', cleanup, { once: true });
          pumpClient.connect();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }
};
