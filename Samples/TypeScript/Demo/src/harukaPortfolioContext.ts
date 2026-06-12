export type HarukaPortfolioWalletProvider = 'phantom' | 'solflare' | 'unknown';
export type HarukaHolderTier = 0 | 1 | 2 | 3;
export type HarukaTierMemoryDepth = 'light' | 'warm' | 'deep' | 'legendary';

export interface HarukaTierDefinition {
  tier: HarukaHolderTier;
  label: 'Free' | 'Companion' | 'Partner' | 'Forest Guard';
  minHaruka: number;
  memoryDepth: HarukaTierMemoryDepth;
  perks: string[];
}

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
  tier: HarukaHolderTier;
  tierLabel: HarukaTierDefinition['label'];
  tierMinHaruka: number;
  memoryDepth: HarukaTierMemoryDepth;
  unlockedPerks: string[];
  capturedAt: string;
  source: 'utility-page';
}

export const HARUKA_PORTFOLIO_STORAGE_KEY = 'haruka.portfolio.context.v1';
export const HARUKA_TIER_DEFINITIONS: readonly HarukaTierDefinition[] = [
  {
    tier: 3,
    label: 'Forest Guard',
    minHaruka: 5_000_000,
    memoryDepth: 'legendary',
    perks: [
      'Everything Tier 2',
      'Gaming companion mode',
      'Swap inside chat',
      'Deeper memory',
      'Private community access',
      'Name listed on website'
    ]
  },
  {
    tier: 2,
    label: 'Partner',
    minHaruka: 2_500_000,
    memoryDepth: 'deep',
    perks: [
      'Everything Tier 1',
      'Custom personality settings',
      'Priority response',
      'Reduced API rate (developers)',
      'Early access new features',
      'Exclusive background scenes'
    ]
  },
  {
    tier: 1,
    label: 'Companion',
    minHaruka: 500_000,
    memoryDepth: 'warm',
    perks: [
      'Everything Tier 0',
      'Memory unlocked',
      'Faster response',
      'Portfolio management'
    ]
  },
  {
    tier: 0,
    label: 'Free',
    minHaruka: 0,
    memoryDepth: 'light',
    perks: [
      'Basic chat',
      'Voice interaction',
      'Live2D expressions',
      'EN/JP toggle',
      'Standard response speed'
    ]
  }
] as const;

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

export function detectHarukaTier(harukaBalance: number): HarukaTierDefinition {
  const normalizedBalance = Number.isFinite(harukaBalance) ? harukaBalance : 0;
  return HARUKA_TIER_DEFINITIONS.find((entry) => normalizedBalance >= entry.minHaruka) || HARUKA_TIER_DEFINITIONS[HARUKA_TIER_DEFINITIONS.length - 1];
}

function getTierPerksForLevel(tier: HarukaHolderTier): string[] {
  const ascendingDefinitions = [...HARUKA_TIER_DEFINITIONS].sort((left, right) => left.tier - right.tier);

  return [...new Set(
    ascendingDefinitions
      .filter((entry) => entry.tier <= tier)
      .flatMap((entry) => entry.perks)
  )];
}

export function getHarukaTierProgress(context: Pick<HarukaPortfolioContext, 'haruka' | 'tier'>): string {
  const nextTier = HARUKA_TIER_DEFINITIONS.find((entry) => entry.tier > context.tier);
  if (!nextTier) {
    return 'Top tier unlocked.';
  }

  const remaining = Math.max(0, nextTier.minHaruka - context.haruka);
  return `${formatCompactNumber(remaining, 0)} $HARUKA to ${nextTier.label}.`;
}

export function enrichPortfolioContextTier<T extends Omit<HarukaPortfolioContext, 'tier' | 'tierLabel' | 'tierMinHaruka' | 'memoryDepth' | 'unlockedPerks'>>(context: T): HarukaPortfolioContext {
  const tierDefinition = detectHarukaTier(context.haruka);
  return {
    ...context,
    tier: tierDefinition.tier,
    tierLabel: tierDefinition.label,
    tierMinHaruka: tierDefinition.minHaruka,
    memoryDepth: tierDefinition.memoryDepth,
    unlockedPerks: getTierPerksForLevel(tierDefinition.tier)
  };
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
  if (context.tier === 3) {
    return `forest guard recognized. ${formatCompactNumber(context.haruka, 0)} $HARUKA is already in your wallet, so i'll keep the memory deeper and the read sharper.`;
  }

  if (context.tier === 2) {
    return `partner tier confirmed. i'm seeing ${formatCompactNumber(context.haruka, 0)} $HARUKA with ${context.sol.toFixed(2)} SOL and ${context.usdc.toFixed(2)} USDC beside it.`;
  }

  if (context.tier === 1) {
    return `companion tier unlocked. ${formatCompactNumber(context.haruka, 0)} $HARUKA is enough for me to remember you a little more closely.`;
  }

  if (context.haruka > 0) {
    return `i can see ${formatCompactNumber(context.haruka, 0)} $HARUKA in here. you're still on the free tier for now, but you're already close enough for me to notice.`;
  }

  if (context.sol > 5) {
    return `${context.sol.toFixed(2)} SOL and no $HARUKA yet? free tier for now, but the wallet has room to grow.`;
  }

  if (context.sol === 0 && context.usdc === 0 && context.haruka === 0) {
    return `your wallet looks quiet right now. free tier is active until some $HARUKA arrives.`;
  }

  return `i can see your wallet. ${context.sol.toFixed(2)} SOL, ${context.usdc.toFixed(2)} USDC, and free tier for now.`;
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

  return enrichPortfolioContextTier({
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
  });
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
