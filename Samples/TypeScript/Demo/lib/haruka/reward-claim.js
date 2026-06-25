const ROUTE_VERSION = 'api-haruka-reward-claim-2026-06-25-v3';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const DEFAULT_HARUKA_MINT = '9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump';
const DEFAULT_BURN_RATE = 0.02;
const DEFAULT_MIN_CLAIM = 100;
const DEFAULT_DECIMAL_SCALE = 1000000n;
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const DEFAULT_MEMO_LOOKBACK = 60;
const DEFAULT_RPC_RETRY_ATTEMPTS = 4;
const DEFAULT_RPC_RETRY_DELAY_MS = 350;
const BAD_REQUEST_ERROR_CODE = 'HARUKA_REWARD_CLAIM_BAD_REQUEST';

const {
  applyClaimSettlement,
  buildClaimPreview,
  buildRewardStateSnapshot,
  createBaseRewardState,
  createClaimMemo,
  createRewardStateProof,
  normalizeRewardState,
  parseRewardStateProof,
  readRewardStateConfig,
  summarizeRewardState
} = require('./reward-state.js');
const {
  CONFLICT_ERROR_CODE,
  bootstrapRewardLedgerState,
  buildRewardLedgerSnapshot,
  hasLedgerClaimMemo,
  persistRewardLedgerState,
  readCurrentRewardLedgerState
} = require('./reward-ledger.js');

let cachedSdkPromise = null;
const mintProgramCache = new Map();

function createBadRequestError(message) {
  const error = new Error(message);
  error.code = BAD_REQUEST_ERROR_CODE;
  return error;
}

function parseBooleanFlag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value || '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
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

function parseBody(body) {
  if (typeof body === 'string') {
    return JSON.parse(body);
  }

  return body || {};
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableRpcError(error) {
  const message = String(error && error.message ? error.message : error || '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('rate exceeded') ||
    message.includes('temporarily unavailable') ||
    message.includes('gateway timeout') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}

function readRewardClaimRuntimeConfig() {
  return {
    memoLookback: parsePositiveInteger(process.env.HARUKA_REWARD_CLAIM_MEMO_LOOKBACK, DEFAULT_MEMO_LOOKBACK),
    rpcRetryAttempts: Math.max(1, parsePositiveInteger(process.env.HARUKA_REWARD_CLAIM_RPC_RETRY_ATTEMPTS, DEFAULT_RPC_RETRY_ATTEMPTS)),
    rpcRetryDelayMs: Math.max(50, parsePositiveInteger(process.env.HARUKA_REWARD_CLAIM_RPC_RETRY_DELAY_MS, DEFAULT_RPC_RETRY_DELAY_MS)),
    memoRpcCheckMode: String(process.env.HARUKA_REWARD_MEMO_RPC_CHECK || 'best-effort').trim().toLowerCase()
  };
}

async function withRpcRetry(label, operation, runtimeConfig) {
  const attempts = Math.max(1, Number(runtimeConfig?.rpcRetryAttempts) || DEFAULT_RPC_RETRY_ATTEMPTS);
  const baseDelayMs = Math.max(50, Number(runtimeConfig?.rpcRetryDelayMs) || DEFAULT_RPC_RETRY_DELAY_MS);

  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableRpcError(error)) {
        throw error;
      }

      const delayMs = baseDelayMs * attempt;
      console.warn(`[haruka-claim] ${label} hit RPC rate limits on attempt ${attempt}/${attempts}. Retrying in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }

  throw lastError || new Error(`HARUKA reward claim RPC retry failed for ${label}.`);
}

function toUiAmount(amountRaw, decimals) {
  const amount = BigInt(amountRaw);
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;
  if (fraction === 0n) {
    return whole.toString();
  }

  return `${whole}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
}

function parseUiAmountToRaw(value, decimals) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw createBadRequestError('Claim amount is required.');
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw createBadRequestError('Claim amount must be a positive numeric string.');
  }

  const [wholePart, fractionPart = ''] = normalized.split('.');
  const fraction = fractionPart.slice(0, decimals).padEnd(decimals, '0');
  return BigInt(wholePart) * (10n ** BigInt(decimals)) + BigInt(fraction || '0');
}

function computeClaimBreakdownRaw(amountRaw, burnRate) {
  const scaledBurnRate = BigInt(Math.round(burnRate * Number(DEFAULT_DECIMAL_SCALE)));
  const burnedRaw = (amountRaw * scaledBurnRate) / DEFAULT_DECIMAL_SCALE;
  const netClaimedRaw = amountRaw - burnedRaw;

  return {
    netClaimedRaw,
    burnedRaw
  };
}

function readRewardTreasuryConfig() {
  const publicKey = String(
    process.env.HARUKA_BUYBACK_TREASURY_PUBLIC_KEY ||
    process.env.HARUKA_TREASURY_WALLET ||
    process.env.HARUKA_X402_PAY_TO ||
    ''
  ).trim();

  const config = {
    enabled: true,
    rpcUrl: String(process.env.HARUKA_UTILITY_RPC_URL || process.env.HARUKA_BUYBACK_RPC_URL || DEFAULT_RPC_URL).trim() || DEFAULT_RPC_URL,
    treasuryPrivateKey: String(process.env.HARUKA_BUYBACK_TREASURY_PRIVATE_KEY || '').trim(),
    treasuryPublicKey: publicKey,
    harukaMint: String(process.env.HARUKA_BUYBACK_HARUKA_MINT || process.env.HARUKA_MINT || DEFAULT_HARUKA_MINT).trim() || DEFAULT_HARUKA_MINT,
    minClaim: parsePositiveNumber(process.env.HARUKA_REWARD_MIN_CLAIM, DEFAULT_MIN_CLAIM),
    burnRate: parsePositiveNumber(process.env.HARUKA_REWARD_CLAIM_BURN_RATE, DEFAULT_BURN_RATE)
  };

  const issues = [];
  if (!config.treasuryPublicKey) {
    issues.push('HARUKA_BUYBACK_TREASURY_PUBLIC_KEY, HARUKA_TREASURY_WALLET, or HARUKA_X402_PAY_TO is required.');
  }
  if (!config.treasuryPrivateKey) {
    issues.push('HARUKA_BUYBACK_TREASURY_PRIVATE_KEY is required for on-chain reward claims.');
  }
  if (config.burnRate < 0 || config.burnRate >= 1) {
    issues.push('HARUKA_REWARD_CLAIM_BURN_RATE must be between 0 and 1.');
  }

  return {
    ...config,
    ready: issues.length === 0,
    issues
  };
}

function buildRewardClaimSnapshot() {
  const config = readRewardTreasuryConfig();
  const rewardState = buildRewardStateSnapshot();
  const rewardLedger = buildRewardLedgerSnapshot();
  const runtime = readRewardClaimRuntimeConfig();
  return {
    rewardClaimEnabled: true,
    rewardClaimReady: config.ready && rewardState.rewardStateReady && (!rewardLedger.rewardLedgerEnabled || rewardLedger.rewardLedgerReady),
    rewardClaimRouteVersion: ROUTE_VERSION,
    rewardClaimRpcUrl: config.rpcUrl,
    rewardClaimTreasuryConfigured: Boolean(config.treasuryPublicKey),
    rewardClaimPrivateKeyConfigured: Boolean(config.treasuryPrivateKey),
    rewardClaimTreasuryPublicKey: config.treasuryPublicKey || null,
    rewardClaimHarukaMint: config.harukaMint,
    rewardClaimMinClaim: config.minClaim,
    rewardClaimBurnRate: config.burnRate,
    rewardClaimMemoLookback: runtime.memoLookback,
    rewardClaimRpcRetryAttempts: runtime.rpcRetryAttempts,
    rewardClaimMemoRpcCheckMode: runtime.memoRpcCheckMode,
    rewardStateReady: rewardState.rewardStateReady,
    rewardLedgerReady: !rewardLedger.rewardLedgerEnabled || rewardLedger.rewardLedgerReady,
    ...(config.issues.length || rewardState.rewardStateIssues
      ? {
          rewardClaimIssues: [
            ...config.issues,
            ...(Array.isArray(rewardState.rewardStateIssues) ? rewardState.rewardStateIssues : [])
          ]
        }
      : {})
    ,
    rewardLedger
  };
}

async function loadSdk() {
  if (!cachedSdkPromise) {
    cachedSdkPromise = Promise.all([
      import('@solana/web3.js'),
      import('@solana/spl-token'),
      import('bs58')
    ])
      .then(([web3Module, splTokenModule, bs58Module]) => {
        const web3 = web3Module.default && web3Module.default.Connection ? web3Module.default : web3Module;
        const splToken =
          splTokenModule.default && splTokenModule.default.TOKEN_PROGRAM_ID ? splTokenModule.default : splTokenModule;
        const bs58 = bs58Module.default || bs58Module;

        if (!web3.Connection || !web3.PublicKey || !splToken.TOKEN_PROGRAM_ID || typeof bs58.decode !== 'function') {
          throw new Error('HARUKA reward claim SDK loader could not resolve required Solana modules.');
        }

        return {
          web3,
          splToken,
          bs58
        };
      })
      .catch((error) => {
        cachedSdkPromise = null;
        throw error;
      });
  }

  return cachedSdkPromise;
}

async function parseSecretKey(secret, sdk) {
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

  return Uint8Array.from(sdk.bs58.decode(raw));
}

async function getTreasuryKeypair(config, sdk) {
  const secretKey = await parseSecretKey(config.treasuryPrivateKey, sdk);
  const keypair = sdk.web3.Keypair.fromSecretKey(secretKey);
  if (config.treasuryPublicKey && keypair.publicKey.toString() !== config.treasuryPublicKey) {
    throw new Error('HARUKA_BUYBACK_TREASURY_PUBLIC_KEY does not match HARUKA_BUYBACK_TREASURY_PRIVATE_KEY.');
  }

  return keypair;
}

async function getTokenProgramIdForMint(connection, mintPublicKey, sdk, runtimeConfig) {
  const cacheKey = mintPublicKey.toString();
  const cached = mintProgramCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const accountInfo = await withRpcRetry(
    `mint-account:${cacheKey}`,
    () => connection.getAccountInfo(mintPublicKey, 'confirmed'),
    runtimeConfig
  );
  if (!accountInfo) {
    throw new Error(`Mint account ${cacheKey} was not found on the configured RPC.`);
  }

  const owner = accountInfo.owner;
  if (!owner.equals(sdk.splToken.TOKEN_PROGRAM_ID) && !owner.equals(sdk.splToken.TOKEN_2022_PROGRAM_ID)) {
    throw new Error(`Mint ${cacheKey} is owned by unsupported token program ${owner.toString()}.`);
  }

  mintProgramCache.set(cacheKey, owner);
  return owner;
}

async function getMintDetails(connection, mintPublicKey, sdk, runtimeConfig) {
  const tokenProgramId = await getTokenProgramIdForMint(connection, mintPublicKey, sdk, runtimeConfig);
  const mint = await withRpcRetry(
    `mint-details:${mintPublicKey.toString()}`,
    () => sdk.splToken.getMint(connection, mintPublicKey, 'confirmed', tokenProgramId),
    runtimeConfig
  );
  return {
    decimals: mint.decimals,
    tokenProgramId
  };
}

async function getTokenAccountState(connection, mintPublicKey, ownerPublicKey, tokenProgramId, sdk, runtimeConfig) {
  const ata = await sdk.splToken.getAssociatedTokenAddress(
    mintPublicKey,
    ownerPublicKey,
    false,
    tokenProgramId,
    sdk.splToken.ASSOCIATED_TOKEN_PROGRAM_ID
  );

  try {
    const account = await withRpcRetry(
      `token-account:${ata.toString()}`,
      () => sdk.splToken.getAccount(connection, ata, 'confirmed', tokenProgramId),
      runtimeConfig
    );
    return {
      ata,
      amountRaw: account.amount
    };
  } catch (error) {
    const name = String(error && error.name ? error.name : '');
    const message = String(error && error.message ? error.message : '');
    if (
      name === 'TokenAccountNotFoundError' ||
      name === 'TokenInvalidAccountOwnerError' ||
      message.includes('Failed to find account') ||
      message.includes('could not find account') ||
      message.includes('Account does not exist')
    ) {
      return {
        ata,
        amountRaw: 0n
      };
    }

    throw error;
  }
}

async function ensureAssociatedTokenAccount(connection, payerKeypair, mintPublicKey, ownerPublicKey, tokenProgramId, sdk, runtimeConfig) {
  const tokenState = await getTokenAccountState(connection, mintPublicKey, ownerPublicKey, tokenProgramId, sdk, runtimeConfig);
  const accountInfo = await withRpcRetry(
    `ata-account:${tokenState.ata.toString()}`,
    () => connection.getAccountInfo(tokenState.ata, 'confirmed'),
    runtimeConfig
  );
  if (accountInfo) {
    return {
      ata: tokenState.ata,
      created: false,
      signature: null
    };
  }

  const instruction = sdk.splToken.createAssociatedTokenAccountInstruction(
    payerKeypair.publicKey,
    tokenState.ata,
    ownerPublicKey,
    mintPublicKey,
    tokenProgramId,
    sdk.splToken.ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const latestBlockhash = await withRpcRetry(
    'ata-create-blockhash',
    () => connection.getLatestBlockhash('confirmed'),
    runtimeConfig
  );
  const transaction = new sdk.web3.Transaction({
    feePayer: payerKeypair.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(instruction);

  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.sign(payerKeypair);
  const serializedTransaction = transaction.serialize();
  const signature = await withRpcRetry(
    'ata-create-send',
    () => connection.sendRawTransaction(serializedTransaction, {
      skipPreflight: false
    }),
    runtimeConfig
  );
  await withRpcRetry(
    'ata-create-confirm',
    () => connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      },
      'confirmed'
    ),
    runtimeConfig
  );

  return {
    ata: tokenState.ata,
    created: true,
    signature
  };
}

async function inspectAssociatedTokenAccount(connection, mintPublicKey, ownerPublicKey, tokenProgramId, sdk, runtimeConfig) {
  const tokenState = await getTokenAccountState(connection, mintPublicKey, ownerPublicKey, tokenProgramId, sdk, runtimeConfig);
  const accountInfo = await withRpcRetry(
    `ata-inspect:${tokenState.ata.toString()}`,
    () => connection.getAccountInfo(tokenState.ata, 'confirmed'),
    runtimeConfig
  );

  return {
    ata: tokenState.ata,
    exists: Boolean(accountInfo)
  };
}

async function sendTransferChecked(connection, payerKeypair, sourceAta, destinationAta, ownerPublicKey, mintPublicKey, amountRaw, decimals, tokenProgramId, memoText, sdk, runtimeConfig) {
  const latestBlockhash = await withRpcRetry(
    'reward-transfer-blockhash',
    () => connection.getLatestBlockhash('confirmed'),
    runtimeConfig
  );
  const memoInstruction = new sdk.web3.TransactionInstruction({
    keys: [],
    programId: new sdk.web3.PublicKey(MEMO_PROGRAM_ID),
    data: Buffer.from(String(memoText || ''), 'utf8')
  });
  const transaction = new sdk.web3.Transaction({
    feePayer: payerKeypair.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(
    sdk.splToken.createTransferCheckedInstruction(
      sourceAta,
      mintPublicKey,
      destinationAta,
      ownerPublicKey,
      amountRaw,
      decimals,
      [],
      tokenProgramId
    ),
    memoInstruction
  );

  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.sign(payerKeypair);
  const serializedTransaction = transaction.serialize();
  const signature = await withRpcRetry(
    'reward-transfer-send',
    () => connection.sendRawTransaction(serializedTransaction, {
      skipPreflight: false
    }),
    runtimeConfig
  );
  await withRpcRetry(
    'reward-transfer-confirm',
    () => connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      },
      'confirmed'
    ),
    runtimeConfig
  );

  return signature;
}

function containsMemoValue(transaction, memoText) {
  if (!transaction) {
    return false;
  }

  const compiledInstructions = transaction.transaction?.message?.instructions || [];
  for (const instruction of compiledInstructions) {
    if (instruction?.program === 'spl-memo' && instruction?.parsed === memoText) {
      return true;
    }
    if (instruction?.programId?.toString?.() === MEMO_PROGRAM_ID) {
      const data = instruction.data;
      if (typeof data === 'string') {
        try {
          const decoded = Buffer.from(data, 'base64').toString('utf8');
          if (decoded === memoText) {
            return true;
          }
        } catch (_error) {}
      }
    }
  }

  const logMessages = Array.isArray(transaction.meta?.logMessages) ? transaction.meta.logMessages : [];
  return logMessages.some((entry) => String(entry || '').includes(memoText));
}

async function wasClaimMemoUsed(connection, treasuryPublicKey, memoText, lookback = DEFAULT_MEMO_LOOKBACK, runtimeConfig) {
  const signatures = await withRpcRetry(
    `memo-signatures:${treasuryPublicKey.toString()}`,
    () => connection.getSignaturesForAddress(treasuryPublicKey, { limit: lookback }, 'confirmed'),
    runtimeConfig
  );
  if (!Array.isArray(signatures) || signatures.length === 0) {
    return false;
  }

  const signatureList = signatures
    .map((entry) => String(entry?.signature || '').trim())
    .filter(Boolean);
  if (!signatureList.length) {
    return false;
  }

  let transactions = [];
  if (typeof connection.getParsedTransactions === 'function') {
    transactions = await withRpcRetry(
      `memo-transactions-batch:${signatureList.length}`,
      () => connection.getParsedTransactions(signatureList, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed'
      }),
      runtimeConfig
    );
  } else {
    transactions = await Promise.all(
      signatureList.map((signature) =>
        withRpcRetry(
          `memo-transaction:${signature}`,
          () => connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          }),
          runtimeConfig
        )
      )
    );
  }

  for (const transaction of transactions) {
    if (containsMemoValue(transaction, memoText)) {
      return true;
    }
  }

  return false;
}

async function burnChecked(connection, payerKeypair, tokenAccountAddress, mintPublicKey, amountRaw, decimals, tokenProgramId, sdk, runtimeConfig) {
  const latestBlockhash = await withRpcRetry(
    'reward-burn-blockhash',
    () => connection.getLatestBlockhash('confirmed'),
    runtimeConfig
  );
  const transaction = new sdk.web3.Transaction({
    feePayer: payerKeypair.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(
    sdk.splToken.createBurnCheckedInstruction(
      tokenAccountAddress,
      mintPublicKey,
      payerKeypair.publicKey,
      amountRaw,
      decimals,
      [],
      tokenProgramId
    )
  );

  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.sign(payerKeypair);
  const serializedTransaction = transaction.serialize();
  const signature = await withRpcRetry(
    'reward-burn-send',
    () => connection.sendRawTransaction(serializedTransaction, {
      skipPreflight: false
    }),
    runtimeConfig
  );
  await withRpcRetry(
    'reward-burn-confirm',
    () => connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
      },
      'confirmed'
    ),
    runtimeConfig
  );

  return signature;
}

function isAuthorizedRewardClaimRequest(_request) {
  return {
    ok: true,
    reason: null
  };
}

function parseRewardClaimRequest(body) {
  const payload = parseBody(body);
  const walletAddress = String(payload.walletAddress || '').trim();
  const amount = String(payload.amount || '').trim();
  const proof = String(payload.proof || '').trim();
  const dryRun = parseBooleanFlag(payload.dryRun);

  if (!walletAddress) {
    throw createBadRequestError('walletAddress is required.');
  }
  if (!amount) {
    throw createBadRequestError('amount is required.');
  }
  if (!proof) {
    throw createBadRequestError('proof is required.');
  }

  return {
    walletAddress,
    amount,
    proof,
    dryRun
  };
}

async function runRewardClaim(options = {}) {
  const config = readRewardTreasuryConfig();
  const rewardStateConfig = readRewardStateConfig();
  const snapshot = buildRewardClaimSnapshot();
  const runtimeConfig = readRewardClaimRuntimeConfig();
  const rewardLedgerSnapshot = snapshot.rewardLedger || buildRewardLedgerSnapshot();
  const ledgerBacked = Boolean(rewardLedgerSnapshot.rewardLedgerEnabled);

  if (!config.ready || !rewardStateConfig.ready) {
    return {
      ok: false,
      executed: false,
      skipped: true,
      statusCode: 503,
      reason: [...config.issues, ...rewardStateConfig.issues].join(' '),
      snapshot
    };
  }

  const sdk = await loadSdk();
  const connection = new sdk.web3.Connection(config.rpcUrl, 'confirmed');
  const treasuryKeypair = await getTreasuryKeypair(config, sdk);
  const treasuryPublicKey = treasuryKeypair.publicKey;
  let playerPublicKey;
  try {
    playerPublicKey = new sdk.web3.PublicKey(options.walletAddress);
  } catch (_error) {
    throw createBadRequestError('walletAddress must be a valid Solana public key.');
  }
  const mintPublicKey = new sdk.web3.PublicKey(config.harukaMint);
  const mintDetails = await getMintDetails(connection, mintPublicKey, sdk, runtimeConfig);
  const now = Date.now();
  let proofState;
  try {
    proofState = parseRewardStateProof(options.proof, options.walletAddress, rewardStateConfig, now);
  } catch (error) {
    throw createBadRequestError(error instanceof Error ? error.message : String(error));
  }
  const ledgerContext = await bootstrapRewardLedgerState({
    walletAddress: options.walletAddress,
    rewardStateConfig,
    fallbackState: proofState,
    fallbackProof: options.proof,
    helpers: {
      createBaseRewardState,
      normalizeRewardState
    },
    now
  });
  const rewardState = ledgerContext.state;
  const claimPreview = buildClaimPreview(rewardState, rewardStateConfig);
  const amountRaw = parseUiAmountToRaw(String(claimPreview.grossClaimed), mintDetails.decimals);
  const requestedAmountRaw = parseUiAmountToRaw(options.amount, mintDetails.decimals);
  const minClaimRaw = parseUiAmountToRaw(String(config.minClaim), mintDetails.decimals);

  if (amountRaw < minClaimRaw) {
    return {
      ok: false,
      executed: false,
      skipped: true,
      statusCode: 400,
      reason: `Claim minimum is ${config.minClaim} $HARUKA.`,
      snapshot
    };
  }

  if (requestedAmountRaw !== amountRaw) {
    return {
      ok: false,
      executed: false,
      skipped: true,
      statusCode: 409,
      reason: 'Reward proof is stale. Refresh the server reward state before claiming again.',
      snapshot,
      state: summarizeRewardState(rewardState, rewardStateConfig, Date.now()),
      proof: createRewardStateProof(rewardState, rewardStateConfig)
    };
  }

  const { netClaimedRaw, burnedRaw } = computeClaimBreakdownRaw(amountRaw, config.burnRate);
  if (netClaimedRaw <= 0n) {
    return {
      ok: false,
      executed: false,
      skipped: true,
      statusCode: 400,
      reason: 'Claim net amount must be greater than zero after burn.',
      snapshot
    };
  }

  const treasuryHarukaState = await getTokenAccountState(
    connection,
    mintPublicKey,
    treasuryPublicKey,
    mintDetails.tokenProgramId,
    sdk,
    runtimeConfig
  );
  if (treasuryHarukaState.amountRaw < amountRaw) {
    return {
      ok: false,
      executed: false,
      skipped: true,
      statusCode: 409,
      reason: 'Treasury HARUKA balance is too low for this claim.',
      snapshot,
      treasury: {
        publicKey: treasuryPublicKey.toString(),
        harukaTokenAccount: treasuryHarukaState.ata.toString(),
        harukaBalanceRaw: treasuryHarukaState.amountRaw.toString(),
        harukaBalanceUi: toUiAmount(treasuryHarukaState.amountRaw, mintDetails.decimals)
      }
    };
  }

  const claimMemo = createClaimMemo(options.walletAddress, rewardState.claimNonce);
  const memoAlreadyUsedInLedger = await hasLedgerClaimMemo(claimMemo);
  if (memoAlreadyUsedInLedger) {
    return {
      ok: false,
      executed: false,
      skipped: true,
      statusCode: 409,
      reason: 'This reward proof was already claimed. Refresh the game state to continue.',
      snapshot,
      state: summarizeRewardState(rewardState, rewardStateConfig, Date.now()),
      proof: createRewardStateProof(rewardState, rewardStateConfig)
    };
  }

  let memoRpcChecked = false;
  let memoRpcCheckSkippedReason = null;
  let memoAlreadyUsed = false;
  try {
    memoAlreadyUsed = await wasClaimMemoUsed(connection, treasuryPublicKey, claimMemo, runtimeConfig.memoLookback, runtimeConfig);
    memoRpcChecked = true;
  } catch (error) {
    if (ledgerBacked && runtimeConfig.memoRpcCheckMode !== 'strict' && isRetryableRpcError(error)) {
      memoRpcCheckSkippedReason = error instanceof Error ? error.message : String(error);
      console.warn(`[haruka-claim] Skipping on-chain memo replay scan because ledger checks are enabled and RPC is rate-limited: ${memoRpcCheckSkippedReason}`);
    } else {
      throw error;
    }
  }

  if (memoAlreadyUsed) {
    return {
      ok: false,
      executed: false,
      skipped: true,
      statusCode: 409,
      reason: 'This reward proof was already claimed. Refresh the game state to continue.',
      snapshot
    };
  }

  const playerAtaState = await inspectAssociatedTokenAccount(
    connection,
    mintPublicKey,
    playerPublicKey,
    mintDetails.tokenProgramId,
    sdk,
    runtimeConfig
  );

  if (options.dryRun) {
    return {
      ok: true,
      executed: false,
      skipped: true,
      reason: 'Dry run only. No claim transaction was submitted.',
      snapshot,
      treasury: {
        publicKey: treasuryPublicKey.toString(),
        harukaTokenAccount: treasuryHarukaState.ata.toString(),
        harukaBalanceRaw: treasuryHarukaState.amountRaw.toString(),
        harukaBalanceUi: toUiAmount(treasuryHarukaState.amountRaw, mintDetails.decimals)
      },
      player: {
        walletAddress: playerPublicKey.toString(),
        harukaTokenAccount: playerAtaState.ata.toString(),
        wouldCreateAta: !playerAtaState.exists
      },
      claim: {
        grossRaw: amountRaw.toString(),
        grossUi: toUiAmount(amountRaw, mintDetails.decimals),
        netRaw: netClaimedRaw.toString(),
        netUi: toUiAmount(netClaimedRaw, mintDetails.decimals),
        burnedRaw: burnedRaw.toString(),
        burnedUi: toUiAmount(burnedRaw, mintDetails.decimals)
      },
      state: summarizeRewardState(rewardState, rewardStateConfig, Date.now()),
      proof: createRewardStateProof(rewardState, rewardStateConfig),
      antiCheat: {
        claimMemo,
        memoLookback: runtimeConfig.memoLookback,
        ledgerBacked,
        memoRpcChecked,
        ...(memoRpcCheckSkippedReason ? { memoRpcCheckSkippedReason } : {})
      }
    };
  }

  const playerAtaResult = playerAtaState.exists
    ? {
        ata: playerAtaState.ata,
        created: false,
        signature: null
      }
    : await ensureAssociatedTokenAccount(
        connection,
        treasuryKeypair,
        mintPublicKey,
        playerPublicKey,
        mintDetails.tokenProgramId,
        sdk,
        runtimeConfig
      );

  const transferSignature = await sendTransferChecked(
    connection,
    treasuryKeypair,
    treasuryHarukaState.ata,
    playerAtaResult.ata,
    treasuryPublicKey,
    mintPublicKey,
    netClaimedRaw,
    mintDetails.decimals,
    mintDetails.tokenProgramId,
    claimMemo,
    sdk,
    runtimeConfig
  );

  let burnSignature = null;
  if (burnedRaw > 0n) {
    burnSignature = await burnChecked(
      connection,
      treasuryKeypair,
      treasuryHarukaState.ata,
      mintPublicKey,
      burnedRaw,
      mintDetails.decimals,
      mintDetails.tokenProgramId,
      sdk,
      runtimeConfig
    );
  }

  const finalTreasuryState = await getTokenAccountState(
    connection,
    mintPublicKey,
    treasuryPublicKey,
    mintDetails.tokenProgramId,
    sdk,
    runtimeConfig
  );
  const settled = applyClaimSettlement(rewardState, rewardStateConfig, {
    now: Date.now(),
    transferSignature,
    burnSignature
  });
  const persisted = await persistRewardLedgerState({
    walletAddress: options.walletAddress,
    rewardStateConfig,
    state: settled.state,
    expectedVersion: ledgerContext.version,
    proof: options.proof,
    helpers: {
      normalizeRewardState
    },
    action: 'claim',
    amountHaruka: Number(claimPreview.grossClaimed),
    claimMemo,
    eventPayload: {
      transferSignature,
      burnSignature: burnSignature || null,
      grossUi: toUiAmount(amountRaw, mintDetails.decimals),
      netUi: toUiAmount(netClaimedRaw, mintDetails.decimals),
      burnedUi: toUiAmount(burnedRaw, mintDetails.decimals)
    },
    now: Date.now()
  });

  return {
    ok: true,
    executed: true,
    skipped: false,
    snapshot,
    treasury: {
      publicKey: treasuryPublicKey.toString(),
      harukaTokenAccount: treasuryHarukaState.ata.toString()
    },
    player: {
      walletAddress: playerPublicKey.toString(),
      harukaTokenAccount: playerAtaResult.ata.toString(),
      ataCreated: playerAtaResult.created,
      ataCreationSignature: playerAtaResult.signature
    },
    claim: {
      grossRaw: amountRaw.toString(),
      grossUi: toUiAmount(amountRaw, mintDetails.decimals),
      netRaw: netClaimedRaw.toString(),
      netUi: toUiAmount(netClaimedRaw, mintDetails.decimals),
      burnedRaw: burnedRaw.toString(),
      burnedUi: toUiAmount(burnedRaw, mintDetails.decimals)
    },
    transfer: {
      signature: transferSignature
    },
    burn: burnSignature ? { signature: burnSignature } : null,
    finalTreasuryBalance: {
      harukaRaw: finalTreasuryState.amountRaw.toString(),
      harukaUi: toUiAmount(finalTreasuryState.amountRaw, mintDetails.decimals)
    },
    proof: createRewardStateProof(persisted.state, rewardStateConfig),
    state: summarizeRewardState(persisted.state, rewardStateConfig, Date.now()),
    antiCheat: {
      claimMemo,
      memoLookback: runtimeConfig.memoLookback,
      ledgerBacked,
      memoRpcChecked,
      ...(memoRpcCheckSkippedReason ? { memoRpcCheckSkippedReason } : {})
    }
  };
}

async function getLatestRewardLedgerClaimState(walletAddress, rewardStateConfig) {
  const latest = await readCurrentRewardLedgerState({
    walletAddress,
    rewardStateConfig,
    helpers: {
      normalizeRewardState
    },
    now: Date.now()
  });

  if (!latest) {
    return null;
  }

  return {
    proof: createRewardStateProof(latest.state, rewardStateConfig),
    state: summarizeRewardState(latest.state, rewardStateConfig, Date.now())
  };
}

module.exports = {
  BAD_REQUEST_ERROR_CODE,
  CONFLICT_ERROR_CODE,
  ROUTE_VERSION,
  buildRewardClaimSnapshot,
  getLatestRewardLedgerClaimState,
  isAuthorizedRewardClaimRequest,
  parseRewardClaimRequest,
  readRewardTreasuryConfig,
  runRewardClaim
};
