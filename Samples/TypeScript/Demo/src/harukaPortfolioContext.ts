export type HarukaPortfolioWalletProvider = 'phantom' | 'solflare' | 'unknown';

export interface HarukaPortfolioContext {
  walletAddress: string;
  shortAddress: string;
  walletProvider: HarukaPortfolioWalletProvider;
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

export const HARUKA_PORTFOLIO_STORAGE_KEY = 'haruka.portfolio.context.v1';

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  return Number.isFinite(value) ? value : null;
}

function normalizeNumber(value: unknown): number {
  const normalized = toFiniteNumber(value);
  return normalized === null ? 0 : normalized;
}

export function formatWalletAddress(address: string): string {
  const normalized = String(address || '').trim();
  if (normalized.length <= 10) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

export function formatCompactNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0
  }).format(value);
}

export function formatCompactUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—';
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }

  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }

  return `$${value.toFixed(6)}`;
}

export function formatPercentChange(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '0.00%';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function createPortfolioGreeting(context: HarukaPortfolioContext): string {
  if (context.haruka >= 100_000) {
    return `wow, ${formatCompactNumber(context.haruka, 0)} $HARUKA. you've been here for a while. i see you.`;
  }

  if (context.haruka >= 10_000) {
    return `you have ${formatCompactNumber(context.haruka, 0)} $HARUKA, plus ${context.sol.toFixed(2)} SOL and ${context.usdc.toFixed(2)} USDC. welcome.`;
  }

  if (context.haruka > 0) {
    return `i can see some $HARUKA in here. ${context.sol.toFixed(2)} SOL, ${context.usdc.toFixed(2)} USDC, and ${formatCompactNumber(context.haruka, 0)} $HARUKA. glad you're here.`;
  }

  if (context.sol > 5) {
    return `${context.sol.toFixed(2)} SOL and no $HARUKA yet? interesting choice.`;
  }

  if (context.sol === 0 && context.usdc === 0 && context.haruka === 0) {
    return `your wallet looks pretty empty right now. but you're here, and that's what matters.`;
  }

  return `i can see your wallet. ${context.sol.toFixed(2)} SOL and ${context.usdc.toFixed(2)} USDC. you're here.`;
}

function isPortfolioContext(value: unknown): value is HarukaPortfolioContext {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<HarukaPortfolioContext>;
  return (
    typeof candidate.walletAddress === 'string' &&
    typeof candidate.shortAddress === 'string' &&
    typeof candidate.walletProvider === 'string' &&
    typeof candidate.capturedAt === 'string' &&
    candidate.source === 'utility-page'
  );
}

export function sanitizePortfolioContext(value: unknown): HarukaPortfolioContext | null {
  if (!isPortfolioContext(value)) {
    return null;
  }

  return {
    walletAddress: value.walletAddress.trim(),
    shortAddress: value.shortAddress.trim() || formatWalletAddress(value.walletAddress),
    walletProvider:
      value.walletProvider === 'phantom' || value.walletProvider === 'solflare'
        ? value.walletProvider
        : 'unknown',
    sol: normalizeNumber(value.sol),
    usdc: normalizeNumber(value.usdc),
    haruka: normalizeNumber(value.haruka),
    harukaPriceUsd: toFiniteNumber(value.harukaPriceUsd),
    harukaChange24h: toFiniteNumber(value.harukaChange24h),
    harukaMarketCap: toFiniteNumber(value.harukaMarketCap),
    harukaVolume24h: toFiniteNumber(value.harukaVolume24h),
    capturedAt: value.capturedAt,
    source: 'utility-page'
  };
}

export function readStoredPortfolioContext(): HarukaPortfolioContext | null {
  try {
    const raw = window.localStorage.getItem(HARUKA_PORTFOLIO_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return sanitizePortfolioContext(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeStoredPortfolioContext(context: HarukaPortfolioContext): void {
  window.localStorage.setItem(HARUKA_PORTFOLIO_STORAGE_KEY, JSON.stringify(context));
}

export function clearStoredPortfolioContext(): void {
  window.localStorage.removeItem(HARUKA_PORTFOLIO_STORAGE_KEY);
}
