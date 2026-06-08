const { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } = require('@x402/core/server');
const { SOLANA_DEVNET_CAIP2 } = require('@x402/svm');
const { registerExactSvmScheme } = require('@x402/svm/exact/server');

const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';
const DEFAULT_PRICE = '$0.001';
const DEFAULT_SCOPE = 'api-client';
const DEFAULT_DESCRIPTION = 'HARUKA paid chat request';
const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const CDP_FACILITATOR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402';
const ROUTE_VERSION = 'api-haruka-x402-2026-06-08-v1';

let cachedRuntimePromise = null;
let cachedRuntimeKey = '';

function parseBooleanFlag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function splitEnvList(value) {
  return String(value || '')
    .split(/[\r\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isDefaultTestnetFacilitator(url) {
  return String(url || '').trim().replace(/\/$/, '') === DEFAULT_FACILITATOR_URL;
}

function isCdpFacilitator(url) {
  return String(url || '').trim().replace(/\/$/, '') === CDP_FACILITATOR_URL;
}

function buildCdpFacilitatorPath(baseUrl, endpoint) {
  const parsed = new URL(baseUrl);
  const basePath = parsed.pathname.replace(/\/$/, '');
  return `${basePath}/${endpoint}`;
}

function loadCdpGenerateJwt() {
  return require('@coinbase/cdp-sdk/auth').generateJwt;
}

async function createCdpAuthHeaders(config) {
  const generateJwt = loadCdpGenerateJwt();
  const parsed = new URL(config.facilitatorUrl);
  const createHeaderSet = async (method, endpoint) => {
    const token = await generateJwt({
      apiKeyId: config.cdpApiKeyId,
      apiKeySecret: config.cdpApiKeySecret,
      requestMethod: method,
      requestHost: parsed.host,
      requestPath: buildCdpFacilitatorPath(config.facilitatorUrl, endpoint),
      expiresIn: 120
    });

    return {
      Authorization: `Bearer ${token}`
    };
  };

  return {
    verify: await createHeaderSet('POST', 'verify'),
    settle: await createHeaderSet('POST', 'settle'),
    supported: await createHeaderSet('GET', 'supported')
  };
}

function readX402Config() {
  const enabled = parseBooleanFlag(process.env.HARUKA_X402_ENABLED);
  const config = {
    enabled,
    scope: String(process.env.HARUKA_X402_SCOPE || DEFAULT_SCOPE).trim() || DEFAULT_SCOPE,
    price: String(process.env.HARUKA_X402_PRICE || DEFAULT_PRICE).trim() || DEFAULT_PRICE,
    network: String(process.env.HARUKA_X402_NETWORK || SOLANA_DEVNET_CAIP2).trim() || SOLANA_DEVNET_CAIP2,
    payTo: String(process.env.HARUKA_X402_PAY_TO || process.env.HARUKA_TREASURY_WALLET || '').trim(),
    facilitatorUrl: String(process.env.HARUKA_X402_FACILITATOR_URL || DEFAULT_FACILITATOR_URL).trim() || DEFAULT_FACILITATOR_URL,
    description: String(process.env.HARUKA_X402_DESCRIPTION || DEFAULT_DESCRIPTION).trim() || DEFAULT_DESCRIPTION,
    bypassKeys: new Set(splitEnvList(process.env.HARUKA_X402_BYPASS_KEYS)),
    facilitatorAuthMode: String(process.env.HARUKA_X402_FACILITATOR_AUTH_MODE || '').trim().toLowerCase(),
    facilitatorBearerToken: String(process.env.HARUKA_X402_FACILITATOR_BEARER_TOKEN || '').trim(),
    cdpApiKeyId: String(process.env.HARUKA_X402_CDP_API_KEY_ID || '').trim(),
    cdpApiKeySecret: String(process.env.HARUKA_X402_CDP_API_KEY_SECRET || '').trim()
  };

  const issues = [];
  if (config.enabled && !config.payTo) {
    issues.push('HARUKA_X402_PAY_TO or HARUKA_TREASURY_WALLET is required when HARUKA_X402_ENABLED=true.');
  }
  if (config.enabled && isDefaultTestnetFacilitator(config.facilitatorUrl) && config.network === SOLANA_MAINNET_CAIP2) {
    issues.push('https://x402.org/facilitator only supports testnets. Use Solana devnet or switch HARUKA_X402_FACILITATOR_URL to a production facilitator for mainnet.');
  }
  if (
    config.enabled &&
    isCdpFacilitator(config.facilitatorUrl) &&
    !config.facilitatorBearerToken &&
    (!config.cdpApiKeyId || !config.cdpApiKeySecret)
  ) {
    issues.push('CDP facilitator requires either HARUKA_X402_FACILITATOR_BEARER_TOKEN or CDP API credentials.');
  }

  return {
    ...config,
    ready: issues.length === 0,
    issues
  };
}

function buildX402Snapshot() {
  const config = readX402Config();
  return {
    x402Enabled: config.enabled,
    x402Ready: config.ready,
    x402Scope: config.scope,
    x402Price: config.price,
    x402Network: config.network,
    x402FacilitatorUrl: config.facilitatorUrl,
    x402PayToConfigured: Boolean(config.payTo),
    x402FacilitatorAuthMode:
      config.facilitatorAuthMode ||
      (config.facilitatorBearerToken ? 'bearer' : isCdpFacilitator(config.facilitatorUrl) ? 'cdp-jwt' : 'none'),
    x402FacilitatorBearerTokenConfigured: Boolean(config.facilitatorBearerToken),
    x402CdpApiKeyConfigured: Boolean(config.cdpApiKeyId && config.cdpApiKeySecret),
    x402BypassKeyCount: config.bypassKeys.size,
    ...(config.issues.length > 0 ? { x402Issues: config.issues } : {})
  };
}

function getHeaderValue(request, name) {
  const value = request.headers ? request.headers[name] || request.headers[name.toLowerCase()] : undefined;
  return Array.isArray(value) ? value[0] : value;
}

function resolveRequestUrl(request) {
  const rawUrl = String(request.url || '/api/haruka/chat');
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  const host = String(getHeaderValue(request, 'host') || 'localhost');
  return `https://${host}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;
}

function createHttpAdapter(request, body) {
  const url = new URL(resolveRequestUrl(request));

  return {
    getHeader(name) {
      const value = getHeaderValue(request, name);
      return typeof value === 'string' ? value : undefined;
    },
    getMethod() {
      return String(request.method || 'POST').toUpperCase();
    },
    getPath() {
      return url.pathname;
    },
    getUrl() {
      return url.toString();
    },
    getAcceptHeader() {
      return String(getHeaderValue(request, 'accept') || 'application/json');
    },
    getUserAgent() {
      return String(getHeaderValue(request, 'user-agent') || '');
    },
    getQueryParams() {
      const params = {};
      for (const [key, value] of url.searchParams.entries()) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
          const existing = params[key];
          params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
        } else {
          params[key] = value;
        }
      }
      return params;
    },
    getQueryParam(name) {
      const values = url.searchParams.getAll(name);
      if (values.length === 0) {
        return undefined;
      }
      return values.length === 1 ? values[0] : values;
    },
    getBody() {
      return body;
    }
  };
}

function readRequestHeader(requestLike, name) {
  if (!requestLike) {
    return '';
  }

  if (typeof requestLike.getHeader === 'function') {
    return String(requestLike.getHeader(name) || '').trim();
  }

  return String(getHeaderValue(requestLike, name) || '').trim();
}

function isApiClientRequest(requestLike, payload, apiKey) {
  const clientType = String(payload.clientType || 'web-app').trim();
  if (clientType === 'api-client') {
    return true;
  }

  const headerApiKey = readRequestHeader(requestLike, 'x-haruka-api-key');
  return Boolean(apiKey && headerApiKey);
}

function shouldRequireX402(config, requestLike, body) {
  if (!config.enabled) {
    return false;
  }

  const payload = body && typeof body === 'object' ? body : {};
  const clientType = String(payload.clientType || 'web-app').trim();
  const apiKey = String(payload.apiKey || '').trim();
  const apiClientRequest = isApiClientRequest(requestLike, payload, apiKey);

  if (apiKey && config.bypassKeys.has(apiKey)) {
    return false;
  }

  switch (config.scope) {
    case 'all':
      return true;
    case 'api-client':
      return apiClientRequest;
    case 'non-web':
      return clientType !== 'web-app' || Boolean(apiKey);
    case 'embed-widget':
      return clientType === 'embed-widget';
    case 'embed-api-key':
    default:
      return Boolean(apiKey);
  }
}

async function createRuntime(config) {
  const facilitatorConfig = {
    url: config.facilitatorUrl
  };
  if (config.facilitatorBearerToken) {
    facilitatorConfig.createAuthHeaders = async () => ({
      verify: { Authorization: `Bearer ${config.facilitatorBearerToken}` },
      settle: { Authorization: `Bearer ${config.facilitatorBearerToken}` },
      supported: { Authorization: `Bearer ${config.facilitatorBearerToken}` }
    });
  } else if (isCdpFacilitator(config.facilitatorUrl)) {
    facilitatorConfig.createAuthHeaders = async () => createCdpAuthHeaders(config);
  }
  const facilitator = new HTTPFacilitatorClient(facilitatorConfig);
  const resourceServer = registerExactSvmScheme(new x402ResourceServer(facilitator), {
    networks: [config.network]
  });
  const httpServer = new x402HTTPResourceServer(resourceServer, {
    'POST /api/haruka/chat': {
      accepts: {
        scheme: 'exact',
        price: config.price,
        network: config.network,
        payTo: config.payTo
      },
      description: config.description,
      mimeType: 'application/json',
      unpaidResponseBody(context) {
        const body = context.adapter.getBody ? context.adapter.getBody() : {};
        const payload = body && typeof body === 'object' ? body : {};
        return {
          contentType: 'application/json',
          body: {
            ok: false,
            reply: 'This HARUKA developer request requires x402 payment before it can be processed.',
            engineMode: typeof payload.engineMode === 'string' ? payload.engineMode : 'direct',
            profileId: typeof payload.profileId === 'string' ? payload.profileId : 'classic',
            statusCode: 402,
            error: 'x402 payment required.',
            paymentRequired: true,
            x402Version: 2,
            price: config.price,
            network: config.network,
            payTo: config.payTo,
            note: 'The canonical payment challenge is in the PAYMENT-REQUIRED header.'
          }
        };
      },
      settlementFailedResponseBody(_context, settleResult) {
        return {
          contentType: 'application/json',
          body: {
            ok: false,
            reply: 'HARUKA could not settle the x402 payment for this request.',
            statusCode: 402,
            error: settleResult.errorMessage || settleResult.errorReason || 'x402 settlement failed.'
          }
        };
      }
    }
  });

  httpServer.onProtectedRequest(async (context) => {
    const body = context.adapter.getBody ? context.adapter.getBody() : {};
    if (!shouldRequireX402(config, context.adapter, body)) {
      return { grantAccess: true };
    }

    return undefined;
  });

  await httpServer.initialize();
  return { config, httpServer };
}

async function getRuntime() {
  const config = readX402Config();
  if (!config.enabled || !config.ready) {
    return { config, runtime: null };
  }

  const cacheKey = JSON.stringify({
    facilitatorUrl: config.facilitatorUrl,
    network: config.network,
    payTo: config.payTo,
    price: config.price,
    description: config.description,
    scope: config.scope
  });

  if (!cachedRuntimePromise || cachedRuntimeKey !== cacheKey) {
    cachedRuntimeKey = cacheKey;
    const runtimePromise = createRuntime(config).catch((error) => {
      if (cachedRuntimePromise === runtimePromise) {
        cachedRuntimePromise = null;
        cachedRuntimeKey = '';
      }

      throw error;
    });

    cachedRuntimePromise = runtimePromise;
  }

  return {
    config,
    runtime: await cachedRuntimePromise
  };
}

function writeX402Response(response, instructions) {
  response.status(instructions.status);
  const headers = instructions.headers || {};
  for (const [key, value] of Object.entries(headers)) {
    response.setHeader(key, value);
  }

  if (typeof instructions.body === 'undefined') {
    response.end();
    return;
  }

  if (instructions.isHtml) {
    response.send(instructions.body);
    return;
  }

  response.json(instructions.body);
}

async function processHarukaX402(request, body) {
  try {
    const { config, runtime } = await getRuntime();

    if (!config.enabled) {
      return {
        handled: false,
        verified: null,
        settlementContext: null,
        skipUsageGate: false,
        x402: buildX402Snapshot()
      };
    }

    if (!config.ready) {
      if (!shouldRequireX402(config, request, body)) {
        return {
          handled: false,
          verified: null,
          settlementContext: null,
          skipUsageGate: false,
          x402: buildX402Snapshot()
        };
      }

      return {
        handled: true,
        response: {
          status: 503,
          headers: {},
          body: {
            ok: false,
            reply: 'HARUKA x402 is enabled but not configured correctly.',
            statusCode: 503,
            error: config.issues.join(' ')
          }
        },
        x402: buildX402Snapshot()
      };
    }

    try {
      const adapter = createHttpAdapter(request, body);
      const requestContext = {
        adapter,
        path: adapter.getPath(),
        method: adapter.getMethod()
      };
      const processResult = await runtime.httpServer.processHTTPRequest(requestContext);

      if (processResult.type === 'payment-error') {
        return {
          handled: true,
          response: processResult.response,
          x402: buildX402Snapshot()
        };
      }

      if (processResult.type === 'payment-verified') {
        return {
          handled: false,
          verified: processResult,
          settlementContext: {
            request: requestContext
          },
          skipUsageGate: true,
          x402: buildX402Snapshot()
        };
      }

      return {
        handled: false,
        verified: null,
        settlementContext: null,
        skipUsageGate: false,
        x402: buildX402Snapshot()
      };
    } catch (error) {
      return {
        handled: true,
        response: {
          status: 503,
          headers: {},
          body: {
            ok: false,
            reply: 'HARUKA x402 could not initialize the payment gateway for this request.',
            statusCode: 503,
            error: error instanceof Error ? error.message : String(error)
          }
        },
        x402: buildX402Snapshot()
      };
    }
  } catch (error) {
    return {
      handled: true,
      response: {
        status: 503,
        headers: {},
        body: {
          ok: false,
          reply: 'HARUKA x402 could not initialize the payment gateway for this request.',
          statusCode: 503,
          error: error instanceof Error ? error.message : String(error)
        }
      },
      x402: buildX402Snapshot()
    };
  }
}

async function cancelHarukaX402(processState, options) {
  if (!processState || !processState.verified || !processState.verified.cancellationDispatcher) {
    return;
  }

  try {
    await processState.verified.cancellationDispatcher.cancel(options);
  } catch (_error) {
    // Best effort only: HARUKA should still return the original failure to the caller.
  }
}

async function finalizeHarukaX402(processState, responseBody) {
  if (!processState || !processState.verified || !processState.settlementContext) {
    return {
      ok: true,
      headers: {}
    };
  }

  const runtime = (await getRuntime()).runtime;
  const transportContext = {
    ...processState.settlementContext,
    responseBody: Buffer.from(JSON.stringify(responseBody || {})),
    responseHeaders: {}
  };

  const settlement = await runtime.httpServer.processSettlement(
    processState.verified.paymentPayload,
    processState.verified.paymentRequirements,
    processState.verified.declaredExtensions,
    transportContext
  );

  if (!settlement.success) {
    return {
      ok: false,
      response: settlement.response
    };
  }

  return {
    ok: true,
    headers: settlement.headers || {}
  };
}

function handler(_request, response) {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.status(200).json({
    ok: true,
    routeVersion: ROUTE_VERSION,
    deploymentEnv: process.env.VERCEL_ENV || 'local',
    vercelRegion: process.env.VERCEL_REGION || 'unknown',
    ...buildX402Snapshot()
  });
}

handler.buildX402Snapshot = buildX402Snapshot;
handler.cancelHarukaX402 = cancelHarukaX402;
handler.finalizeHarukaX402 = finalizeHarukaX402;
handler.processHarukaX402 = processHarukaX402;
handler.readX402Config = readX402Config;
handler.writeX402Response = writeX402Response;

module.exports = handler;
