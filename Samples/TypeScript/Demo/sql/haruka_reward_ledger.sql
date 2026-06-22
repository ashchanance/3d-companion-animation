CREATE TABLE IF NOT EXISTS haruka_reward_ledgers (
  wallet_address TEXT PRIMARY KEY,
  state_json JSONB NOT NULL,
  state_version BIGINT NOT NULL DEFAULT 1,
  last_proof_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS haruka_reward_events (
  id BIGSERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES haruka_reward_ledgers(wallet_address) ON DELETE CASCADE,
  action TEXT NOT NULL,
  claim_memo TEXT,
  amount_haruka NUMERIC(20, 6),
  proof_hash TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS haruka_reward_events_wallet_created_idx
ON haruka_reward_events (wallet_address, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS haruka_reward_events_claim_memo_uidx
ON haruka_reward_events (claim_memo)
WHERE claim_memo IS NOT NULL;
