import type { HarukaChatRequest } from '../../src/harukaChatContract';
import { runHarukaChat } from '../../src/server/harukaChatService';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed.' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          Allow: 'POST'
        }
      });
    }

    const payload = (await request.json()) as HarukaChatRequest;
    const result = await runHarukaChat(payload);

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
