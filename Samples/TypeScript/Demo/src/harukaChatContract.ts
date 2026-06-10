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

export type HarukaClientType = 'web-app' | 'embed-widget' | 'api-client';

export interface HarukaPortfolioContext {
  walletAddress: string;
  shortAddress: string;
  walletProvider: 'phantom' | 'solflare' | 'unknown';
  sol: number;
  usdc: number;
  haruka: number;
  harukaPriceUsd: number | null;
  harukaChange24h: number | null;
  harukaMarketCap: number | null;
  harukaVolume24h: number | null;
  capturedAt: string;
  source: 'utility-page';
}

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
  portfolioContext?: HarukaPortfolioContext;
}

export interface HarukaChatResponse {
  ok: boolean;
  reply: string;
  engineMode: HarukaEngineMode;
  profileId: HarukaSoulProfileId;
  error?: string;
  statusCode?: number;
  paymentRequired?: boolean;
  x402Version?: number;
  price?: string;
  network?: string;
  payTo?: string;
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
