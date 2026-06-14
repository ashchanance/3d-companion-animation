import type {
  HarukaChatRequest,
  HarukaChatResponse,
  HarukaEngineMode,
  HarukaGameContext,
  HarukaLanguage,
  HarukaProviderConfig,
  HarukaSoulProfileId,
  OpenSoulsBridgeConfig
} from '../harukaChatContract';
import { runHarukaChat } from './harukaChatService.js';

interface VisionPayload {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface KintaraObservation {
  realm: string;
  activity: string;
  health: string;
  danger: string;
  notableObjects: string[];
  questUi: string[];
  summary: string;
  analysisSource: 'vision' | 'page-fallback' | 'manual';
}

interface GameSessionState {
  lastSignature: string;
  lastCommentAt: number;
}

export interface HarukaGameFramePageContext {
  url?: string;
  title?: string;
  hostname?: string;
  pathname?: string;
  bodyText?: string;
}

export interface HarukaGameFrameRequest {
  imageDataUrl?: string;
  selectedGame?: 'kintara';
  sessionId?: string;
  pageContext?: HarukaGameFramePageContext;
  requestMode?: 'ambient' | 'what-now';
  language?: HarukaLanguage;
  profileId?: HarukaSoulProfileId;
  engineMode?: HarukaEngineMode;
  providerId?: string;
  providerConfig?: HarukaProviderConfig;
  openSouls?: OpenSoulsBridgeConfig;
}

export interface HarukaGameFrameResponse {
  ok: boolean;
  shouldSpeak: boolean;
  reply: string;
  overlayReply: string;
  gameContext: HarukaGameContext;
  debug?: Record<string, unknown>;
  error?: string;
}

const FRAME_ROUTE_VERSION = 'haruka-game-frame-2026-06-13-v1';
const SESSION_COOLDOWN_MS = 12_000;
const gameSessions = new Map<string, GameSessionState>();

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

function trimInline(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function readAssistantContent(payload: VisionPayload): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item.text === 'string' ? item.text : ''))
      .join('')
      .trim();
  }

  return '';
}

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  return [];
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseVisionJson(text: string): KintaraObservation | null {
  const direct = safeJsonParse<Record<string, unknown>>(text);
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

function detectRealmFromText(text: string): string {
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

function detectActivityFromText(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('chopping') || lower.includes('woodcut') || lower.includes('tree')) return 'Chopping trees';
  if (lower.includes('mining') || lower.includes('coal') || lower.includes('rock')) return 'Mining';
  if (lower.includes('fishing') || lower.includes('fish')) return 'Fishing';
  if (lower.includes('marketplace') || lower.includes('listing') || lower.includes('sell')) return 'Trading';
  if (lower.includes('building') || lower.includes('firepit') || lower.includes('shack')) return 'Building';
  if (lower.includes('combat') || lower.includes('mob') || lower.includes('attack') || lower.includes('sword'))
    return 'Fighting mob';
  if (lower.includes('walk') || lower.includes('portal') || lower.includes('move')) return 'Walking';
  return 'Unknown';
}

function detectDangerFromText(text: string, health: string, realm: string): string {
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

function fallbackObservation(pageContext?: HarukaGameFramePageContext): KintaraObservation {
  const pageText = trimInline(
    [pageContext?.title, pageContext?.pathname, pageContext?.bodyText].filter(Boolean).join(' | '),
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

async function analyzeWithVision(imageDataUrl: string): Promise<KintaraObservation | null> {
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

  const payload = (await response.json().catch(() => ({}))) as VisionPayload;
  if (!response.ok) {
    return null;
  }

  const content = readAssistantContent(payload);
  if (!content) {
    return null;
  }

  return parseVisionJson(content);
}

function buildSessionKey(request: HarukaGameFrameRequest): string {
  return String(request.sessionId || 'kintara-default').trim() || 'kintara-default';
}

function buildSignature(observation: KintaraObservation): string {
  return [observation.realm, observation.activity, observation.health, observation.danger].join('|');
}

function shouldInterrupt(observation: KintaraObservation): boolean {
  return (
    observation.health === 'Low' ||
    observation.health === 'Critical' ||
    observation.danger === 'Low health' ||
    observation.danger === 'Tombstone risk' ||
    observation.danger === 'PvP threat'
  );
}

function shouldSpeakNow(
  observation: KintaraObservation,
  session: GameSessionState | undefined,
  requestMode: 'ambient' | 'what-now'
): boolean {
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

function buildContextForHaruka(
  observation: KintaraObservation,
  requestMode: 'ambient' | 'what-now'
): string {
  const notable = observation.notableObjects.length > 0 ? observation.notableObjects.join(', ') : 'none clearly visible';
  const questUi = observation.questUi.length > 0 ? observation.questUi.join(', ') : 'none clearly visible';

  if (requestMode === 'what-now') {
    return `Analyze the player's current Kintara situation and tell them what to do next right now. Keep it practical and short, max 2 sentences. Realm: ${observation.realm}. Activity: ${observation.activity}. Health: ${observation.health}. Danger: ${observation.danger}. Nearby: ${notable}. Quest/UI: ${questUi}. Vision summary: ${observation.summary}`;
  }

  return `React to this Kintara moment naturally. Realm: ${observation.realm}. Activity: ${observation.activity}. Health: ${observation.health}. Danger: ${observation.danger}. Nearby: ${notable}. Quest/UI: ${questUi}. Vision summary: ${observation.summary}`;
}

function buildGameContext(request: HarukaGameFrameRequest, observation: KintaraObservation): HarukaGameContext {
  return {
    game: 'kintara',
    realm: observation.realm,
    activity: observation.activity,
    health: observation.health,
    danger: observation.danger,
    notableObjects: observation.notableObjects,
    questUi: observation.questUi,
    visionSummary: observation.summary,
    pageHint: trimInline([request.pageContext?.title, request.pageContext?.pathname].filter(Boolean).join(' | '), 160),
    host: request.pageContext?.hostname || '',
    analysisSource: observation.analysisSource,
    shouldInterrupt: shouldInterrupt(observation),
    capturedAt: new Date().toISOString()
  };
}

export async function runHarukaGameFrame(request: HarukaGameFrameRequest): Promise<HarukaGameFrameResponse> {
  const requestMode = request.requestMode === 'what-now' ? 'what-now' : 'ambient';
  if (request.selectedGame !== 'kintara') {
    return {
      ok: false,
      shouldSpeak: false,
      reply: '',
      overlayReply: '',
      gameContext: {
        game: 'kintara',
        realm: 'Unknown',
        activity: 'Unknown',
        health: 'Unknown',
        danger: 'Unknown',
        analysisSource: 'manual'
      },
      error: 'Unsupported game selection.',
      debug: {
        routeVersion: FRAME_ROUTE_VERSION,
        selectedGame: request.selectedGame || null
      }
    };
  }

  const sessionKey = buildSessionKey(request);
  const session = gameSessions.get(sessionKey);
  let visionObservation: KintaraObservation | null = null;
  if (request.imageDataUrl && request.imageDataUrl.startsWith('data:image/')) {
    try {
      visionObservation = await analyzeWithVision(request.imageDataUrl);
    } catch {
      visionObservation = null;
    }
  }
  const observation = visionObservation || fallbackObservation(request.pageContext);
  const gameContext = buildGameContext(request, observation);
  const speak = shouldSpeakNow(observation, session, requestMode);

  if (!speak) {
    return {
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
      };
    }

  const chatRequest: HarukaChatRequest = {
    message: buildContextForHaruka(observation, requestMode),
    history: [],
    language: request.language || 'en',
    profileId: request.profileId || 'classic',
    engineMode: request.engineMode || 'direct',
    providerId: request.providerId || 'openai-compatible',
    providerConfig: request.providerConfig,
    openSouls: request.openSouls,
    source: 'gaming-companion',
    clientType: 'browser-extension',
    sessionId: sessionKey,
    selectedGame: 'kintara',
    gameContext
  };

  const result = await runHarukaChat(chatRequest);
  if (!result.ok) {
    return {
      ok: false,
      shouldSpeak: false,
      reply: '',
      overlayReply: '',
      gameContext,
      error: result.error,
        debug: {
          routeVersion: FRAME_ROUTE_VERSION,
          sessionKey,
          analysisSource: observation.analysisSource,
          requestMode,
          handlerDebug: result.debug || null
        }
      };
  }

  gameSessions.set(sessionKey, {
    lastSignature: buildSignature(observation),
    lastCommentAt: Date.now()
  });

  return {
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
  };
}
