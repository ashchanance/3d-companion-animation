const ROUTE_VERSION = 'api-haruka-health-2026-06-05-v4';

function readEmbedKeys() {
  return String(process.env.HARUKA_EMBED_API_KEYS || '')
    .split(/[\r\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBooleanFlag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function splitEnvList(value) {
  return String(value || '')
    .split(/[\r\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyLimits(value) {
  let count = 0;

  for (const entry of splitEnvList(value)) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const rawLimit = entry.slice(separatorIndex + 1).trim();
    const limit = parsePositiveInteger(rawLimit, 0);
    if (limit > 0) {
      count += 1;
    }
  }

  return count;
}

module.exports = function handler(_request, response) {
  const apiKey = process.env.MEGALLM_API_KEY || process.env.VITE_MEGALLM_API_KEY || '';
  const baseUrl = process.env.MEGALLM_BASE_URL || process.env.VITE_MEGALLM_BASE_URL || '';
  const model = process.env.MEGALLM_MODEL || process.env.VITE_MEGALLM_MODEL || '';
  const embedKeys = readEmbedKeys();
  const usageGateEnabled = parseBooleanFlag(process.env.HARUKA_USAGE_GATE_ENABLED);

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
    megallmModel: model,
    bundledOpenSoulsBridgeReady: true,
    defaultOpenSoulsMode: 'bundled',
    externalOpenSoulsBridgeRequired: false,
    embedApiKeyRequired: embedKeys.length > 0,
    configuredEmbedKeyCount: embedKeys.length,
    usageGateEnabled,
    usageWindowMinutes: parsePositiveInteger(process.env.HARUKA_USAGE_WINDOW_MINUTES, 60) || 60,
    webAppWindowLimit: parsePositiveInteger(process.env.HARUKA_USAGE_LIMIT_WEB_APP, 0),
    embedWidgetWindowLimit: parsePositiveInteger(process.env.HARUKA_USAGE_LIMIT_EMBED_WIDGET, 0),
    configuredUsageKeyCount: parseKeyLimits(process.env.HARUKA_USAGE_KEY_LIMITS),
    usageBypassKeyCount: splitEnvList(process.env.HARUKA_USAGE_BYPASS_KEYS).length
  });
};
