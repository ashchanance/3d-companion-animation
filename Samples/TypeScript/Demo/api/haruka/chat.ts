import type { HarukaChatRequest } from '../../src/harukaChatContract';
import { runHarukaChat } from '../../src/server/harukaChatService';

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...(init?.headers || {})
    }
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed.' }, { status: 405 });
    }

    try {
      const payload = (await request.json()) as HarukaChatRequest;
      const result = await runHarukaChat(payload);

      return json(result, {
        status: result.ok ? 200 : 502
      });
    } catch (error) {
      return json(
        {
          ok: false,
          reply: 'A server error occurred while processing Haruka chat.',
          error: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
  }
};
