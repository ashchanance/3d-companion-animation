const ROUTE_VERSION = 'api-haruka-health-2026-06-05-v2';

module.exports = function handler(_request, response) {
  const apiKey = process.env.MEGALLM_API_KEY || process.env.VITE_MEGALLM_API_KEY || '';
  const baseUrl = process.env.MEGALLM_BASE_URL || process.env.VITE_MEGALLM_BASE_URL || '';
  const model = process.env.MEGALLM_MODEL || process.env.VITE_MEGALLM_MODEL || '';

  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.status(200).json({
    ok: true,
    routeVersion: ROUTE_VERSION,
    deploymentEnv: process.env.VERCEL_ENV || 'local',
    vercelRegion: process.env.VERCEL_REGION || 'unknown',
    hasMegallmApiKey: Boolean(apiKey),
    megallmApiKeyLength: apiKey.length,
    megallmBaseUrl: baseUrl,
    megallmModel: model
  });
};
