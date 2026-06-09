const bs58 = require('bs58');
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction
} = require('@solana/web3.js');
const {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createBurnInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint
} = require('@solana/spl-token');

const ROUTE_VERSION = 'api-haruka-buyback-2026-06-09-v1';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const DEFAULT_HARUKA_MINT = '9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump';
const DEFAULT_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DEFAULT_MIN_USDC_AMOUNT = 100000;
const DEFAULT_SLIPPAGE_BPS = 100;
const PRIVATE_KEY_REQUIRED_ISSUE =
  'HARUKA_BUYBACK_TREASURY_PRIVATE_KEY is required to swap and burn from the treasury wallet.';

let cachedJupiterApiClientFactoryPromise = null;
const mintProgramCache = new Map();

function parseBooleanFlag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function readHeaderValue(request, name) {
  const value = request && request.headers ? request.headers[name] || request.headers[name.toLowerCase()] : undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseSecretKey(secret) {
  const raw = String(secret || '').trim();
  if (!raw) {
    throw new Error('Treasury private key is missing.');
  }

  if (raw.startsWith('[')) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Treasury private key JSON array is empty.');
    }

    return Uint8Array.from(parsed);
  }

  return Uint8Array.from(bs58.decode(raw));
}

function isTokenAccountMissingError(error) {
  const name = String(error && error.name ? error.name : '');
  const message = String(error && error.message ? error.message : '');
  return (
    name === 'TokenAccountNotFoundError' ||
    name === 'TokenInvalidAccountOwnerError' ||
    message.includes('Failed to find account') ||
    message.includes('could not find account') ||
    message.includes('Account does not exist')
  );
}

function formatUiAmount(amountRaw, decimals) {
  const amount = BigInt(amountRaw);
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;
  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
}

function readBuybackConfig() {
  const enabled = parseBooleanFlag(process.env.HARUKA_BUYBACK_ENABLED);
  const publicKey =
    String(
      process.env.HARUKA_BUYBACK_TREASURY_PUBLIC_KEY ||
      process.env.HARUKA_TREASURY_WALLET ||
      process.env.HARUKA_X402_PAY_TO ||
      ''
    ).trim();

  const config = {
    enabled,
    rpcUrl: String(process.env.HARUKA_BUYBACK_RPC_URL || DEFAULT_RPC_URL).trim() || DEFAULT_RPC_URL,
    treasuryPrivateKey: String(process.env.HARUKA_BUYBACK_TREASURY_PRIVATE_KEY || '').trim(),
    treasuryPublicKey: publicKey,
    harukaMint: String(process.env.HARUKA_BUYBACK_HARUKA_MINT || DEFAULT_HARUKA_MINT).trim() || DEFAULT_HARUKA_MINT,
    usdcMint: String(process.env.HARUKA_BUYBACK_USDC_MINT || DEFAULT_USDC_MINT).trim() || DEFAULT_USDC_MINT,
    minUsdcAmountRaw: parsePositiveInteger(process.env.HARUKA_BUYBACK_MIN_USDC_AMOUNT, DEFAULT_MIN_USDC_AMOUNT),
    slippageBps: parsePositiveInteger(process.env.HARUKA_BUYBACK_SLIPPAGE_BPS, DEFAULT_SLIPPAGE_BPS),
    dryRun: parseBooleanFlag(process.env.HARUKA_BUYBACK_DRY_RUN)
  };

  const issues = [];
  if (config.enabled && !config.treasuryPublicKey) {
    issues.push('HARUKA_BUYBACK_TREASURY_PUBLIC_KEY, HARUKA_TREASURY_WALLET, or HARUKA_X402_PAY_TO is required.');
  }
  if (config.enabled && !config.treasuryPrivateKey) {
    issues.push(PRIVATE_KEY_REQUIRED_ISSUE);
  }
  if (
    config.enabled &&
    process.env.HARUKA_X402_PAY_TO &&
    config.treasuryPublicKey &&
    String(process.env.HARUKA_X402_PAY_TO).trim() !== config.treasuryPublicKey
  ) {
    issues.push('HARUKA_X402_PAY_TO should match the buyback treasury wallet so x402 revenue lands in the watched account.');
  }

  return {
    ...config,
    ready: issues.length === 0,
    issues
  };
}

function buildBuybackSnapshot() {
  const config = readBuybackConfig();
  return {
    buybackEnabled: config.enabled,
    buybackReady: config.ready,
    buybackRouteVersion: ROUTE_VERSION,
    buybackRpcUrl: config.rpcUrl,
    buybackTreasuryConfigured: Boolean(config.treasuryPublicKey),
    buybackPrivateKeyConfigured: Boolean(config.treasuryPrivateKey),
    buybackDryRunCapable: Boolean(config.treasuryPublicKey),
    buybackTreasuryPublicKey: config.treasuryPublicKey || null,
    buybackHarukaMint: config.harukaMint,
    buybackUsdcMint: config.usdcMint,
    buybackMinUsdcAmountRaw: config.minUsdcAmountRaw,
    buybackSlippageBps: config.slippageBps,
    buybackDryRun: config.dryRun,
    ...(config.issues.length > 0 ? { buybackIssues: config.issues } : {})
  };
}

function getTreasuryPublicKey(config) {
  return new PublicKey(config.treasuryPublicKey);
}

function getTreasuryKeypair(config) {
  const secretKey = parseSecretKey(config.treasuryPrivateKey);
  const keypair = Keypair.fromSecretKey(secretKey);
  if (config.treasuryPublicKey && keypair.publicKey.toString() !== config.treasuryPublicKey) {
    throw new Error('HARUKA_BUYBACK_TREASURY_PUBLIC_KEY does not match HARUKA_BUYBACK_TREASURY_PRIVATE_KEY.');
  }

  return keypair;
}

function createConnection(config) {
  return new Connection(config.rpcUrl, 'confirmed');
}

async function getTokenProgramIdForMint(connection, mintPublicKey) {
  const cacheKey = mintPublicKey.toString();
  const cached = mintProgramCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const accountInfo = await connection.getAccountInfo(mintPublicKey, 'confirmed');
  if (!accountInfo) {
    throw new Error(`Mint account ${cacheKey} was not found on the configured RPC.`);
  }

  const owner = accountInfo.owner;
  if (!owner.equals(TOKEN_PROGRAM_ID) && !owner.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new Error(`Mint ${cacheKey} is owned by unsupported token program ${owner.toString()}.`);
  }

  mintProgramCache.set(cacheKey, owner);
  return owner;
}

async function loadCreateJupiterApiClient() {
  if (!cachedJupiterApiClientFactoryPromise) {
    cachedJupiterApiClientFactoryPromise = (async () => {
      try {
        const moduleRef = require('@jup-ag/api');
        if (typeof moduleRef.createJupiterApiClient === 'function') {
          return moduleRef.createJupiterApiClient;
        }
      } catch (error) {
        if (!error || error.code !== 'ERR_REQUIRE_ESM') {
          throw error;
        }
      }

      const moduleRef = await import('@jup-ag/api');
      const factory = moduleRef.createJupiterApiClient || moduleRef.default?.createJupiterApiClient;
      if (typeof factory === 'function') {
        return factory;
      }

      throw new Error('Could not load Jupiter API client.');
    })().catch((error) => {
      cachedJupiterApiClientFactoryPromise = null;
      throw error;
    });
  }

  return cachedJupiterApiClientFactoryPromise;
}

async function getTokenAccountState(connection, mintPublicKey, ownerPublicKey, tokenProgramId) {
  const ata = await getAssociatedTokenAddress(
    mintPublicKey,
    ownerPublicKey,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  try {
    const account = await getAccount(connection, ata, 'confirmed', tokenProgramId);
    return {
      ata,
      exists: true,
      amountRaw: BigInt(account.amount.toString())
    };
  } catch (error) {
    if (isTokenAccountMissingError(error)) {
      return {
        ata,
        exists: false,
        amountRaw: 0n
      };
    }

    throw error;
  }
}

async function ensureAssociatedTokenAccount(connection, payerKeypair, mintPublicKey, tokenProgramId) {
  const tokenState = await getTokenAccountState(connection, mintPublicKey, payerKeypair.publicKey, tokenProgramId);
  if (tokenState.exists) {
    return {
      ata: tokenState.ata,
      created: false,
      signature: null
    };
  }

  const instruction = createAssociatedTokenAccountInstruction(
    payerKeypair.publicKey,
    tokenState.ata,
    payerKeypair.publicKey,
    mintPublicKey,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({
    feePayer: payerKeypair.publicKey,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(instruction);

  transaction.sign(payerKeypair);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false
  });
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    },
    'confirmed'
  );

  return {
    ata: tokenState.ata,
    created: true,
    signature
  };
}

async function getMintDetails(connection, mintPublicKey) {
  const tokenProgramId = await getTokenProgramIdForMint(connection, mintPublicKey);
  const mint = await getMint(connection, mintPublicKey, 'confirmed', tokenProgramId);
  return {
    decimals: mint.decimals,
    tokenProgramId
  };
}

async function createJupiterQuote(config, amountRaw) {
  const createJupiterApiClient = await loadCreateJupiterApiClient();
  const jupiterApi = createJupiterApiClient();
  const quote = await jupiterApi.quoteGet({
    inputMint: config.usdcMint,
    outputMint: config.harukaMint,
    amount: amountRaw.toString(),
    slippageBps: config.slippageBps
  });

  if (!quote || !quote.outAmount) {
    throw new Error('Jupiter did not return a swap quote for the treasury USDC balance.');
  }

  return {
    jupiterApi,
    quote
  };
}

async function executeJupiterSwap(connection, jupiterApi, quote, treasuryKeypair) {
  const swapResult = await jupiterApi.swapPost({
    swapRequest: {
      quoteResponse: quote,
      userPublicKey: treasuryKeypair.publicKey.toString(),
      wrapAndUnwrapSol: true
    }
  });

  if (!swapResult || !swapResult.swapTransaction) {
    throw new Error('Jupiter did not return a swap transaction.');
  }

  const swapTransaction = VersionedTransaction.deserialize(Buffer.from(swapResult.swapTransaction, 'base64'));
  swapTransaction.sign([treasuryKeypair]);

  const signature = await connection.sendRawTransaction(swapTransaction.serialize(), {
    skipPreflight: false
  });
  await connection.confirmTransaction(signature, 'confirmed');

  return {
    signature,
    raw: swapResult
  };
}

async function burnHarukaAmount(connection, treasuryKeypair, mintPublicKey, tokenAccountAddress, amountRaw, tokenProgramId) {
  if (amountRaw <= 0n) {
    throw new Error('Burn amount must be greater than zero.');
  }

  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  const burnInstruction = createBurnInstruction(
    tokenAccountAddress,
    mintPublicKey,
    treasuryKeypair.publicKey,
    amountRaw,
    [],
    tokenProgramId
  );

  const transaction = new Transaction({
    feePayer: treasuryKeypair.publicKey,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(burnInstruction);

  transaction.sign(treasuryKeypair);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false
  });
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    },
    'confirmed'
  );

  return signature;
}

function parseBuybackQueryOptions(request) {
  const query = request && request.query && typeof request.query === 'object' ? request.query : {};
  return {
    dryRun: String(query.dryRun || '').trim() === '1',
    force: String(query.force || '').trim() === '1'
  };
}

function isAuthorizedBuybackRequest(request) {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  if (!cronSecret) {
    return {
      ok: String(process.env.VERCEL_ENV || 'local') !== 'production',
      reason: 'CRON_SECRET is not configured.'
    };
  }

  const authorization = String(readHeaderValue(request, 'authorization') || '').trim();
  return {
    ok: authorization === `Bearer ${cronSecret}`,
    reason: 'Authorization header does not match CRON_SECRET.'
  };
}

async function runHarukaBuybackCycle(options = {}) {
  const config = readBuybackConfig();
  const snapshot = buildBuybackSnapshot();
  const dryRun = Boolean(options.dryRun || config.dryRun);
  const force = Boolean(options.force);
  const dryRunWithoutPrivateKey =
    dryRun && Boolean(config.treasuryPublicKey) && config.issues.every((issue) => issue === PRIVATE_KEY_REQUIRED_ISSUE);

  if (!config.enabled) {
    return {
      ok: true,
      executed: false,
      skipped: true,
      reason: 'HARUKA_BUYBACK_ENABLED is false.',
      dryRun,
      force,
      snapshot
    };
  }

  if (!config.ready && !dryRunWithoutPrivateKey) {
    return {
      ok: false,
      executed: false,
      skipped: true,
      statusCode: 503,
      reason: config.issues.join(' '),
      dryRun,
      force,
      snapshot
    };
  }

  const connection = createConnection(config);
  const treasuryPublicKey = dryRunWithoutPrivateKey ? getTreasuryPublicKey(config) : getTreasuryKeypair(config).publicKey;
  const usdcMint = new PublicKey(config.usdcMint);
  const harukaMint = new PublicKey(config.harukaMint);
  const usdcMintDetails = await getMintDetails(connection, usdcMint);
  const harukaMintDetails = await getMintDetails(connection, harukaMint);
  const usdcDecimals = usdcMintDetails.decimals;
  const harukaDecimals = harukaMintDetails.decimals;
  const usdcState = await getTokenAccountState(connection, usdcMint, treasuryPublicKey, usdcMintDetails.tokenProgramId);
  const minThresholdRaw = BigInt(config.minUsdcAmountRaw);
  const treasurySummary = {
    publicKey: treasuryPublicKey.toString(),
    usdcTokenAccount: usdcState.ata.toString(),
    usdcBalanceRaw: usdcState.amountRaw.toString(),
    usdcBalanceUi: formatUiAmount(usdcState.amountRaw, usdcDecimals)
  };

  if (usdcState.amountRaw <= 0n) {
    return {
      ok: true,
      executed: false,
      skipped: true,
      reason: 'Treasury USDC balance is zero, so there is nothing to buy back yet.',
      dryRun,
      force,
      snapshot,
      treasury: treasurySummary
    };
  }

  if (usdcState.amountRaw < minThresholdRaw && !force) {
    return {
      ok: true,
      executed: false,
      skipped: true,
      reason: 'Treasury USDC balance is below the configured buyback threshold.',
      dryRun,
      force,
      snapshot,
      treasury: treasurySummary
    };
  }

  const { jupiterApi, quote } = await createJupiterQuote(config, usdcState.amountRaw);
  const quotedHarukaOutRaw = BigInt(String(quote.outAmount));

  if (dryRun) {
    return {
      ok: true,
      executed: false,
      skipped: true,
      reason: 'Dry run only. No swap or burn transaction was submitted.',
      dryRun,
      force,
      snapshot,
      treasury: treasurySummary,
      quote: {
        usdcInRaw: usdcState.amountRaw.toString(),
        usdcInUi: formatUiAmount(usdcState.amountRaw, usdcDecimals),
        harukaOutRaw: quotedHarukaOutRaw.toString(),
        harukaOutUi: formatUiAmount(quotedHarukaOutRaw, harukaDecimals),
        routePlanCount: Array.isArray(quote.routePlan) ? quote.routePlan.length : 0,
        priceImpactPct: String(quote.priceImpactPct || '0')
      }
    };
  }

  const treasuryKeypair = getTreasuryKeypair(config);
  const outputAtaResult = await ensureAssociatedTokenAccount(
    connection,
    treasuryKeypair,
    harukaMint,
    harukaMintDetails.tokenProgramId
  );
  const harukaBalanceBefore = await getTokenAccountState(
    connection,
    harukaMint,
    treasuryPublicKey,
    harukaMintDetails.tokenProgramId
  );
  const swap = await executeJupiterSwap(connection, jupiterApi, quote, treasuryKeypair);
  const harukaBalanceAfter = await getTokenAccountState(
    connection,
    harukaMint,
    treasuryPublicKey,
    harukaMintDetails.tokenProgramId
  );
  const purchasedHarukaRaw = harukaBalanceAfter.amountRaw - harukaBalanceBefore.amountRaw;

  if (purchasedHarukaRaw <= 0n) {
    throw new Error('Swap confirmed but treasury HARUKA balance did not increase, so there is nothing new to burn.');
  }

  const burnSignature = await burnHarukaAmount(
    connection,
    treasuryKeypair,
    harukaMint,
    harukaBalanceAfter.ata,
    purchasedHarukaRaw,
    harukaMintDetails.tokenProgramId
  );
  const finalUsdcState = await getTokenAccountState(
    connection,
    usdcMint,
    treasuryPublicKey,
    usdcMintDetails.tokenProgramId
  );
  const finalHarukaState = await getTokenAccountState(
    connection,
    harukaMint,
    treasuryPublicKey,
    harukaMintDetails.tokenProgramId
  );

  return {
    ok: true,
    executed: true,
    skipped: false,
    dryRun,
    force,
    snapshot,
    treasury: {
      publicKey: treasuryPublicKey.toString(),
      usdcTokenAccount: usdcState.ata.toString(),
      harukaTokenAccount: harukaBalanceAfter.ata.toString()
    },
    quote: {
      usdcInRaw: usdcState.amountRaw.toString(),
      usdcInUi: formatUiAmount(usdcState.amountRaw, usdcDecimals),
      harukaOutRaw: quotedHarukaOutRaw.toString(),
      harukaOutUi: formatUiAmount(quotedHarukaOutRaw, harukaDecimals),
      routePlanCount: Array.isArray(quote.routePlan) ? quote.routePlan.length : 0,
      priceImpactPct: String(quote.priceImpactPct || '0')
    },
    outputTokenAccount: {
      address: outputAtaResult.ata.toString(),
      created: outputAtaResult.created,
      creationSignature: outputAtaResult.signature
    },
    swap: {
      signature: swap.signature
    },
    burn: {
      signature: burnSignature,
      harukaBurnedRaw: purchasedHarukaRaw.toString(),
      harukaBurnedUi: formatUiAmount(purchasedHarukaRaw, harukaDecimals)
    },
    finalBalances: {
      usdcRaw: finalUsdcState.amountRaw.toString(),
      usdcUi: formatUiAmount(finalUsdcState.amountRaw, usdcDecimals),
      harukaRaw: finalHarukaState.amountRaw.toString(),
      harukaUi: formatUiAmount(finalHarukaState.amountRaw, harukaDecimals)
    }
  };
}

module.exports = {
  ROUTE_VERSION,
  buildBuybackSnapshot,
  isAuthorizedBuybackRequest,
  parseBuybackQueryOptions,
  readBuybackConfig,
  runHarukaBuybackCycle
};
