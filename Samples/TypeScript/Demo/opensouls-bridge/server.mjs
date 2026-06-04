import { runBundledHarukaOpenSoulsBridge } from '../src/server/harukaOpenSoulsBridge.ts';

const DEFAULT_PORT = Number.parseInt(process.env.HARUKA_BRIDGE_PORT || '4100', 10);

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...(init.headers || {})
    }
  });
}

async function handleRespond(request) {
  const body = await request.json();
  const result = await runBundledHarukaOpenSoulsBridge({
    message: typeof body?.message === 'string' ? body.message.trim() : '',
    history: Array.isArray(body?.history) ? body.history : [],
    language: body?.language === 'jp' ? 'jp' : 'en',
    profileId: typeof body?.profileId === 'string' ? body.profileId : 'classic',
    engineMode: 'opensouls-bridge',
    providerId: typeof body?.providerId === 'string' ? body.providerId : 'openai-compatible',
    providerConfig: typeof body?.providerConfig === 'object' && body?.providerConfig ? body.providerConfig : undefined,
    openSouls: { baseUrl: 'bundled' },
    source: body?.source === 'pumpfun-relay' ? 'pumpfun-relay' : 'chat-ui',
    username: typeof body?.username === 'string' ? body.username : undefined
  });

  return json(
    {
      ...result,
      soulName: 'haruka'
    },
    { status: result.ok ? 200 : 502 }
  );
}

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number.isFinite(DEFAULT_PORT) ? DEFAULT_PORT : 4100,
  fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({
        ok: true,
        service: 'haruka-opensouls-bridge',
        soulName: 'haruka',
        port: server.port,
        mode: 'bundled'
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/haruka/respond') {
      return handleRespond(request);
    }

    return json({ ok: false, error: 'Not found.' }, { status: 404 });
  }
});

console.log(`[haruka-opensouls-bridge] listening on http://127.0.0.1:${server.port}`);
