const crypto = require('crypto');

const ROUTE_VERSION = 'haruka-reward-ledger-2026-06-22-v1';
const LEDGER_TABLE = 'haruka_reward_ledgers';
const EVENTS_TABLE = 'haruka_reward_events';
const CONFLICT_ERROR_CODE = 'HARUKA_REWARD_LEDGER_CONFLICT';

let cachedSqlPromise = null;
let cachedSchemaPromise = null;

function parseBooleanFlag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function stripWrappingQuotes(value) {
  const trimmed = String(value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function createConflictError(message = 'Reward ledger changed on the server. Refresh the game state and try again.') {
  const error = new Error(message);
  error.code = CONFLICT_ERROR_CODE;
  return error;
}

function hashProof(proof) {
  const raw = String(proof || '').trim();
  if (!raw) {
    return null;
  }

  return crypto.createHash('sha256').update(raw).digest('hex');
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  return JSON.parse(JSON.stringify(payload));
}

function parseJsonColumn(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return JSON.parse(value);
  }

  return value;
}

function readRewardLedgerConfig() {
  const databaseUrl = stripWrappingQuotes(process.env.DATABASE_URL || '');
  const enabled = parseBooleanFlag(process.env.HARUKA_REWARD_LEDGER_ENABLED || (databaseUrl ? 'true' : 'false'));
  const autoMigrate = parseBooleanFlag(process.env.HARUKA_REWARD_LEDGER_AUTO_MIGRATE || 'true');
  const issues = [];

  if (enabled && !databaseUrl) {
    issues.push('DATABASE_URL is required when HARUKA_REWARD_LEDGER_ENABLED is true.');
  }

  return {
    databaseUrl,
    enabled,
    autoMigrate,
    ready: issues.length === 0,
    issues
  };
}

async function getSql(config = readRewardLedgerConfig()) {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not configured for the HARUKA reward ledger.');
  }

  if (!cachedSqlPromise) {
    cachedSqlPromise = import('@neondatabase/serverless')
      .then((module) => {
        const sdk = module.default && module.default.neon ? module.default : module;
        if (typeof sdk.neon !== 'function') {
          throw new Error('Neon serverless SDK could not be initialized.');
        }

        return sdk.neon(config.databaseUrl);
      })
      .catch((error) => {
        cachedSqlPromise = null;
        throw error;
      });
  }

  return cachedSqlPromise;
}

async function ensureRewardLedgerSchema(config = readRewardLedgerConfig()) {
  if (!config.enabled || !config.ready || !config.autoMigrate) {
    return false;
  }

  if (!cachedSchemaPromise) {
    cachedSchemaPromise = (async () => {
      const sql = await getSql(config);
      await sql.transaction([
        sql`
          CREATE TABLE IF NOT EXISTS haruka_reward_ledgers (
            wallet_address TEXT PRIMARY KEY,
            state_json JSONB NOT NULL,
            state_version BIGINT NOT NULL DEFAULT 1,
            last_proof_hash TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `,
        sql`
          CREATE TABLE IF NOT EXISTS haruka_reward_events (
            id BIGSERIAL PRIMARY KEY,
            wallet_address TEXT NOT NULL REFERENCES haruka_reward_ledgers(wallet_address) ON DELETE CASCADE,
            action TEXT NOT NULL,
            claim_memo TEXT,
            amount_haruka NUMERIC(20, 6),
            proof_hash TEXT,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `,
        sql`
          CREATE INDEX IF NOT EXISTS haruka_reward_events_wallet_created_idx
          ON haruka_reward_events (wallet_address, created_at DESC)
        `,
        sql`
          CREATE UNIQUE INDEX IF NOT EXISTS haruka_reward_events_claim_memo_uidx
          ON haruka_reward_events (claim_memo)
          WHERE claim_memo IS NOT NULL
        `
      ]);
      return true;
    })().catch((error) => {
      cachedSchemaPromise = null;
      throw error;
    });
  }

  return cachedSchemaPromise;
}

function buildRewardLedgerSnapshot() {
  const config = readRewardLedgerConfig();
  return {
    rewardLedgerEnabled: config.enabled,
    rewardLedgerReady: config.enabled && config.ready,
    rewardLedgerRouteVersion: ROUTE_VERSION,
    rewardLedgerAutoMigrate: config.autoMigrate,
    rewardLedgerUsesDatabaseUrl: Boolean(config.databaseUrl),
    rewardLedgerTable: LEDGER_TABLE,
    rewardLedgerEventsTable: EVENTS_TABLE,
    ...(config.issues.length ? { rewardLedgerIssues: config.issues } : {})
  };
}

function mapLedgerRow(row, rewardStateConfig, helpers, now = Date.now()) {
  const rawState = parseJsonColumn(row.state_json);
  const state = helpers.normalizeRewardState(rawState || {}, rewardStateConfig, now);

  return {
    walletAddress: String(row.wallet_address || state.walletAddress || '').trim(),
    state,
    version: Math.max(1, Number(row.state_version) || 1),
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
    lastProofHash: row.last_proof_hash || null
  };
}

async function selectLedgerRow(sql, walletAddress) {
  const rows = await sql`
    SELECT wallet_address, state_json, state_version, last_proof_hash, created_at, updated_at
    FROM haruka_reward_ledgers
    WHERE wallet_address = ${walletAddress}
    LIMIT 1
  `;

  return rows[0] || null;
}

async function bootstrapRewardLedgerState({
  walletAddress,
  rewardStateConfig,
  fallbackState,
  fallbackProof,
  helpers,
  now = Date.now()
}) {
  const config = readRewardLedgerConfig();
  if (!config.enabled) {
    return {
      state: helpers.normalizeRewardState(
        fallbackState || helpers.createBaseRewardState(walletAddress, rewardStateConfig, now),
        rewardStateConfig,
        now
      ),
      version: 0,
      source: fallbackState ? 'proof' : 'base',
      persisted: false
    };
  }

  if (!config.ready) {
    throw new Error(config.issues.join(' '));
  }

  await ensureRewardLedgerSchema(config);
  const sql = await getSql(config);
  const existingRow = await selectLedgerRow(sql, walletAddress);
  if (existingRow) {
    return {
      ...mapLedgerRow(existingRow, rewardStateConfig, helpers, now),
      source: 'database',
      persisted: true
    };
  }

  const normalizedState = helpers.normalizeRewardState(
    fallbackState || helpers.createBaseRewardState(walletAddress, rewardStateConfig, now),
    rewardStateConfig,
    now
  );
  const stateJson = JSON.stringify(normalizedState);
  const proofHash = hashProof(fallbackProof);

  const insertedRows = await sql`
    INSERT INTO haruka_reward_ledgers (wallet_address, state_json, state_version, last_proof_hash)
    VALUES (${walletAddress}, ${stateJson}::jsonb, 1, ${proofHash})
    ON CONFLICT (wallet_address) DO NOTHING
    RETURNING wallet_address, state_json, state_version, last_proof_hash, created_at, updated_at
  `;

  const insertedRow = insertedRows[0] || (await selectLedgerRow(sql, walletAddress));
  if (!insertedRow) {
    throw new Error('HARUKA reward ledger bootstrap failed to create a row.');
  }

  await sql`
    INSERT INTO haruka_reward_events (wallet_address, action, proof_hash, payload)
    VALUES (
      ${walletAddress},
      ${fallbackProof ? 'bootstrap_from_proof' : 'bootstrap_from_base'},
      ${proofHash},
      ${JSON.stringify({ stateVersion: 1 })}::jsonb
    )
  `;

  return {
    ...mapLedgerRow(insertedRow, rewardStateConfig, helpers, now),
    source: fallbackProof ? 'bootstrap-proof' : 'bootstrap-base',
    persisted: true
  };
}

async function persistRewardLedgerState({
  walletAddress,
  rewardStateConfig,
  state,
  expectedVersion,
  proof,
  helpers,
  action,
  amountHaruka = null,
  claimMemo = null,
  eventPayload = {},
  now = Date.now()
}) {
  const config = readRewardLedgerConfig();
  if (!config.enabled) {
    return {
      state: helpers.normalizeRewardState(state, rewardStateConfig, now),
      version: expectedVersion || 0,
      persisted: false
    };
  }

  if (!config.ready) {
    throw new Error(config.issues.join(' '));
  }

  await ensureRewardLedgerSchema(config);
  const sql = await getSql(config);
  const normalizedState = helpers.normalizeRewardState(state, rewardStateConfig, now);
  const proofHash = hashProof(proof);
  const stateJson = JSON.stringify(normalizedState);
  const safePayload = normalizePayload(eventPayload);

  const updateQuery = sql`
    UPDATE haruka_reward_ledgers
    SET
      state_json = ${stateJson}::jsonb,
      state_version = state_version + 1,
      last_proof_hash = ${proofHash},
      updated_at = NOW()
    WHERE wallet_address = ${walletAddress}
      AND state_version = ${Math.max(1, Number(expectedVersion) || 1)}
    RETURNING wallet_address, state_json, state_version, last_proof_hash, created_at, updated_at
  `;

  const queries = [updateQuery];
  if (action) {
    queries.push(sql`
      INSERT INTO haruka_reward_events (
        wallet_address,
        action,
        claim_memo,
        amount_haruka,
        proof_hash,
        payload
      )
      VALUES (
        ${walletAddress},
        ${action},
        ${claimMemo},
        ${amountHaruka},
        ${proofHash},
        ${JSON.stringify(safePayload)}::jsonb
      )
      RETURNING id
    `);
  }

  const results = await sql.transaction(queries);
  const updatedRows = results[0];
  const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : null;
  if (!updatedRow) {
    throw createConflictError();
  }

  return {
    ...mapLedgerRow(updatedRow, rewardStateConfig, helpers, now),
    persisted: true
  };
}

async function readCurrentRewardLedgerState({ walletAddress, rewardStateConfig, helpers, now = Date.now() }) {
  const config = readRewardLedgerConfig();
  if (!config.enabled) {
    return null;
  }

  if (!config.ready) {
    throw new Error(config.issues.join(' '));
  }

  await ensureRewardLedgerSchema(config);
  const sql = await getSql(config);
  const row = await selectLedgerRow(sql, walletAddress);
  if (!row) {
    return null;
  }

  return {
    ...mapLedgerRow(row, rewardStateConfig, helpers, now),
    persisted: true
  };
}

async function hasLedgerClaimMemo(claimMemo) {
  const memo = String(claimMemo || '').trim();
  const config = readRewardLedgerConfig();
  if (!config.enabled || !memo) {
    return false;
  }

  if (!config.ready) {
    throw new Error(config.issues.join(' '));
  }

  await ensureRewardLedgerSchema(config);
  const sql = await getSql(config);
  const rows = await sql`
    SELECT claim_memo
    FROM haruka_reward_events
    WHERE claim_memo = ${memo}
    LIMIT 1
  `;

  return rows.length > 0;
}

module.exports = {
  CONFLICT_ERROR_CODE,
  ROUTE_VERSION,
  bootstrapRewardLedgerState,
  buildRewardLedgerSnapshot,
  createConflictError,
  ensureRewardLedgerSchema,
  hasLedgerClaimMemo,
  persistRewardLedgerState,
  readCurrentRewardLedgerState,
  readRewardLedgerConfig
};
