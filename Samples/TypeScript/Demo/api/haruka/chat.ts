import type { HarukaChatRequest } from '../../src/harukaChatContract';
import { runHarukaChat } from '../../src/server/harukaChatService.js';

const ROUTE_VERSION = 'api-haruka-chat-2026-06-05-v4';

interface VercelLikeRequest {
  method?: string;
  body?: unknown;
}

interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  setHeader: (name: string, value: string | string[]) => void;
  json: (body: unknown) => void;
  end: (body?: string) => void;
}

function applyHeaders(response: VercelLikeResponse): void {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizeBody(body: unknown): HarukaChatRequest {
  if (typeof body === 'string') {
    return JSON.parse(body) as HarukaChatRequest;
  }

  return body as HarukaChatRequest;
}

export default async function handler(request: VercelLikeRequest, response: VercelLikeResponse): Promise<void> {
  applyHeaders(response);

  if (request.method === 'OPTIONS') {
    response.status(204);
    response.end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  try {
    const payload = normalizeBody(request.body);
    const result = await runHarukaChat(payload);

    response.status(result.ok ? 200 : 502).json({
      ...result,
      debug: {
        routeVersion: ROUTE_VERSION,
        deploymentEnv: process.env.VERCEL_ENV || 'local',
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        ...result.debug
      }
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      reply: 'A server error occurred while processing Haruka chat.',
      error: error instanceof Error ? error.message : String(error),
      debug: {
        routeVersion: ROUTE_VERSION,
        importPhase: 'handler',
        deploymentEnv: process.env.VERCEL_ENV || 'local',
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        hasMegallmApiKey: Boolean(process.env.MEGALLM_API_KEY || process.env.VITE_MEGALLM_API_KEY),
        megallmApiKeyLength: (process.env.MEGALLM_API_KEY || process.env.VITE_MEGALLM_API_KEY || '').length,
        megallmBaseUrl: process.env.MEGALLM_BASE_URL || process.env.VITE_MEGALLM_BASE_URL || '',
        megallmModel: process.env.MEGALLM_MODEL || process.env.VITE_MEGALLM_MODEL || ''
      }
    });
  }
}
