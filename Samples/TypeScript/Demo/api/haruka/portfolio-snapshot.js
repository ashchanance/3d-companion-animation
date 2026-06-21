const ROUTE_VERSION = 'api-haruka-portfolio-snapshot-2026-06-10-v1';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const HARUKA_MINT = '9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const RPC_TIMEOUT_MS = 8000;
const PRICE_TIMEOUT_MS = 5000;

let cachedSolanaSdkPromise = null;

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

function readRpcUrl() {
  return (
    String(process.env.HARUKA_UTILITY_RPC_URL || process.env.HARUKA_BUYBACK_RPC_URL || DEFAULT_RPC_URL).trim() ||
    DEFAULT_RPC_URL
  );
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isRpcForbiddenError(error) {
  const message = String(error && error.message ? error.message : error || '');
  return message.includes('403') || message.toLowerCase().includes('access forbidden');
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function loadSolanaSdk() {
  if (!cachedSolanaSdkPromise) {
    cachedSolanaSdkPromise = import('@solana/web3.js')
      .then((moduleRef) => {
        const sdk = moduleRef.default && moduleRef.default.Connection ? moduleRef.default : moduleRef;
        if (!sdk.Connection || !sdk.PublicKey || typeof sdk.LAMPORTS_PER_SOL !== 'number') {
          throw new Error('Could not load Solana web3 SDK for portfolio snapshot route.');
        }

        return sdk;
      })
      .catch((error) => {
        cachedSolanaSdkPromise = null;
        throw error;
      });
  }

  return cachedSolanaSdkPromise;
}

async function getParsedTokenBalance(connection, owner, mint) {
  const response = await withTimeout(
    connection.getParsedTokenAccountsByOwner(owner, { mint }),
    RPC_TIMEOUT_MS,
    'Parsed token balance lookup'
  );
  const tokenAmount = response.value[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
  return typeof tokenAmount === 'number' && Number.isFinite(tokenAmount) ? tokenAmount : 0;
}

async function getHarukaPrice() {
  const response = await withTimeout(
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${HARUKA_MINT}`),
    PRICE_TIMEOUT_MS,
    'DexScreener price lookup'
  );
  if (!response.ok) {
    throw new Error(`DexScreener returned ${response.status} for HARUKA market snapshot.`);
  }

  const payload = await response.json();
  const pair = Array.isArray(payload && payload.pairs) ? payload.pairs[0] : null;

  return {
    harukaPriceUsd: toFiniteNumber(pair && pair.priceUsd),
    harukaChange24h: toFiniteNumber(pair && pair.priceChange && pair.priceChange.h24),
    harukaMarketCap: toFiniteNumber(pair && pair.marketCap),
    harukaVolume24h: toFiniteNumber(pair && pair.volume && pair.volume.h24)
  };
}

module.exports = async function handler(request, response) {
  applyHeaders(response);

  if (request.method === 'OPTIONS') {
    response.status(200).json({ ok: true });
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({
      ok: false,
      error: 'Method not allowed. Use POST.',
      routeVersion: ROUTE_VERSION
    });
    return;
  }

  try {
    const body = normalizeBody(request.body);
    const walletAddress = String(body.walletAddress || '').trim();
    if (!walletAddress) {
      response.status(400).json({
        ok: false,
        error: 'walletAddress is required.',
        routeVersion: ROUTE_VERSION
      });
      return;
    }

    const sdk = await loadSolanaSdk();
    const connection = new sdk.Connection(readRpcUrl(), 'confirmed');
    const owner = new sdk.PublicKey(walletAddress);
    const harukaMint = new sdk.PublicKey(HARUKA_MINT);
    const usdcMint = new sdk.PublicKey(USDC_MINT);

    const [solLamports, usdcBalance, harukaBalance, priceSnapshot] = await Promise.all([
      withTimeout(connection.getBalance(owner), RPC_TIMEOUT_MS, 'SOL balance lookup'),
      getParsedTokenBalance(connection, owner, usdcMint).catch(() => 0),
      getParsedTokenBalance(connection, owner, harukaMint).catch(() => 0),
      getHarukaPrice().catch(() => ({
        harukaPriceUsd: null,
        harukaChange24h: null,
        harukaMarketCap: null,
        harukaVolume24h: null
      }))
    ]);

    response.status(200).json({
      ok: true,
      routeVersion: ROUTE_VERSION,
      walletAddress,
      sol: solLamports / sdk.LAMPORTS_PER_SOL,
      usdc: usdcBalance,
      haruka: harukaBalance,
      ...priceSnapshot,
      capturedAt: new Date().toISOString()
    });
  } catch (error) {
    const rpcForbidden = isRpcForbiddenError(error);
    const timedOut = String(error && error.message ? error.message : error || '').toLowerCase().includes('timed out');
    response.status(rpcForbidden ? 503 : 500).json({
      ok: false,
      code: rpcForbidden ? 'RPC_FORBIDDEN' : timedOut ? 'PORTFOLIO_SNAPSHOT_TIMEOUT' : 'PORTFOLIO_SNAPSHOT_FAILED',
      error: rpcForbidden
        ? 'The Solana RPC provider rejected this portfolio lookup. Configure HARUKA_UTILITY_RPC_URL or HARUKA_BUYBACK_RPC_URL with a dedicated mainnet RPC.'
        : timedOut
          ? 'Live wallet snapshot timed out. Retry in a moment or use the last cached wallet snapshot.'
        : String(error && error.message ? error.message : error || 'Unknown portfolio snapshot error.'),
      routeVersion: ROUTE_VERSION
    });
  }
};
