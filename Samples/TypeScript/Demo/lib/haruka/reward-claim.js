const ROUTE_VERSION = 'api-haruka-reward-claim-2026-06-22-v1';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const DEFAULT_HARUKA_MINT = '9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump';
const DEFAULT_BURN_RATE = 0.02;
const DEFAULT_MIN_CLAIM = 100;
const DEFAULT_DECIMAL_SCALE = 1000000n;
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const DEFAULT_MEMO_LOOKBACK = 250;

const {
  applyClaimSettlement,
  buildClaimPreview,
  buildRewardStateSnapshot,
  createClaimMemo,
  createRewardStateProof,
  parseRewardStateProof,
  readRewardStateConfig,
  summarizeRewardState
} = require('./reward-state.js');

let cachedSdkPromise = null;
const mintProgramCache = new Map();

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
    throw new Error('Claim amount is required.');
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Claim amount must be a positive numeric string.');
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
  return {
    rewardClaimEnabled: true,
    rewardClaimReady: config.ready && rewardState.rewardStateReady,
    rewardClaimRouteVersion: ROUTE_VERSION,
    rewardClaimRpcUrl: config.rpcUrl,
    rewardClaimTreasuryConfigured: Boolean(config.treasuryPublicKey),
    rewardClaimPrivateKeyConfigured: Boolean(config.treasuryPrivateKey),
    rewardClaimTreasuryPublicKey: config.treasuryPublicKey || null,
    rewardClaimHarukaMint: config.harukaMint,
    rewardClaimMinClaim: config.minClaim,
    rewardClaimBurnRate: config.burnRate,
    rewardStateReady: rewardState.rewardStateReady,
    ...(config.issues.length || rewardState.rewardStateIssues
      ? {
          rewardClaimIssues: [
            ...config.issues,
            ...(Array.isArray(rewardState.rewardStateIssues) ? rewardState.rewardStateIssues : [])
          ]
        }
      : {})
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

async function getTokenProgramIdForMint(connection, mintPublicKey, sdk) {
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
  if (!owner.equals(sdk.splToken.TOKEN_PROGRAM_ID) && !owner.equals(sdk.splToken.TOKEN_2022_PROGRAM_ID)) {
    throw new Error(`Mint ${cacheKey} is owned by unsupported token program ${owner.toString()}.`);
  }

  mintProgramCache.set(cacheKey, owner);
  return owner;
}

async function getMintDetails(connection, mintPublicKey, sdk) {
  const tokenProgramId = await getTokenProgramIdForMint(connection, mintPublicKey, sdk);
  const mint = await sdk.splToken.getMint(connection, mintPublicKey, 'confirmed', tokenProgramId);
  return {
    decimals: mint.decimals,
    tokenProgramId
  };
}

async function getTokenAccountState(connection, mintPublicKey, ownerPublicKey, tokenProgramId, sdk) {
  const ata = await sdk.splToken.getAssociatedTokenAddress(
    mintPublicKey,
    ownerPublicKey,
    false,
    tokenProgramId,
    sdk.splToken.ASSOCIATED_TOKEN_PROGRAM_ID
  );

  try {
    const account = await sdk.splToken.getAccount(connection, ata, 'confirmed', tokenProgramId);
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

async function ensureAssociatedTokenAccount(connection, payerKeypair, mintPublicKey, ownerPublicKey, tokenProgramId, sdk) {
  const tokenState = await getTokenAccountState(connection, mintPublicKey, ownerPublicKey, tokenProgramId, sdk);
  const accountInfo = await connection.getAccountInfo(tokenState.ata, 'confirmed');
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

  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  const transaction = new sdk.web3.Transaction({
    feePayer: payerKeypair.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
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

async function inspectAssociatedTokenAccount(connection, mintPublicKey, ownerPublicKey, tokenProgramId, sdk) {
  const tokenState = await getTokenAccountState(connection, mintPublicKey, ownerPublicKey, tokenProgramId, sdk);
  const accountInfo = await connection.getAccountInfo(tokenState.ata, 'confirmed');

  return {
    ata: tokenState.ata,
    exists: Boolean(accountInfo)
  };
}

async function sendTransferChecked(connection, payerKeypair, sourceAta, destinationAta, ownerPublicKey, mintPublicKey, amountRaw, decimals, tokenProgramId, memoText, sdk) {
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
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

async function wasClaimMemoUsed(connection, treasuryPublicKey, memoText, lookback = DEFAULT_MEMO_LOOKBACK) {
  const signatures = await connection.getSignaturesForAddress(treasuryPublicKey, { limit: lookback }, 'confirmed');
  for (const entry of signatures) {
    const transaction = await connection.getParsedTransaction(entry.signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });
    if (containsMemoValue(transaction, memoText)) {
      return true;
    }
  }

  return false;
}

async function burnChecked(connection, payerKeypair, tokenAccountAddress, mintPublicKey, amountRaw, decimals, tokenProgramId, sdk) {
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
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
    throw new Error('walletAddress is required.');
  }
  if (!amount) {
    throw new Error('amount is required.');
  }
  if (!proof) {
    throw new Error('proof is required.');
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
  const playerPublicKey = new sdk.web3.PublicKey(options.walletAddress);
  const mintPublicKey = new sdk.web3.PublicKey(config.harukaMint);
  const mintDetails = await getMintDetails(connection, mintPublicKey, sdk);
  const rewardState = parseRewardStateProof(options.proof, options.walletAddress, rewardStateConfig, Date.now());
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

  const treasuryHarukaState = await getTokenAccountState(connection, mintPublicKey, treasuryPublicKey, mintDetails.tokenProgramId, sdk);
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
  const memoAlreadyUsed = await wasClaimMemoUsed(connection, treasuryPublicKey, claimMemo);
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
    sdk
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
        memoLookback: DEFAULT_MEMO_LOOKBACK
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
        sdk
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
    sdk
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
      sdk
    );
  }

  const finalTreasuryState = await getTokenAccountState(connection, mintPublicKey, treasuryPublicKey, mintDetails.tokenProgramId, sdk);
  const settled = applyClaimSettlement(rewardState, rewardStateConfig, {
    now: Date.now(),
    transferSignature,
    burnSignature
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
    proof: createRewardStateProof(settled.state, rewardStateConfig),
    state: summarizeRewardState(settled.state, rewardStateConfig, Date.now()),
    antiCheat: {
      claimMemo,
      memoLookback: DEFAULT_MEMO_LOOKBACK
    }
  };
}

module.exports = {
  ROUTE_VERSION,
  buildRewardClaimSnapshot,
  isAuthorizedRewardClaimRequest,
  parseRewardClaimRequest,
  readRewardTreasuryConfig,
  runRewardClaim
};
