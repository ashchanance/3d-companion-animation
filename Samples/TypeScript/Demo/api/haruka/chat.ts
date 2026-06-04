import type { HarukaChatRequest } from '../../src/harukaChatContract';
import { runHarukaChat } from '../../src/server/harukaChatService';

export const runtime = 'nodejs';

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

export function OPTIONS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export async function POST(request: Request): Promise<Response> {
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
