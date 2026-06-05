export type HarukaLanguage = 'en' | 'jp';

export type HarukaSoulProfileId = 'classic' | 'scholar' | 'sunset' | 'cyberpunk';

export type HarukaEngineMode = 'direct' | 'opensouls-bridge';

export type HarukaChatSource = 'chat-ui' | 'pumpfun-relay';

export interface HarukaHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface HarukaProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface OpenSoulsBridgeConfig {
  baseUrl?: string;
}

export type HarukaClientType = 'web-app' | 'embed-widget';

export interface HarukaChatRequest {
  message: string;
  history: HarukaHistoryItem[];
  language: HarukaLanguage;
  profileId: HarukaSoulProfileId;
  engineMode: HarukaEngineMode;
  providerId: string;
  providerConfig?: HarukaProviderConfig;
  openSouls?: OpenSoulsBridgeConfig;
  source?: HarukaChatSource;
  username?: string;
  clientType?: HarukaClientType;
  apiKey?: string;
  userId?: string;
  sessionId?: string;
}

export interface HarukaChatResponse {
  ok: boolean;
  reply: string;
  engineMode: HarukaEngineMode;
  profileId: HarukaSoulProfileId;
  error?: string;
  statusCode?: number;
  usage?: HarukaUsageInfo;
  debug?: Record<string, unknown>;
}

export interface HarukaUsageInfo {
  scope: 'disabled' | 'web-app' | 'embed-widget' | 'embed-api-key' | 'bypass';
  gateEnabled: boolean;
  windowMinutes: number;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt?: string;
}
