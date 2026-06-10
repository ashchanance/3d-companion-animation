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

const INSTALL_URLS: Record<HarukaPortfolioWalletProvider, string> = {
  phantom: 'https://phantom.app/',
  solflare: 'https://solflare.com/',
  unknown: 'https://phantom.app/'
};
const OPEN_CHAT_URL = '/?mode=chat&portfolio=1';
const PORTFOLIO_API_URL = '/api/haruka/portfolio-snapshot';

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
let activeGreetingAudio: HTMLAudioElement | null = null;
let activeGreetingAudioUrl: string | null = null;
let activeGreetingUtterance: SpeechSynthesisUtterance | null = null;

interface PortfolioSnapshotResponse {
  ok: boolean;
  walletAddress: string;
  sol: number;
  usdc: number;
  haruka: number;
  harukaPriceUsd: number | null;
  harukaChange24h: number | null;
  harukaMarketCap: number | null;
  harukaVolume24h: number | null;
  capturedAt: string;
  error?: string;
  code?: string;
}

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

function cleanSpeechText(text: string): string {
  return String(text || '')
    .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
    .replace(/[\[\]\(\)\{\}]/g, ' ')
    .trim();
}

function stopActiveGreetingPlayback(): void {
  if (activeGreetingAudio) {
    activeGreetingAudio.pause();
    activeGreetingAudio.currentTime = 0;
    activeGreetingAudio = null;
  }

  if (activeGreetingAudioUrl) {
    URL.revokeObjectURL(activeGreetingAudioUrl);
    activeGreetingAudioUrl = null;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  activeGreetingUtterance = null;
}

async function fetchPortfolioSnapshot(walletAddress: string): Promise<PortfolioSnapshotResponse> {
  const response = await fetch(PORTFOLIO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ walletAddress })
  });

  const payload = (await response.json()) as PortfolioSnapshotResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'HARUKA could not fetch the wallet snapshot.');
  }

  return payload;
}

function speakGreetingWebSpeech(message: string): void {
  if (!('speechSynthesis' in window)) {
    return;
  }

  const cleanText = cleanSpeechText(message);
  if (!cleanText) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  activeGreetingUtterance = utterance;
  utterance.lang = 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1.08;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find((voice) => voice.lang.toLowerCase().includes('en'));
  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  utterance.onend = () => {
    if (activeGreetingUtterance === utterance) {
      activeGreetingUtterance = null;
    }
  };

  utterance.onerror = () => {
    if (activeGreetingUtterance === utterance) {
      activeGreetingUtterance = null;
    }
  };

  window.speechSynthesis.speak(utterance);
}

async function speakGreeting(message: string): Promise<void> {
  const cleanText = cleanSpeechText(message);
  if (!cleanText) {
    return;
  }

  stopActiveGreetingPlayback();

  const elevenLabsApiKey = (import.meta as any).env.VITE_ELEVENLABS_API_KEY || '';
  const elevenLabsVoiceId = (import.meta as any).env.VITE_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const elevenLabsModelId = (import.meta as any).env.VITE_ELEVENLABS_MODEL_ID || 'eleven_monolingual_v1';

  if (!elevenLabsApiKey) {
    speakGreetingWebSpeech(cleanText);
    return;
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsApiKey
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: elevenLabsModelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    activeGreetingAudio = audio;
    activeGreetingAudioUrl = audioUrl;
    audio.preload = 'auto';

    const cleanup = () => {
      if (activeGreetingAudio === audio) {
        activeGreetingAudio = null;
      }
      if (activeGreetingAudioUrl === audioUrl) {
        URL.revokeObjectURL(audioUrl);
        activeGreetingAudioUrl = null;
      }
    };

    audio.onended = cleanup;
    audio.onerror = cleanup;
    audio.onabort = cleanup;

    await audio.play();
  } catch (error) {
    console.error('Utility ElevenLabs TTS failed, falling back to Web Speech API:', error);
    stopActiveGreetingPlayback();
    speakGreetingWebSpeech(cleanText);
  }
}

async function buildPortfolioContext(walletAddress: string): Promise<HarukaPortfolioContext> {
  const snapshot = await fetchPortfolioSnapshot(walletAddress);
  return {
    walletAddress,
    shortAddress: formatWalletAddress(walletAddress),
    walletProvider: activeWalletProvider,
    sol: snapshot.sol,
    usdc: snapshot.usdc,
    haruka: snapshot.haruka,
    harukaPriceUsd: snapshot.harukaPriceUsd,
    harukaChange24h: snapshot.harukaChange24h,
    harukaMarketCap: snapshot.harukaMarketCap,
    harukaVolume24h: snapshot.harukaVolume24h,
    capturedAt: snapshot.capturedAt,
    source: 'utility-page'
  };
}

async function refreshPortfolio(triggerSpeech: boolean, announce = true): Promise<void> {
  if (!activeProvider?.publicKey) {
    return;
  }

  setLoading(true);

  try {
    const walletAddress = activeProvider.publicKey.toString();
    const context = await buildPortfolioContext(walletAddress);
    writeStoredPortfolioContext(context);
    renderConnectedState(context);
    if (announce) {
      showStatus(`Portfolio snapshot refreshed for ${context.shortAddress}.`);
    }

    if (triggerSpeech && insightBubble?.textContent) {
      void speakGreeting(insightBubble.textContent);
    }
  } catch (error) {
    console.error('Portfolio refresh failed:', error);
    const message = error instanceof Error ? error.message : 'HARUKA could not read this wallet right now. Please try again.';
    showStatus(message, 'error');
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
    stopActiveGreetingPlayback();
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
