const chatHandler = require('./chat.js');

const FRAME_ROUTE_VERSION = 'api-haruka-game-frame-2026-06-13-v1';
const SESSION_COOLDOWN_MS = 12_000;
const gameSessions = new Map();

const KINTARA_VISION_PROMPT = `You are watching a browser game called Kintara.
Return strict JSON with these keys only:
{
  "realm": "Mainland | Wilderness | Wilderness North | Wilderness East | The Pond | Whisperwood | Arena | Unknown",
  "activity": "Walking | Chopping trees | Mining | Fishing | Fighting mob | Trading | Building | Idle | Other | Unknown",
  "health": "High | Medium | Low | Critical | Not visible | Unknown",
  "danger": "None | Mob pressure | Low health | PvP threat | Tombstone risk | Unknown",
  "notableObjects": ["short item", "short item"],
  "questUi": ["short item", "short item"],
  "summary": "One short sentence."
}
Rules:
- Use Kintara terms when they are clearly visible.
- If uncertain, use Unknown or Not visible.
- Do not wrap JSON in markdown fences.
- Do not add explanation outside the JSON.`;

function applyHeaders(response) {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizeBody(body) {
  if (typeof body === 'string') {
    return JSON.parse(body);
  }

  return body || {};
}

function trimInline(text, maxLength) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
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

function parseList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6);
  }

  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 6);
  }

  return [];
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseVisionJson(text) {
  const direct = safeJsonParse(text);
  if (direct) {
    return {
      realm: String(direct.realm || 'Unknown').trim() || 'Unknown',
      activity: String(direct.activity || 'Unknown').trim() || 'Unknown',
      health: String(direct.health || 'Unknown').trim() || 'Unknown',
      danger: String(direct.danger || 'Unknown').trim() || 'Unknown',
      notableObjects: parseList(direct.notableObjects),
      questUi: parseList(direct.questUi),
      summary: String(direct.summary || '').trim(),
      analysisSource: 'vision'
    };
  }

  const fenced = text.match(/\{[\s\S]*\}/);
  if (!fenced) {
    return null;
  }

  return parseVisionJson(fenced[0]);
}

function detectRealmFromText(text) {
  const lower = text.toLowerCase();
  if (lower.includes('wilderness north')) return 'Wilderness North';
  if (lower.includes('wilderness east')) return 'Wilderness East';
  if (lower.includes('whisperwood')) return 'Whisperwood';
  if (lower.includes('the pond') || /\bpond\b/.test(lower)) return 'The Pond';
  if (lower.includes('wilderness')) return 'Wilderness';
  if (lower.includes('arena')) return 'Arena';
  if (lower.includes('mainland')) return 'Mainland';
  return 'Unknown';
}

function detectActivityFromText(text) {
  const lower = text.toLowerCase();
  if (lower.includes('chopping') || lower.includes('woodcut') || lower.includes('tree')) return 'Chopping trees';
  if (lower.includes('mining') || lower.includes('coal') || lower.includes('rock')) return 'Mining';
  if (lower.includes('fishing') || lower.includes('fish')) return 'Fishing';
  if (lower.includes('marketplace') || lower.includes('listing') || lower.includes('sell')) return 'Trading';
  if (lower.includes('building') || lower.includes('firepit') || lower.includes('shack')) return 'Building';
  if (lower.includes('combat') || lower.includes('mob') || lower.includes('attack') || lower.includes('sword')) return 'Fighting mob';
  if (lower.includes('walk') || lower.includes('portal') || lower.includes('move')) return 'Walking';
  return 'Unknown';
}

function detectDangerFromText(text, health, realm) {
  const lower = text.toLowerCase();
  if (health === 'Low' || health === 'Critical') {
    return 'Low health';
  }
  if (lower.includes('tombstone')) {
    return 'Tombstone risk';
  }
  if (lower.includes('pvp')) {
    return 'PvP threat';
  }
  if (lower.includes('mob') || lower.includes('enemy') || lower.includes('attack')) {
    return 'Mob pressure';
  }
  if (realm === 'Wilderness' || realm === 'Wilderness North' || realm === 'Wilderness East') {
    return 'Unknown';
  }
  return 'None';
}

function fallbackObservation(pageContext) {
  const pageText = trimInline(
    [pageContext && pageContext.title, pageContext && pageContext.pathname, pageContext && pageContext.bodyText]
      .filter(Boolean)
      .join(' | '),
    1600
  );
  const realm = detectRealmFromText(pageText);
  const activity = detectActivityFromText(pageText);
  const health = /\bcritical\b/i.test(pageText)
    ? 'Critical'
    : /\blow health\b/i.test(pageText) || /\blow\b/i.test(pageText)
      ? 'Low'
      : /\bmedium\b/i.test(pageText)
        ? 'Medium'
        : /\bhigh\b/i.test(pageText)
          ? 'High'
          : 'Unknown';
  const danger = detectDangerFromText(pageText, health, realm);

  return {
    realm,
    activity,
    health,
    danger,
    notableObjects: [],
    questUi: [],
    summary: pageText ? trimInline(pageText, 180) : 'Kintara page context is limited.',
    analysisSource: pageText ? 'page-fallback' : 'manual'
  };
}

function resolveVisionConfig() {
  return {
    apiKey: String(process.env.HARUKA_VISION_API_KEY || process.env.MEGALLM_API_KEY || '').trim(),
    baseUrl: String(process.env.HARUKA_VISION_BASE_URL || process.env.MEGALLM_BASE_URL || 'https://ai.megallm.io/v1').trim(),
    model: String(process.env.HARUKA_VISION_MODEL || process.env.MEGALLM_MODEL || 'openai-gpt-oss-120b').trim()
  };
}

async function analyzeWithVision(imageDataUrl) {
  const provider = resolveVisionConfig();
  if (!provider.apiKey) {
    return null;
  }

  const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: KINTARA_VISION_PROMPT },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return null;
  }

  const content = readAssistantContent(payload);
  if (!content) {
    return null;
  }

  return parseVisionJson(content);
}

function buildSessionKey(request) {
  return String(request.sessionId || 'kintara-default').trim() || 'kintara-default';
}

function buildSignature(observation) {
  return [observation.realm, observation.activity, observation.health, observation.danger].join('|');
}

function shouldInterrupt(observation) {
  return observation.health === 'Low' ||
    observation.health === 'Critical' ||
    observation.danger === 'Low health' ||
    observation.danger === 'Tombstone risk' ||
    observation.danger === 'PvP threat';
}

function shouldSpeakNow(observation, session) {
  const requestMode = arguments[2] === 'what-now' ? 'what-now' : 'ambient';
  if (requestMode === 'what-now') {
    return true;
  }

  const now = Date.now();
  if (shouldInterrupt(observation)) {
    return true;
  }

  if (!session) {
    return observation.realm !== 'Unknown' || observation.activity !== 'Unknown';
  }

  if (now - session.lastCommentAt < SESSION_COOLDOWN_MS) {
    return false;
  }

  return buildSignature(observation) !== session.lastSignature;
}

function buildGameContext(request, observation) {
  return {
    game: 'kintara',
    realm: observation.realm,
    activity: observation.activity,
    health: observation.health,
    danger: observation.danger,
    notableObjects: observation.notableObjects,
    questUi: observation.questUi,
    visionSummary: observation.summary,
    pageHint: trimInline(
      [request.pageContext && request.pageContext.title, request.pageContext && request.pageContext.pathname]
        .filter(Boolean)
        .join(' | '),
      160
    ),
    host: request.pageContext && request.pageContext.hostname ? request.pageContext.hostname : '',
    analysisSource: observation.analysisSource,
    shouldInterrupt: shouldInterrupt(observation),
    capturedAt: new Date().toISOString()
  };
}

function buildContextForHaruka(observation, requestMode) {
  const notable = observation.notableObjects.length > 0 ? observation.notableObjects.join(', ') : 'none clearly visible';
  const questUi = observation.questUi.length > 0 ? observation.questUi.join(', ') : 'none clearly visible';

  if (requestMode === 'what-now') {
    return `Analyze the player's current Kintara situation and tell them what to do next right now. Keep it practical and short, max 2 sentences. Realm: ${observation.realm}. Activity: ${observation.activity}. Health: ${observation.health}. Danger: ${observation.danger}. Nearby: ${notable}. Quest/UI: ${questUi}. Vision summary: ${observation.summary}`;
  }

  return `React to this Kintara moment naturally. Realm: ${observation.realm}. Activity: ${observation.activity}. Health: ${observation.health}. Danger: ${observation.danger}. Nearby: ${notable}. Quest/UI: ${questUi}. Vision summary: ${observation.summary}`;
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
    const requestMode = payload.requestMode === 'what-now' ? 'what-now' : 'ambient';
    if (payload.selectedGame !== 'kintara') {
      response.status(400).json({
        ok: false,
        shouldSpeak: false,
        reply: '',
        overlayReply: '',
        error: 'Unsupported game selection.',
        gameContext: {
          game: 'kintara',
          realm: 'Unknown',
          activity: 'Unknown',
          health: 'Unknown',
          danger: 'Unknown',
          analysisSource: 'manual'
        }
      });
      return;
    }

    const sessionKey = buildSessionKey(payload);
    const session = gameSessions.get(sessionKey);
    const visionObservation =
      payload.imageDataUrl && String(payload.imageDataUrl).startsWith('data:image/')
        ? await analyzeWithVision(String(payload.imageDataUrl)).catch(() => null)
        : null;
      const observation = visionObservation || fallbackObservation(payload.pageContext || {});
      const gameContext = buildGameContext(payload, observation);
      const speak = shouldSpeakNow(observation, session, requestMode);

    if (!speak) {
      response.status(200).json({
        ok: true,
        shouldSpeak: false,
        reply: '',
        overlayReply: '',
        gameContext,
          debug: {
            routeVersion: FRAME_ROUTE_VERSION,
            sessionKey,
            analysisSource: observation.analysisSource,
            signature: buildSignature(observation),
            reason: 'cooldown_or_no_meaningful_change',
            requestMode
          }
        });
        return;
      }

      const chatRequest = {
      message: buildContextForHaruka(observation, requestMode),
      history: [],
      language: payload.language || 'en',
      profileId: payload.profileId || 'classic',
      engineMode: payload.engineMode || 'direct',
      providerId: payload.providerId || 'openai-compatible',
      providerConfig: payload.providerConfig,
      openSouls: payload.openSouls,
      source: 'gaming-companion',
      clientType: 'browser-extension',
      sessionId: sessionKey,
      selectedGame: 'kintara',
      gameContext
    };

    const result = await chatHandler.runHarukaChatCore(chatRequest, {
      skipUsageGate: false
    });

    if (!result.ok) {
      response.status(502).json({
        ok: false,
        shouldSpeak: false,
        reply: '',
        overlayReply: '',
        gameContext,
        error: result.error || 'Haruka game-frame response failed.',
          debug: {
            routeVersion: FRAME_ROUTE_VERSION,
            sessionKey,
            analysisSource: observation.analysisSource,
            requestMode,
            handlerDebug: result.debug || null
          }
        });
      return;
    }

    gameSessions.set(sessionKey, {
      lastSignature: buildSignature(observation),
      lastCommentAt: Date.now()
    });

    response.status(200).json({
      ok: true,
      shouldSpeak: true,
      reply: result.reply,
      overlayReply: result.reply,
      gameContext,
        debug: {
          routeVersion: FRAME_ROUTE_VERSION,
          sessionKey,
          analysisSource: observation.analysisSource,
          requestMode,
          usage: result.usage || null
        }
      });
  } catch (error) {
    response.status(500).json({
      ok: false,
      shouldSpeak: false,
      reply: '',
      overlayReply: '',
      error: error instanceof Error ? error.message : String(error),
      gameContext: {
        game: 'kintara',
        realm: 'Unknown',
        activity: 'Unknown',
        health: 'Unknown',
        danger: 'Unknown',
        analysisSource: 'manual'
      },
      debug: {
        routeVersion: FRAME_ROUTE_VERSION
      }
    });
  }
};
