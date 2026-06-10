import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
  clearStoredPortfolioContext,
  createPortfolioGreeting,
  formatCompactNumber,
  formatCompactUsd,
  formatPercentChange,
  formatWalletAddress,
  type HarukaPortfolioContext,
  type HarukaPortfolioWalletProvider,
  writeStoredPortfolioContext
} from './harukaPortfolioContext.js';

interface BrowserWalletProvider {
  publicKey?: { toString(): string };
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey?: { toString(): string } } | void>;
  disconnect?: () => Promise<void>;
  isPhantom?: boolean;
  isSolflare?: boolean;
}

declare global {
  interface Window {
    phantom?: { solana?: BrowserWalletProvider };
    solana?: BrowserWalletProvider;
    solflare?: BrowserWalletProvider;
  }
}

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const HARUKA_MINT = new PublicKey('9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const INSTALL_URLS: Record<HarukaPortfolioWalletProvider, string> = {
  phantom: 'https://phantom.app/',
  solflare: 'https://solflare.com/',
  unknown: 'https://phantom.app/'
};
const OPEN_CHAT_URL = '/?mode=chat&portfolio=1';

const connectPhantomBtn = document.getElementById('connect-phantom-btn') as HTMLButtonElement | null;
const connectSolflareBtn = document.getElementById('connect-solflare-btn') as HTMLButtonElement | null;
const refreshBtn = document.getElementById('refresh-portfolio-btn') as HTMLButtonElement | null;
const disconnectBtn = document.getElementById('disconnect-wallet-btn') as HTMLButtonElement | null;
const openChatBtn = document.getElementById('open-chat-btn') as HTMLAnchorElement | null;
const connectHint = document.getElementById('connect-hint') as HTMLParagraphElement | null;
const connectSurface = document.getElementById('wallet-connect-surface') as HTMLDivElement | null;
const connectedSurface = document.getElementById('wallet-connected-surface') as HTMLDivElement | null;
const loadingSurface = document.getElementById('portfolio-loading') as HTMLDivElement | null;
const walletProviderLabel = document.getElementById('wallet-provider-label') as HTMLSpanElement | null;
const walletAddressLabel = document.getElementById('wallet-address-label') as HTMLSpanElement | null;
const captureTimeLabel = document.getElementById('portfolio-captured-at') as HTMLSpanElement | null;
const solValue = document.getElementById('balance-sol-value') as HTMLSpanElement | null;
const usdcValue = document.getElementById('balance-usdc-value') as HTMLSpanElement | null;
const harukaValue = document.getElementById('balance-haruka-value') as HTMLSpanElement | null;
const priceValue = document.getElementById('haruka-price-value') as HTMLSpanElement | null;
const changeValue = document.getElementById('haruka-price-change') as HTMLSpanElement | null;
const marketCapValue = document.getElementById('haruka-market-cap') as HTMLSpanElement | null;
const volumeValue = document.getElementById('haruka-volume-24h') as HTMLSpanElement | null;
const insightBubble = document.getElementById('portfolio-insight-text') as HTMLParagraphElement | null;
const statusNote = document.getElementById('portfolio-status') as HTMLDivElement | null;

let activeProvider: BrowserWalletProvider | null = null;
let activeWalletProvider: HarukaPortfolioWalletProvider = 'unknown';
let refreshIntervalId: number | null = null;
let loading = false;

function showStatus(message: string, tone: 'info' | 'error' = 'info'): void {
  if (!statusNote) {
    return;
  }

  statusNote.dataset.tone = tone;
  statusNote.textContent = message;
  statusNote.classList.add('active');
}

function setLoading(nextValue: boolean): void {
  loading = nextValue;
  connectPhantomBtn?.toggleAttribute('disabled', nextValue);
  connectSolflareBtn?.toggleAttribute('disabled', nextValue);
  refreshBtn?.toggleAttribute('disabled', nextValue);
  disconnectBtn?.toggleAttribute('disabled', nextValue);

  if (loadingSurface) {
    loadingSurface.hidden = !nextValue;
  }
}

function getProvider(kind: HarukaPortfolioWalletProvider): BrowserWalletProvider | null {
  if (kind === 'phantom') {
    return window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null) || null;
  }

  if (kind === 'solflare') {
    return window.solflare || (window.solana?.isSolflare ? window.solana : null) || null;
  }

  return null;
}

function renderDisconnectedState(): void {
  connectSurface?.removeAttribute('hidden');
  connectedSurface?.setAttribute('hidden', 'true');
  loadingSurface?.setAttribute('hidden', 'true');
  if (openChatBtn) {
    openChatBtn.setAttribute('aria-disabled', 'true');
    openChatBtn.classList.add('disabled');
  }
}

function renderConnectedState(context: HarukaPortfolioContext): void {
  connectSurface?.setAttribute('hidden', 'true');
  connectedSurface?.removeAttribute('hidden');
  loadingSurface?.setAttribute('hidden', 'true');

  if (walletProviderLabel) {
    walletProviderLabel.textContent =
      context.walletProvider === 'phantom'
        ? 'Phantom'
        : context.walletProvider === 'solflare'
          ? 'Solflare'
          : 'Browser Wallet';
  }

  if (walletAddressLabel) {
    walletAddressLabel.textContent = context.shortAddress;
  }

  if (captureTimeLabel) {
    captureTimeLabel.textContent = new Date(context.capturedAt).toLocaleString();
  }

  if (solValue) {
    solValue.textContent = context.sol.toFixed(2);
  }

  if (usdcValue) {
    usdcValue.textContent = context.usdc.toFixed(2);
  }

  if (harukaValue) {
    harukaValue.textContent = formatCompactNumber(context.haruka, 0);
  }

  if (priceValue) {
    priceValue.textContent = formatCompactUsd(context.harukaPriceUsd);
  }

  if (changeValue) {
    changeValue.textContent = formatPercentChange(context.harukaChange24h);
    changeValue.className = `portfolio-price-change ${context.harukaChange24h !== null && context.harukaChange24h < 0 ? 'down' : 'up'}`;
  }

  if (marketCapValue) {
    marketCapValue.textContent = formatCompactUsd(context.harukaMarketCap);
  }

  if (volumeValue) {
    volumeValue.textContent = formatCompactUsd(context.harukaVolume24h);
  }

  if (insightBubble) {
    insightBubble.textContent = createPortfolioGreeting(context);
  }

  if (openChatBtn) {
    openChatBtn.href = OPEN_CHAT_URL;
    openChatBtn.removeAttribute('aria-disabled');
    openChatBtn.classList.remove('disabled');
  }
}

async function getParsedTokenBalance(owner: PublicKey, mint: PublicKey): Promise<number> {
  const response = await connection.getParsedTokenAccountsByOwner(owner, { mint });
  const tokenAmount = response.value[0]?.account.data.parsed.info.tokenAmount?.uiAmount;
  return typeof tokenAmount === 'number' && Number.isFinite(tokenAmount) ? tokenAmount : 0;
}

async function getHarukaPrice(): Promise<Pick<HarukaPortfolioContext, 'harukaPriceUsd' | 'harukaChange24h' | 'harukaMarketCap' | 'harukaVolume24h'>> {
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${HARUKA_MINT.toString()}`);
  const payload = (await response.json()) as {
    pairs?: Array<{
      priceUsd?: string;
      marketCap?: number;
      priceChange?: { h24?: number | string };
      volume?: { h24?: number | string };
    }>;
  };
  const pair = payload.pairs?.[0];

  return {
    harukaPriceUsd: pair?.priceUsd ? Number.parseFloat(pair.priceUsd) : null,
    harukaChange24h:
      typeof pair?.priceChange?.h24 === 'number'
        ? pair.priceChange.h24
        : typeof pair?.priceChange?.h24 === 'string'
          ? Number.parseFloat(pair.priceChange.h24)
          : null,
    harukaMarketCap: typeof pair?.marketCap === 'number' ? pair.marketCap : null,
    harukaVolume24h:
      typeof pair?.volume?.h24 === 'number'
        ? pair.volume.h24
        : typeof pair?.volume?.h24 === 'string'
          ? Number.parseFloat(pair.volume.h24)
          : null
  };
}

function createEmptyPriceSnapshot(): Pick<
  HarukaPortfolioContext,
  'harukaPriceUsd' | 'harukaChange24h' | 'harukaMarketCap' | 'harukaVolume24h'
> {
  return {
    harukaPriceUsd: null,
    harukaChange24h: null,
    harukaMarketCap: null,
    harukaVolume24h: null
  };
}

function speakGreeting(message: string): void {
  if (!('speechSynthesis' in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 1;
  utterance.pitch = 1.08;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

async function buildPortfolioContext(publicKey: PublicKey): Promise<HarukaPortfolioContext> {
  const [solLamports, usdcBalance, harukaBalance, priceSnapshot] = await Promise.all([
    connection.getBalance(publicKey),
    getParsedTokenBalance(publicKey, USDC_MINT).catch(() => 0),
    getParsedTokenBalance(publicKey, HARUKA_MINT).catch(() => 0),
    getHarukaPrice().catch(() => createEmptyPriceSnapshot())
  ]);

  return {
    walletAddress: publicKey.toString(),
    shortAddress: formatWalletAddress(publicKey.toString()),
    walletProvider: activeWalletProvider,
    sol: solLamports / LAMPORTS_PER_SOL,
    usdc: usdcBalance,
    haruka: harukaBalance,
    harukaPriceUsd: priceSnapshot.harukaPriceUsd,
    harukaChange24h: priceSnapshot.harukaChange24h,
    harukaMarketCap: priceSnapshot.harukaMarketCap,
    harukaVolume24h: priceSnapshot.harukaVolume24h,
    capturedAt: new Date().toISOString(),
    source: 'utility-page'
  };
}

async function refreshPortfolio(triggerSpeech: boolean, announce = true): Promise<void> {
  if (!activeProvider?.publicKey) {
    return;
  }

  setLoading(true);

  try {
    const publicKey = new PublicKey(activeProvider.publicKey.toString());
    const context = await buildPortfolioContext(publicKey);
    writeStoredPortfolioContext(context);
    renderConnectedState(context);
    if (announce) {
      showStatus(`Portfolio snapshot refreshed for ${context.shortAddress}.`);
    }

    if (triggerSpeech && insightBubble?.textContent) {
      speakGreeting(insightBubble.textContent);
    }
  } catch (error) {
    console.error('Portfolio refresh failed:', error);
    showStatus('HARUKA could not read this wallet right now. Please try again.', 'error');
  } finally {
    setLoading(false);
  }
}

function startPriceRefreshLoop(): void {
  if (refreshIntervalId) {
    window.clearInterval(refreshIntervalId);
  }

  refreshIntervalId = window.setInterval(() => {
    void refreshPortfolio(false, false);
  }, 30000);
}

async function connectWallet(kind: HarukaPortfolioWalletProvider): Promise<void> {
  if (loading) {
    return;
  }

  const provider = getProvider(kind);
  if (!provider) {
    showStatus(`HARUKA could not find ${kind === 'phantom' ? 'Phantom' : 'Solflare'} in this browser. Opening the install page.`, 'error');
    window.open(INSTALL_URLS[kind], '_blank', 'noopener,noreferrer');
    return;
  }

  activeWalletProvider = kind;
  activeProvider = provider;
  setLoading(true);

  try {
    await provider.connect();
    const connectedPublicKey = provider.publicKey?.toString();
    if (!connectedPublicKey) {
      throw new Error('Wallet did not expose a public key after connection.');
    }

    await refreshPortfolio(true, true);
    startPriceRefreshLoop();

    if (connectHint) {
      connectHint.textContent = 'Snapshot saved locally and ready to follow you into HARUKA chat.';
    }
  } catch (error) {
    console.error('Wallet connect failed:', error);
    activeProvider = null;
    activeWalletProvider = 'unknown';
    showStatus('Wallet connection was cancelled or failed. Please try again.', 'error');
    renderDisconnectedState();
    setLoading(false);
  }
}

async function disconnectWallet(): Promise<void> {
  if (refreshIntervalId) {
    window.clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }

  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore browsers without speech support.
  }

  try {
    await activeProvider?.disconnect?.();
  } catch (error) {
    console.warn('Wallet disconnect failed:', error);
  }

  activeProvider = null;
  activeWalletProvider = 'unknown';
  clearStoredPortfolioContext();
  if (connectHint) {
    connectHint.textContent = 'If a wallet is missing, HARUKA opens the install page instead of pretending the connection succeeded.';
  }
  renderDisconnectedState();
  showStatus('Wallet disconnected. HARUKA cleared the saved portfolio snapshot.');
}

function bindEvents(): void {
  connectPhantomBtn?.addEventListener('click', () => {
    void connectWallet('phantom');
  });

  connectSolflareBtn?.addEventListener('click', () => {
    void connectWallet('solflare');
  });

  refreshBtn?.addEventListener('click', () => {
    void refreshPortfolio(false, true);
  });

  disconnectBtn?.addEventListener('click', () => {
    void disconnectWallet();
  });

  openChatBtn?.addEventListener('click', (event) => {
    if (openChatBtn.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      showStatus('Connect a wallet first so HARUKA can carry your portfolio context into chat.', 'error');
    }
  });
}

function initialize(): void {
  bindEvents();
  renderDisconnectedState();
  showStatus('Connect Phantom or Solflare. HARUKA reads the snapshot in your browser and keeps the handoff local.');
}

initialize();
