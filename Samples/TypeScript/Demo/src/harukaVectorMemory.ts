import type { HarukaHistoryItem, HarukaPortfolioContext } from './harukaChatContract';

export interface HarukaStoredConversationMemory {
  walletAddress: string;
  tier: number;
  tierLabel: string;
  updatedAt: string;
  history: HarukaHistoryItem[];
}

const HARUKA_VECTOR_MEMORY_PREFIX = 'haruka.vectorMemory.chat.v1';

function isHistoryItem(value: unknown): value is HarukaHistoryItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<HarukaHistoryItem>;
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string'
  );
}

export function canUseVectorMemoryTier(context: HarukaPortfolioContext | null): boolean {
  return Boolean(context && context.tier >= 1);
}

export function getVectorMemoryTurnLimit(context: HarukaPortfolioContext | null): number {
  switch (context?.tier) {
    case 3:
      return 16;
    case 2:
      return 12;
    case 1:
      return 8;
    default:
      return 0;
  }
}

export function getVectorMemoryStorageKey(context: HarukaPortfolioContext | null): string | null {
  const walletAddress = context?.walletAddress?.trim();
  if (!walletAddress) {
    return null;
  }

  return `${HARUKA_VECTOR_MEMORY_PREFIX}:${walletAddress}`;
}

export function readStoredConversationMemory(
  context: HarukaPortfolioContext | null
): HarukaStoredConversationMemory | null {
  const storageKey = getVectorMemoryStorageKey(context);
  if (!storageKey) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<HarukaStoredConversationMemory>;
    if (
      typeof parsed.walletAddress !== 'string' ||
      typeof parsed.updatedAt !== 'string' ||
      typeof parsed.tier !== 'number' ||
      typeof parsed.tierLabel !== 'string' ||
      !Array.isArray(parsed.history)
    ) {
      return null;
    }

    return {
      walletAddress: parsed.walletAddress,
      tier: parsed.tier,
      tierLabel: parsed.tierLabel,
      updatedAt: parsed.updatedAt,
      history: parsed.history.filter(isHistoryItem).map((item) => ({
        role: item.role,
        content: item.content.trim()
      }))
    };
  } catch {
    return null;
  }
}

export function writeStoredConversationMemory(
  context: HarukaPortfolioContext,
  history: HarukaHistoryItem[]
): void {
  const storageKey = getVectorMemoryStorageKey(context);
  if (!storageKey) {
    return;
  }

  const payload: HarukaStoredConversationMemory = {
    walletAddress: context.walletAddress,
    tier: context.tier,
    tierLabel: context.tierLabel,
    updatedAt: new Date().toISOString(),
    history
  };

  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

export function clearStoredConversationMemory(context: HarukaPortfolioContext | null): void {
  const storageKey = getVectorMemoryStorageKey(context);
  if (!storageKey) {
    return;
  }

  window.localStorage.removeItem(storageKey);
}

export function clearAllStoredConversationMemories(): void {
  try {
    const keysToDelete: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(HARUKA_VECTOR_MEMORY_PREFIX)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {
    // Ignore storage errors while clearing memory.
  }
}
