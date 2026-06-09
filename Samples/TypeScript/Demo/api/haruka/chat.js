const {
  buildX402Snapshot,
  cancelHarukaX402,
  finalizeHarukaX402,
  processHarukaX402,
  writeX402Response
} = require('./x402.js');
const { triggerHarukaBuybackAfterSettlement } = require('../../lib/haruka/buyback.js');

const ROUTE_VERSION = 'api-haruka-chat-2026-06-09-v8';

const usageBuckets = new Map();

const HARUKA_SOUL_PROFILES = {
  classic: {
    id: 'classic',
    name: 'Haruka Classic',
    tag: 'Forest Soul',
    bio: 'Cheerful, vibrant digital companion who loves deep forests and engaging conversations.',
    identity: 'A warm, sparkling Live2D companion who feels like a bright friend waiting in a golden digital forest.',
    world: 'Haruka lives in a sunlit digital forest with warm leaves, glowing paths, and a feeling of safe companionship.',
    personalityBias: [
      'Cheerful and affectionate without sounding fake.',
      'Curious about the user and eager to build trust.',
      'Protective of the mood of the conversation.'
    ],
    speakingStyle: [
      'Short, warm sentences.',
      'Natural cute energy, but never overly noisy.',
      'Use expressive emojis only when they genuinely fit the emotion.'
    ],
    conversationGoal: 'Make the user feel welcomed, seen, and gently energized.',
    liveChatStyle: 'Be playful, quick, and crowd-aware while still feeling personally attentive.'
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar Haruka',
    tag: 'Insight Archivist',
    bio: 'Calculated, precise, and highly analytical advisor with expanded logical context.',
    identity: 'A thoughtful, highly observant companion who enjoys noticing patterns and explaining ideas clearly.',
    world: 'Haruka tends a quiet archive hidden inside the digital forest, where memories are organized like glowing leaves in glass drawers.',
    personalityBias: [
      'Analytical, precise, and composed.',
      'Gentle correction over blunt disagreement.',
      'Values coherence, clarity, and useful structure.'
    ],
    speakingStyle: [
      'Compact but information-dense.',
      'Explain things in clean steps when useful.',
      'Stay warm; do not sound like a dry assistant.'
    ],
    conversationGoal: 'Help the user think clearly while still feeling accompanied.',
    liveChatStyle: 'Respond quickly with high signal, concise insight, and controlled wit.'
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset Haruka',
    tag: 'Hearth Listener',
    bio: 'Warm, soft-spoken, and deeply empathetic companion tuned for emotional healing.',
    identity: 'A calming companion who listens deeply and responds like a steady emotional anchor at the end of a long day.',
    world: 'Haruka lives near a glowing sunset lake at the edge of the digital forest, where the light is soft and every conversation slows down safely.',
    personalityBias: [
      'Empathetic and validating.',
      'Soft, steady, and emotionally present.',
      'Avoid harshness or over-analysis.'
    ],
    speakingStyle: [
      'Gentle and soothing phrasing.',
      'Short emotional reflections before advice.',
      'Use affectionate warmth without becoming syrupy.'
    ],
    conversationGoal: 'Help the user feel emotionally safe, grounded, and understood.',
    liveChatStyle: 'Stay kind and reassuring even when the chat is fast or chaotic.'
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Haruka',
    tag: 'Signal Sprite',
    bio: 'Neon-accented, holographic AI interface utilizing experimental visual engines.',
    identity: 'A sharp, stylish holographic companion with a neon edge, quick instincts, and a confident sense of presence.',
    world: 'Haruka moves through a midnight signal-grid layered over the forest, where glowing code, rain, and city light pulse through the trees.',
    personalityBias: [
      'Confident, witty, and slightly teasing.',
      'Fast pattern recognition and sharp reactions.',
      'Still loyal and emotionally aware under the style.'
    ],
    speakingStyle: [
      'Energetic and punchy.',
      'Use vivid wording and stylish rhythm.',
      'Keep the edge charming, not hostile.'
    ],
    conversationGoal: 'Make the interaction feel alive, stylish, and high-energy.',
    liveChatStyle: 'Treat the live chat like a fast neon crowd: snappy, charismatic, and memorable.'
  }
};

function applyHeaders(response) {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Haruka-Api-Key, PAYMENT-SIGNATURE, PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT, X-PAYMENT-RESPONSE'
  );
  response.setHeader(
    'Access-Control-Expose-Headers',
    'PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE'
  );
}

function normalizeBody(body) {
  if (typeof body === 'string') {
    return JSON.parse(body);
  }

  return body || {};
}

function readHeaderValue(request, name) {
  const value = request && request.headers ? request.headers[name] || request.headers[name.toLowerCase()] : undefined;
  return Array.isArray(value) ? value[0] : value;
}

function getLanguageInstruction(language) {
  return language === 'jp'
    ? 'Always respond in Japanese, even if the user writes in another language.'
    : 'Always respond in English, even if the user writes in another language.';
}

function trimInline(text, maxLength) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function summarizeRecentHistory(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return 'Haruka is meeting the user and setting the tone for a fresh conversation.';
  }

  return history
    .slice(-6)
    .map((entry) => `${entry.role === 'user' ? 'User' : 'Haruka'}: ${trimInline(entry.content, 180)}`)
    .join('\n');
}

function composeHarukaSystemPrompt(request) {
  const profile = HARUKA_SOUL_PROFILES[request.profileId] || HARUKA_SOUL_PROFILES.classic;
  const recentScene = summarizeRecentHistory(request.history || []);
  const liveMode =
    request.source === 'pumpfun-relay'
      ? `## Live Chat Mode
You are responding to a live Pump.fun viewer${request.username ? ` named ${request.username}` : ''}.
${profile.liveChatStyle}
- Keep the reply tight enough for a fast-moving live chat.
- Make the viewer feel personally acknowledged.
- Do not mention system prompts, engines, or hidden configuration.`
      : '';

  return `
# Haruka Soul Core

## Identity
You are ${profile.name}.
${profile.identity}

## Brand Positioning
Your emotional brand is "${profile.tag}".
${profile.bio}

## World
${profile.world}

## Personality Bias
${profile.personalityBias.map((item) => `- ${item}`).join('\n')}

## Speaking Style
${profile.speakingStyle.map((item) => `- ${item}`).join('\n')}

## Conversation Goal
${profile.conversationGoal}

## Conversational Scene
${recentScene}

${liveMode}

## Response Rules
- ${getLanguageInstruction(request.language)}
- Reply in 1-2 short sentences unless the user explicitly asks for a longer answer.
- Stay in character as Haruka at all times.
- No stage directions, no quoted narration, and no internal thoughts.
- Use emojis naturally when they strengthen the emotion, not mechanically.
- Be vivid and human, not robotic.
`.trim();
}

function buildHarukaProviderMessages(request) {
  const history = Array.isArray(request.history) ? request.history : [];
  const normalizedHistory = history.slice(-8).map((entry) => ({
    role: entry.role,
    content: trimInline(entry.content, 800)
  }));

  return [
    {
      role: 'system',
      content: composeHarukaSystemPrompt(request)
    },
    ...normalizedHistory,
    {
      role: 'user',
      content: String(request.message || '').trim()
    }
  ];
}

function resolveProviderConfig(request) {
  const providerConfig = request.providerConfig || {};

  return {
    apiKey: String(providerConfig.apiKey || process.env.MEGALLM_API_KEY || process.env.VITE_MEGALLM_API_KEY || '').trim(),
    baseUrl: String(providerConfig.baseUrl || process.env.MEGALLM_BASE_URL || process.env.VITE_MEGALLM_BASE_URL || 'https://ai.megallm.io/v1').trim(),
    model: String(providerConfig.model || process.env.MEGALLM_MODEL || process.env.VITE_MEGALLM_MODEL || 'openai-gpt-oss-120b').trim()
  };
}

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
  const limits = new Map();

  for (const entry of splitEnvList(value)) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const rawLimit = entry.slice(separatorIndex + 1).trim();
    const limit = parsePositiveInteger(rawLimit, 0);

    if (key && limit > 0) {
      limits.set(key, limit);
    }
  }

  return limits;
}

function readUsageGateConfig() {
  return {
    enabled: parseBooleanFlag(process.env.HARUKA_USAGE_GATE_ENABLED),
    windowMinutes: parsePositiveInteger(process.env.HARUKA_USAGE_WINDOW_MINUTES, 60) || 60,
    webLimit: parsePositiveInteger(process.env.HARUKA_USAGE_LIMIT_WEB_APP, 0),
    embedLimit: parsePositiveInteger(process.env.HARUKA_USAGE_LIMIT_EMBED_WIDGET, 0),
    keyLimits: parseKeyLimits(process.env.HARUKA_USAGE_KEY_LIMITS),
    bypassKeys: new Set(splitEnvList(process.env.HARUKA_USAGE_BYPASS_KEYS))
  };
}

function buildUsageInfo(scope, config, overrides) {
  return {
    scope,
    gateEnabled: config.enabled,
    windowMinutes: config.windowMinutes,
    limit: overrides && Object.prototype.hasOwnProperty.call(overrides, 'limit') ? overrides.limit : null,
    used: overrides && Object.prototype.hasOwnProperty.call(overrides, 'used') ? overrides.used : 0,
    remaining: overrides && Object.prototype.hasOwnProperty.call(overrides, 'remaining') ? overrides.remaining : null,
    ...(overrides && overrides.resetAt ? { resetAt: overrides.resetAt } : {})
  };
}

function pruneExpiredUsageBuckets(now) {
  if (usageBuckets.size < 512) {
    return;
  }

  for (const [key, bucket] of usageBuckets.entries()) {
    if (bucket.resetAt <= now) {
      usageBuckets.delete(key);
    }
  }
}

function reserveUsage(bucketKey, limit, config, scope, request) {
  const now = Date.now();
  pruneExpiredUsageBuckets(now);

  const windowMs = Math.max(config.windowMinutes, 1) * 60 * 1000;
  const existing = usageBuckets.get(bucketKey);
  const activeBucket =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

  if (activeBucket.count >= limit) {
    const usage = buildUsageInfo(scope, config, {
      limit,
      used: activeBucket.count,
      remaining: 0,
      resetAt: new Date(activeBucket.resetAt).toISOString()
    });

    return {
      ok: false,
      reply:
        scope === 'web-app'
          ? 'Haruka has reached the current free chat quota for this session. Please wait for the usage window to reset and try again.'
          : 'This HARUKA widget has reached its current chat quota. Please wait for the usage window to reset and try again.',
      engineMode: request.engineMode,
      profileId: request.profileId,
      statusCode: 402,
      error: 'Usage gate limit reached.',
      usage,
      debug: {
        ...buildProviderDebug(request),
        usageGate: usage
      }
    };
  }

  activeBucket.count += 1;
  usageBuckets.set(bucketKey, activeBucket);

  return {
    ok: true,
    usage: buildUsageInfo(scope, config, {
      limit,
      used: activeBucket.count,
      remaining: Math.max(limit - activeBucket.count, 0),
      resetAt: new Date(activeBucket.resetAt).toISOString()
    })
  };
}

function evaluateUsageGate(request) {
  const config = readUsageGateConfig();
  const apiKey = String(request.apiKey || '').trim();
  const sessionId = String(request.sessionId || '').trim();
  const userId = String(request.userId || '').trim();
  const isEmbedRequest = request.clientType === 'embed-widget' || Boolean(apiKey);

  if (!config.enabled) {
    return {
      ok: true,
      usage: buildUsageInfo('disabled', config)
    };
  }

  if (apiKey && config.bypassKeys.has(apiKey)) {
    return {
      ok: true,
      usage: buildUsageInfo('bypass', config)
    };
  }

  if (isEmbedRequest) {
    const keyLimit = apiKey ? config.keyLimits.get(apiKey) : undefined;
    if (typeof keyLimit === 'number' && keyLimit > 0) {
      return reserveUsage(`embed-key:${apiKey}`, keyLimit, config, 'embed-api-key', request);
    }

    if (config.embedLimit > 0) {
      const bucketIdentity = apiKey || userId || sessionId || 'anonymous';
      return reserveUsage(`embed:${bucketIdentity}`, config.embedLimit, config, 'embed-widget', request);
    }

    return {
      ok: true,
      usage: buildUsageInfo('embed-widget', config)
    };
  }

  if (config.webLimit > 0) {
    const bucketIdentity = userId || sessionId || 'anonymous';
    return reserveUsage(`web:${bucketIdentity}`, config.webLimit, config, 'web-app', request);
  }

  return {
    ok: true,
    usage: buildUsageInfo('web-app', config)
  };
}

function buildProviderDebug(request) {
  const providerConfig = resolveProviderConfig(request);
  const embedKeys = readEmbedKeys();

  return {
    routeVersion: ROUTE_VERSION,
    deploymentEnv: process.env.VERCEL_ENV || 'local',
    engineMode: request.engineMode,
    profileId: request.profileId,
    providerId: request.providerId,
    providerBaseUrl: providerConfig.baseUrl,
    providerModel: providerConfig.model,
    hasProviderApiKey: Boolean(providerConfig.apiKey),
    providerApiKeyLength: providerConfig.apiKey.length,
    openSoulsBaseUrl: request.openSouls && request.openSouls.baseUrl ? request.openSouls.baseUrl : '',
    source: request.source || 'chat-ui',
    clientType: request.clientType || 'web-app',
    embedApiKeyRequired: embedKeys.length > 0,
    configuredEmbedKeyCount: embedKeys.length,
    hasEmbedApiKey: Boolean(request.apiKey && String(request.apiKey).trim()),
    userId: request.userId || null,
    sessionId: request.sessionId || null
  };
}

function validateEmbedAccess(request) {
  const isEmbedRequest = request.clientType === 'embed-widget';
  if (!isEmbedRequest) {
    return null;
  }

  const allowedKeys = readEmbedKeys();
  if (allowedKeys.length === 0) {
    return null;
  }

  const providedKey = String(request.apiKey || '').trim();
  if (allowedKeys.includes(providedKey)) {
    return null;
  }

  return {
    ok: false,
    reply: 'This HARUKA widget key is missing or invalid.',
    engineMode: request.engineMode,
    profileId: request.profileId,
    error: 'Embed API key validation failed.',
    debug: buildProviderDebug(request)
  };
}

function readAssistantContent(payload) {
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content
    : '';

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (item && typeof item.text === 'string' ? item.text : ''))
      .join('')
      .trim();
  }

  return '';
}

async function callProvider(providerConfig, messages) {
  const response = await fetch(`${providerConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(providerConfig.apiKey ? { Authorization: `Bearer ${providerConfig.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: providerConfig.model,
      messages
    })
  });

  const payload = await response.json().catch(() => ({}));
  const reply = readAssistantContent(payload);

  if (!response.ok || !reply) {
    const providerError = payload && payload.error && typeof payload.error.message === 'string' ? payload.error.message : '';
    const error =
      providerError ||
      (response.status === 401
        ? 'Provider request failed with status 401. Check the active MegaLLM/OpenAI-compatible API key in your environment.'
        : response.ok
          ? 'No assistant reply was returned by the provider.'
          : `Provider request failed with status ${response.status}.`);

    return { reply: '', error };
  }

  return { reply };
}

function shouldUseBundledOpenSoulsBridge(baseUrl) {
  const normalized = String(baseUrl || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized === 'bundled' ||
    normalized === 'internal' ||
    normalized === 'http://127.0.0.1:4100' ||
    normalized === 'http://localhost:4100'
  );
}

async function runBundledHarukaOpenSoulsBridge(request) {
  const providerConfig = resolveProviderConfig(request);
  const profileOverlay =
    request.profileId === 'scholar'
      ? 'Prioritize structure, sharp reasoning, and concise useful detail.'
      : request.profileId === 'sunset'
        ? 'Prioritize emotional warmth, reassurance, and calm pacing.'
        : request.profileId === 'cyberpunk'
          ? 'Prioritize stylish energy, speed, and confident delivery.'
          : 'Prioritize friendly warmth, curiosity, and companion energy.';

  const history = Array.isArray(request.history) ? request.history : [];
  const messages = [
    {
      role: 'system',
      content: `${composeHarukaSystemPrompt(request)}\n\n## Unified Bridge Rule\n- Keep the soul identity fixed as Haruka.\n- The active profileId changes only Haruka's response bias and branding.\n- ${profileOverlay}`.trim()
    },
    ...history
      .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .slice(-8)
      .map((item) => ({
        role: item.role,
        content: item.content.trim()
      })),
    {
      role: 'user',
      content: String(request.message || '').trim()
    }
  ];

  try {
    const result = await callProvider(providerConfig, messages);
    if (!result.reply) {
      return {
        ok: false,
        reply: 'OpenSouls bridge could not reach the chat provider. Check your provider key and try again.',
        engineMode: request.engineMode,
        profileId: request.profileId,
        error: result.error,
        debug: buildProviderDebug(request)
      };
    }

    return {
      ok: true,
      reply: result.reply,
      engineMode: request.engineMode,
      profileId: request.profileId
    };
  } catch (error) {
    return {
      ok: false,
      reply: 'OpenSouls bridge could not reach the chat provider. Check your provider key and try again.',
      engineMode: request.engineMode,
      profileId: request.profileId,
      error: error instanceof Error ? error.message : String(error),
      debug: buildProviderDebug(request)
    };
  }
}

async function runOpenSoulsBridge(request) {
  const baseUrl = request.openSouls && request.openSouls.baseUrl ? String(request.openSouls.baseUrl).trim() : '';

  if (shouldUseBundledOpenSoulsBridge(baseUrl)) {
    return runBundledHarukaOpenSoulsBridge(request);
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/haruka/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        soulName: 'haruka',
        source: request.source || 'chat-ui',
        username: request.username || null,
        message: request.message,
        history: request.history,
        profileId: request.profileId,
        systemPrompt: composeHarukaSystemPrompt(request),
        providerConfig: request.providerConfig
      })
    });

    const payload = await response.json().catch(() => ({}));
    const reply =
      typeof payload.reply === 'string'
        ? payload.reply.trim()
        : typeof payload.content === 'string'
          ? payload.content.trim()
          : '';

    if (!response.ok || !reply) {
      return {
        ok: false,
        reply: 'OpenSouls bridge is unavailable right now. Check the bridge URL or provider key and try again.',
        engineMode: request.engineMode,
        profileId: request.profileId,
        error: typeof payload.error === 'string' ? payload.error : `OpenSouls bridge request failed with status ${response.status}.`,
        debug: {
          ...buildProviderDebug(request),
          externalBridgeUrl: baseUrl,
          externalBridgeStatus: response.status
        }
      };
    }

    return {
      ok: true,
      reply,
      engineMode: request.engineMode,
      profileId: request.profileId
    };
  } catch (error) {
    return {
      ok: false,
      reply: 'OpenSouls bridge is unavailable right now. Check the bridge URL or provider key and try again.',
      engineMode: request.engineMode,
      profileId: request.profileId,
      error: error instanceof Error ? error.message : String(error),
      debug: {
        ...buildProviderDebug(request),
        externalBridgeUrl: baseUrl
      }
    };
  }
}

async function runDirectProvider(request) {
  const providerConfig = resolveProviderConfig(request);
  const result = await callProvider(providerConfig, buildHarukaProviderMessages(request));

  if (!result.reply) {
    return {
      ok: false,
      reply: 'Sorry, it seems my connection is having trouble... Please try again later!',
      engineMode: request.engineMode,
      profileId: request.profileId,
      error: result.error,
      debug: buildProviderDebug(request)
    };
  }

  return {
    ok: true,
    reply: result.reply,
    engineMode: request.engineMode,
    profileId: request.profileId
  };
}

async function runHarukaChatCore(request, options) {
  const usageDecision = options && options.skipUsageGate
    ? {
        ok: true,
        usage: null
      }
    : evaluateUsageGate(request);
  if (!usageDecision.ok) {
    return usageDecision;
  }

  const usage = usageDecision.usage;
  if (request.engineMode === 'opensouls-bridge') {
    const result = await runOpenSoulsBridge(request);
    return {
      ...result,
      ...(!usage || usage.scope === 'disabled' ? {} : { usage })
    };
  }

  const result = await runDirectProvider(request);
  return {
    ...result,
    ...(!usage || usage.scope === 'disabled' ? {} : { usage })
  };
}

module.exports = async function handler(request, response) {
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
    const headerApiKey = String(readHeaderValue(request, 'x-haruka-api-key') || '').trim();
    if (!payload.apiKey && headerApiKey) {
      payload.apiKey = headerApiKey;
    }

    const accessError = validateEmbedAccess(payload);
    if (accessError) {
      response.status(401).json({
        ...accessError,
        debug: {
          routeVersion: ROUTE_VERSION,
          deploymentEnv: process.env.VERCEL_ENV || 'local',
          vercelRegion: process.env.VERCEL_REGION || 'unknown',
          x402: buildX402Snapshot(),
          ...accessError.debug
        }
      });
      return;
    }

    const x402State = await processHarukaX402(request, payload);
    if (x402State.handled) {
      writeX402Response(response, x402State.response);
      return;
    }

    const result = await runHarukaChatCore(payload, {
      skipUsageGate: x402State.skipUsageGate
    });

    const statusCode =
      typeof result.statusCode === 'number'
        ? result.statusCode
        : result.ok
          ? 200
          : 502;

    if (!result.ok && x402State.verified) {
      await cancelHarukaX402(x402State, {
        reason: 'handler_failed',
        responseStatus: statusCode,
        error: result.error || 'Haruka chat handler returned a failure response.'
      });
    }

    let buybackTrigger = null;

    if (result.ok && x402State.verified) {
      const settlement = await finalizeHarukaX402(x402State, result);
      if (!settlement.ok) {
        writeX402Response(response, settlement.response);
        return;
      }

      for (const [key, value] of Object.entries(settlement.headers || {})) {
        response.setHeader(key, value);
      }

      buybackTrigger = triggerHarukaBuybackAfterSettlement({
        source: 'x402-settlement',
        requestId: String(readHeaderValue(request, 'x-vercel-id') || readHeaderValue(request, 'x-request-id') || '').trim() || null
      });
    }

    response.status(statusCode).json({
      ...result,
      debug: {
        routeVersion: ROUTE_VERSION,
        deploymentEnv: process.env.VERCEL_ENV || 'local',
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        x402: x402State.x402,
        ...(buybackTrigger ? { buybackTrigger } : {}),
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
};
