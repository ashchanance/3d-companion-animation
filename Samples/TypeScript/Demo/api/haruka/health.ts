const ROUTE_VERSION = 'api-haruka-health-2026-06-05-v1';

interface VercelLikeRequest {
  method?: string;
}

interface VercelLikeResponse {
  status: (code: number) => VercelLikeResponse;
  setHeader: (name: string, value: string | string[]) => void;
  json: (body: unknown) => void;
}

export default function handler(_request: VercelLikeRequest, response: VercelLikeResponse): void {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.status(200).json({
    ok: true,
    routeVersion: ROUTE_VERSION,
    deploymentEnv: process.env.VERCEL_ENV || 'local',
    vercelRegion: process.env.VERCEL_REGION || 'unknown',
    hasMegallmApiKey: Boolean(process.env.VITE_MEGALLM_API_KEY),
    megallmApiKeyLength: (process.env.VITE_MEGALLM_API_KEY || '').length,
    megallmBaseUrl: process.env.VITE_MEGALLM_BASE_URL || '',
    megallmModel: process.env.VITE_MEGALLM_MODEL || ''
  });
}
