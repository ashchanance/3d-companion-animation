export type HarukaLanguage = 'en' | 'jp';

export type HarukaSoulProfileId = 'classic' | 'scholar' | 'sunset' | 'cyberpunk';

export type HarukaEngineMode = 'direct' | 'opensouls-bridge';

export type HarukaSupportedGame = 'kintara';

export type HarukaChatSource = 'chat-ui' | 'pumpfun-relay' | 'gaming-companion';

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

export type HarukaClientType = 'web-app' | 'embed-widget' | 'api-client' | 'browser-extension';
export type HarukaHolderTier = 0 | 1 | 2 | 3;
export type HarukaTierMemoryDepth = 'light' | 'warm' | 'deep' | 'legendary';

export interface HarukaGameContext {
  game: HarukaSupportedGame;
  realm?: string;
  activity?: string;
  health?: string;
  danger?: string;
  notableObjects?: string[];
  questUi?: string[];
  visionSummary?: string;
  pageHint?: string;
  host?: string;
  analysisSource?: 'vision' | 'page-fallback' | 'manual';
  shouldInterrupt?: boolean;
  capturedAt?: string;
}

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
  tier: HarukaHolderTier;
  tierLabel: 'Free' | 'Companion' | 'Partner' | 'Forest Guard';
  tierMinHaruka: number;
  memoryDepth: HarukaTierMemoryDepth;
  unlockedPerks: string[];
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
  selectedGame?: HarukaSupportedGame;
  gameContext?: HarukaGameContext;
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
