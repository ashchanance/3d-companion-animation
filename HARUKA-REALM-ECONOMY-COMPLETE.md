# HARUKA'S REALM — Economy System (Complete Dev Brief)

**Token:** $HARUKA — `9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump`
**Treasury Wallet:** `5o5fW5CYtaYLRwdNoJeXhfajvwX48X1NxvXqtbXmtJHb`
**Initial Reward Pool:** 500,000 $HARUKA
**Blockchain:** Solana Mainnet

---

## 1. SYSTEM OVERVIEW

```
PLAYER CONNECTS WALLET
        ↓
Balance ≥ 1,000 $HARUKA → ACCESS GRANTED
        ↓
FARM GAMEPLAY (plant → grow → harvest)
        ↓
     EARN $HARUKA
     ├── Harvest Rewards (from reward pool)
     ├── Streak Bonuses (daily login rewards)
     ├── Rare Drop Multipliers (lucky harvests)
     └── Marketplace Sales (sell crops to other players)
        ↓
     MARKETPLACE TRADE (player ↔ player)
        ↓
     FEE SPLIT ON EVERY TRADE:
     ├── 60% → Seller
     ├── 30% → Revenue Share Pool → weekly payout to ALL $HARUKA holders
     └── 10% → Platform (6.7% burn 🔥 + 3.3% reward pool refill ♻️)
```

---

## 2. ACCESS GATE

### Requirement
- Connect Solana wallet (Phantom or any Solana wallet adapter)
- Hold minimum **1,000 $HARUKA** in wallet

### Implementation

```javascript
const HARUKA_MINT = "9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump";
const MIN_HOLD = 1000;

async function checkAccess(walletAddress) {
  const balance = await getTokenBalance(walletAddress, HARUKA_MINT);
  return balance >= MIN_HOLD;
}
```

### Gate Screen (shown when balance < 1,000)

```
🔒 Hold at least 1,000 $HARUKA to enter Haruka's Realm

   Current balance: [X] $HARUKA

   [Buy on Pump.fun]   [Connect Different Wallet]
```

---

## 3. REWARD SYSTEM

### 3.1 Base Harvest Rewards

Every harvest gives player $HARUKA from the reward pool.

| Crop | Grow Time | Base Reward | Gold Reward |
|------|-----------|-------------|-------------|
| Carrot | 10s | 5 $HARUKA | 25 Gold |
| Potato | 20s | 12 $HARUKA | 50 Gold |
| Tomato | 35s | 25 $HARUKA | 90 Gold |
| Strawberry | 55s | 50 $HARUKA | 160 Gold |
| Lettuce | 80s | 80 $HARUKA | 240 Gold |
| Pumpkin | 115s | 130 $HARUKA | 380 Gold |

### 3.2 Daily Login Streak Bonus

Player yang login dan harvest setiap hari dapet multiplier yang naik:

| Streak | Bonus | Example (Carrot) |
|--------|-------|-----------------|
| Day 1 | 1.0× (base) | 5 $HARUKA |
| Day 2 | 1.1× | 5.5 → 6 $HARUKA |
| Day 3 | 1.2× | 6 $HARUKA |
| Day 5 | 1.4× | 7 $HARUKA |
| Day 7 | 1.7× (max) | 8.5 → 9 $HARUKA |

- Streak resets kalau player skip 1 hari
- Multiplier applies ke semua harvest di hari itu
- Max multiplier: **1.7×** at day 7+ streak

```javascript
function getStreakMultiplier(consecutiveDays) {
  if (consecutiveDays >= 7) return 1.7;
  if (consecutiveDays >= 5) return 1.4;
  if (consecutiveDays >= 3) return 1.2;
  if (consecutiveDays >= 2) return 1.1;
  return 1.0;
}
```

### 3.3 Lucky Harvest (Rare Drop Multiplier)

Setiap harvest ada chance dapet **Lucky Harvest** — reward dikalikan:

| Event | Chance | Multiplier |
|-------|--------|-----------|
| Normal harvest | 85% | 1× |
| Lucky harvest 🍀 | 12% | 2× reward |
| Super lucky 🌟 | 2.5% | 5× reward |
| Jackpot 💎 | 0.5% | 10× reward |

```javascript
function rollLuckyHarvest() {
  const roll = Math.random();
  if (roll < 0.005) return { type: 'jackpot',     multi: 10, emoji: '💎' };
  if (roll < 0.030) return { type: 'super_lucky',  multi: 5,  emoji: '🌟' };
  if (roll < 0.150) return { type: 'lucky',         multi: 2,  emoji: '🍀' };
  return { type: 'normal', multi: 1, emoji: '' };
}
```

**Example scenario:**
> Player with Day 5 streak harvests Pumpkin and rolls Super Lucky:
> Base: 130 × Streak 1.4× × Lucky 5× = **910 $HARUKA** dari satu harvest!
> Toast: "🌟 SUPER LUCKY! Pumpkin harvest × 5 — 910 $HARUKA!"

### 3.4 Daily Cap (Dynamic)

Cap adjusts based on reward pool health:

| Pool Balance | Daily Cap per Wallet |
|-------------|---------------------|
| > 400,000 | 1,000 $HARUKA |
| 200,000 - 400,000 | 600 $HARUKA |
| 50,000 - 200,000 | 300 $HARUKA |
| 10,000 - 50,000 | 100 $HARUKA |
| < 10,000 | 0 (earn via marketplace only) |

```javascript
async function getDailyCap() {
  const poolBalance = await getTokenBalance(TREASURY_WALLET, HARUKA_MINT);
  if (poolBalance > 400000) return 1000;
  if (poolBalance > 200000) return 600;
  if (poolBalance > 50000)  return 300;
  if (poolBalance > 10000)  return 100;
  return 0;
}
```

### 3.5 Claim Flow

```
Player harvests crops throughout the day
        ↓
Rewards accumulate in game (off-chain counter)
        ↓
Player clicks [Claim Rewards] (min 100 $HARUKA)
        ↓
Backend validates:
  ✓ Harvests are legitimate (server verified grow times)
  ✓ Amount ≤ daily cap
  ✓ Pool has sufficient balance
        ↓
$HARUKA transferred on-chain: treasury → player wallet
        ↓
Transaction signature recorded
```

---

## 4. MARKETPLACE

### How Trading Works

**Seller Flow:**
1. Player has crops in inventory
2. Opens Marketplace tab → selects crop + quantity + price in $HARUKA
3. Listing goes live (visible to all players)

**Buyer Flow:**
1. Browses active listings
2. Clicks Buy → wallet prompts $HARUKA transfer approval
3. On-chain transaction executes

**Settlement (on every trade):**

```
BUYER PAYS: 200 $HARUKA
        ↓
├── 120 $HARUKA (60%) → Seller wallet
├── 60 $HARUKA (30%)  → Revenue Share Pool
└── 20 $HARUKA (10%)  → Platform
    ├── 13.4 $HARUKA (6.7%) → BURN 🔥 (permanent)
    └── 6.6 $HARUKA (3.3%)  → Reward Pool ♻️ (refill)
```

### Marketplace Rules
- Seller sets price freely
- Min listing: 1 crop
- Listings expire after 7 days
- Seller can cancel anytime
- All settlements on-chain via Solana SPL transfer
- Price displayed in $HARUKA

### API Endpoints

```
GET    /api/market/listings                   → all active listings
GET    /api/market/listings?crop=carrot       → filter by crop type
GET    /api/market/listings?sort=price_asc    → sort by price
POST   /api/market/list                       → create new listing
       Body: { wallet, crop, quantity, price_haruka }

POST   /api/market/buy/:listing_id            → buy a listing
       Body: { buyer_wallet, tx_signature }

DELETE /api/market/cancel/:listing_id         → cancel own listing
       Body: { wallet }

GET    /api/market/history/:wallet            → my sales & purchase history
```

---

## 5. REVENUE SHARE

### Concept
30% of all marketplace transaction value flows into a Revenue Share Pool. Every week, this pool is distributed proportionally to ALL $HARUKA holders. No staking required — just hold.

### Weekly Payout Logic

```javascript
async function distributeWeeklyRevenue(weekStart) {
  // 1. Get total revenue share pool for this week
  const poolAmount = await getWeeklyRevenuePool(weekStart);
  if (poolAmount < 1000) return; // min pool to distribute

  // 2. Snapshot all $HARUKA holders
  const holders = await getAllTokenHolders(HARUKA_MINT);

  // 3. Exclude non-eligible wallets
  const EXCLUDE = [
    BURN_ADDRESS,
    TREASURY_WALLET,
    LP_WALLET     // liquidity pool
  ];
  const eligible = holders.filter(h => !EXCLUDE.includes(h.wallet) && h.balance >= 1000);

  // 4. Calculate total eligible supply
  const totalHeld = eligible.reduce((sum, h) => sum + h.balance, 0);

  // 5. Distribute proportionally
  for (const holder of eligible) {
    const share = holder.balance / totalHeld;
    const payout = Math.floor(poolAmount * share);
    if (payout >= 10) { // min payout 10 $HARUKA
      await transferToken(REVENUE_WALLET, holder.wallet, payout);
      await recordPayout(weekStart, holder.wallet, payout);
    }
  }
}
```

### Revenue Dashboard (public page)

```
GET /api/revenue/dashboard

{
  "current_week": {
    "pool_accumulated": 45000,
    "marketplace_volume": 450000,
    "estimated_payout_date": "Sunday 00:00 UTC"
  },
  "last_week": {
    "total_distributed": 38000,
    "holders_paid": 127,
    "avg_payout": 299
  },
  "all_time": {
    "total_distributed": 285000,
    "total_burned": 142000,
    "total_marketplace_volume": 4200000
  }
}
```

---

## 6. BURN MECHANICS

### Active Burns

| Action | Amount Burned | Trigger |
|--------|-------------|---------|
| Marketplace fee (platform cut) | ~6.7% of every trade | Every marketplace transaction |
| Claim processing fee | 2% of claimed amount | Every reward claim |
| Speed boost (skip crop timer) | 500 $HARUKA | Player choice |
| Premium seed purchase | 1,000 - 5,000 $HARUKA | Player choice |
| Farm decoration | 500 - 10,000 $HARUKA | Player choice |

### Burn Implementation

```javascript
// Using SPL Token burn (permanently removes from supply)
import { burn } from '@solana/spl-token';

async function burnHaruka(wallet, amount) {
  const tx = await burn(
    connection,
    payer,
    tokenAccount,    // $HARUKA token account
    HARUKA_MINT,     // mint address
    wallet,          // owner
    amount * (10 ** 6) // adjust for decimals
  );
  return tx;
}
```

---

## 7. COMPLETE DATABASE SCHEMA

```sql
-- ============================================
-- PLAYERS
-- ============================================
CREATE TABLE players (
  wallet_address TEXT PRIMARY KEY,
  gold INTEGER DEFAULT 100,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  unlocked_plots INTEGER DEFAULT 9,
  login_streak INTEGER DEFAULT 0,
  last_login_date DATE,
  total_earned_haruka NUMERIC DEFAULT 0,
  total_burned_haruka NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_played TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PLOTS (farm state)
-- ============================================
CREATE TABLE plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT REFERENCES players(wallet_address) ON DELETE CASCADE,
  plot_index INTEGER NOT NULL,
  crop TEXT,
  planted_at TIMESTAMPTZ,
  UNIQUE(wallet_address, plot_index)
);

-- ============================================
-- INVENTORY (harvested crops)
-- ============================================
CREATE TABLE inventory (
  wallet_address TEXT REFERENCES players(wallet_address) ON DELETE CASCADE,
  crop TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  PRIMARY KEY (wallet_address, crop)
);

-- ============================================
-- UNCLAIMED REWARDS (off-chain accumulator)
-- ============================================
CREATE TABLE unclaimed_rewards (
  wallet_address TEXT PRIMARY KEY REFERENCES players(wallet_address),
  amount NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DAILY CLAIMS (cap tracking)
-- ============================================
CREATE TABLE daily_claims (
  wallet_address TEXT NOT NULL,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_claimed NUMERIC DEFAULT 0,
  claim_count INTEGER DEFAULT 0,
  PRIMARY KEY (wallet_address, claim_date)
);

-- ============================================
-- HARVEST LOG (anti-cheat audit)
-- ============================================
CREATE TABLE harvest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  crop_type TEXT NOT NULL,
  plot_index INTEGER NOT NULL,
  planted_at TIMESTAMPTZ NOT NULL,
  harvested_at TIMESTAMPTZ DEFAULT NOW(),
  base_reward NUMERIC NOT NULL,
  streak_multiplier NUMERIC DEFAULT 1.0,
  lucky_multiplier NUMERIC DEFAULT 1.0,
  lucky_type TEXT DEFAULT 'normal',
  final_reward NUMERIC NOT NULL,
  gold_earned INTEGER NOT NULL
);

-- ============================================
-- CLAIM TRANSACTIONS (on-chain record)
-- ============================================
CREATE TABLE claim_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  tx_signature TEXT NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MARKETPLACE LISTINGS
-- ============================================
CREATE TABLE marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_wallet TEXT NOT NULL REFERENCES players(wallet_address),
  crop_type TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_haruka NUMERIC NOT NULL CHECK (price_haruka > 0),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  buyer_wallet TEXT,
  sold_at TIMESTAMPTZ,
  tx_signature TEXT,
  amount_to_seller NUMERIC DEFAULT 0,
  amount_to_revenue NUMERIC DEFAULT 0,
  amount_burned NUMERIC DEFAULT 0,
  amount_to_pool NUMERIC DEFAULT 0
);

-- ============================================
-- REVENUE SHARE POOL (weekly tracking)
-- ============================================
CREATE TABLE revenue_weeks (
  week_start DATE PRIMARY KEY,
  week_end DATE NOT NULL,
  total_collected NUMERIC DEFAULT 0,
  total_distributed NUMERIC DEFAULT 0,
  holders_paid INTEGER DEFAULT 0,
  status TEXT DEFAULT 'accumulating' CHECK (status IN ('accumulating', 'distributed')),
  distributed_at TIMESTAMPTZ
);

-- ============================================
-- REVENUE PAYOUTS (individual)
-- ============================================
CREATE TABLE revenue_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL REFERENCES revenue_weeks(week_start),
  wallet_address TEXT NOT NULL,
  holder_balance NUMERIC NOT NULL,
  share_percentage NUMERIC NOT NULL,
  payout_amount NUMERIC NOT NULL,
  tx_signature TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BURN LOG
-- ============================================
CREATE TABLE burn_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  tx_signature TEXT,
  burned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_plots_wallet ON plots(wallet_address);
CREATE INDEX idx_harvest_wallet ON harvest_log(wallet_address);
CREATE INDEX idx_claims_date ON daily_claims(claim_date);
CREATE INDEX idx_listings_active ON marketplace_listings(status) WHERE status = 'active';
CREATE INDEX idx_listings_crop ON marketplace_listings(crop_type, status);
CREATE INDEX idx_revenue_payouts_week ON revenue_payouts(week_start);
CREATE INDEX idx_burn_log_date ON burn_log(burned_at);
```

---

## 8. ALL API ENDPOINTS

### Player
```
POST   /api/player/init              → init player on first wallet connect
GET    /api/player/:wallet           → get player data (gold, level, xp, streak, plots)
POST   /api/player/login             → record daily login (update streak)
```

### Farm
```
POST   /api/farm/plant               → plant seed on plot
       Body: { wallet, plot_index, crop }
POST   /api/farm/harvest             → harvest a plot
       Body: { wallet, plot_index }
POST   /api/farm/harvest-all         → harvest all ready plots
       Body: { wallet }
POST   /api/farm/expand              → expand farm (+1 plot, deduct gold)
       Body: { wallet }
GET    /api/farm/state/:wallet       → get all plots + inventory
```

### Rewards
```
GET    /api/rewards/unclaimed/:wallet → get unclaimed $HARUKA amount
GET    /api/rewards/daily/:wallet     → get today's claimed vs daily cap
POST   /api/rewards/claim             → claim $HARUKA to wallet
       Body: { wallet, amount }
       Response: { tx_signature, claimed, remaining_today }
```

### Marketplace
```
GET    /api/market/listings           → all active listings (filterable)
POST   /api/market/list               → create listing
       Body: { wallet, crop, quantity, price_haruka }
POST   /api/market/buy/:listing_id    → buy listing
       Body: { buyer_wallet, tx_signature }
DELETE /api/market/cancel/:listing_id → cancel own listing
GET    /api/market/history/:wallet    → my trade history
```

### Revenue Share
```
GET    /api/revenue/dashboard         → public stats (current week, last week, all-time)
GET    /api/revenue/my/:wallet        → my revenue share history
```

### Shop (in-game Gold economy)
```
POST   /api/shop/sell                 → sell crops for Gold
       Body: { wallet, crop, quantity }
POST   /api/shop/buy-seed             → buy seeds with Gold
       Body: { wallet, crop, quantity }
```

---

## 9. WALLET INTEGRATION

### Required Libraries

```bash
npm install @solana/web3.js @solana/spl-token @solana/wallet-adapter-base @solana/wallet-adapter-phantom
```

### Environment Variables (Railway)

```env
TREASURY_PRIVATE_KEY=<base58_private_key_of_treasury>
HARUKA_MINT=9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump
TREASURY_WALLET=5o5fW5CYtaYLRwdNoJeXhfajvwX48X1NxvXqtbXmtJHb
SOLANA_RPC=https://api.mainnet-beta.solana.com
SUPABASE_URL=<your_supabase_url>
SUPABASE_KEY=<your_supabase_anon_key>
```

⚠️ **CRITICAL:** Treasury private key stored ONLY in Railway env vars. Never in code, never in frontend, never in database, never in git.

### Core Wallet Functions

```javascript
import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress, transfer, burn } from '@solana/spl-token';

const connection = new Connection(process.env.SOLANA_RPC);
const HARUKA_MINT = new PublicKey(process.env.HARUKA_MINT);

// Check $HARUKA balance
async function getHarukaBalance(walletAddress) {
  const wallet = new PublicKey(walletAddress);
  const tokenAccount = await getAssociatedTokenAddress(HARUKA_MINT, wallet);
  try {
    const account = await getAccount(connection, tokenAccount);
    return Number(account.amount) / (10 ** 6); // adjust for decimals
  } catch {
    return 0;
  }
}

// Transfer $HARUKA from treasury to player (reward claim)
async function sendReward(playerWallet, amount) {
  // Load treasury keypair from env
  // Execute SPL transfer
  // Return tx signature
}

// Burn $HARUKA (permanent supply removal)
async function burnTokens(amount) {
  // Execute SPL burn instruction
  // Return tx signature
}

// Marketplace settlement (split transfer)
async function settleMarketplaceTrade(buyerWallet, sellerWallet, totalAmount) {
  const toSeller   = Math.floor(totalAmount * 0.60);
  const toRevenue  = Math.floor(totalAmount * 0.30);
  const toBurn     = Math.floor(totalAmount * 0.067);
  const toPool     = totalAmount - toSeller - toRevenue - toBurn;

  // Execute 3 transfers + 1 burn in single transaction
  // 1. buyer → seller (60%)
  // 2. buyer → revenue wallet (30%)
  // 3. buyer → treasury/pool (3.3%)
  // 4. burn instruction (6.7%)
  // Return tx signature
}
```

---

## 10. ANTI-CHEAT & SECURITY

### Rules (ALL server-side, NEVER trust client)

| Rule | Implementation |
|------|---------------|
| Harvest validation | Server checks: crop planted? grow time elapsed? plot belongs to wallet? |
| Daily claim cap | Database tracks claims per wallet per day, reject over limit |
| Rate limiting | Max 60 API calls / min / wallet |
| Harvest rate limit | Max 20 harvests / hour / wallet |
| Wallet auth | Every API call includes signed message, server verifies signature |
| Transaction audit | Every claim + trade stores tx_signature in database |
| Lucky roll | Server-side ONLY — client never knows drop rates or rolls |
| Streak validation | Server tracks last_login_date, calculates streak |

### Validation Example

```javascript
async function validateHarvest(wallet, plotIndex) {
  // 1. Does this plot belong to this wallet?
  const plot = await getPlot(wallet, plotIndex);
  if (!plot) return { valid: false, error: "Plot not found" };

  // 2. Is there a crop planted?
  if (!plot.crop) return { valid: false, error: "Nothing planted" };

  // 3. Has enough time passed?
  const growTime = CROPS[plot.crop].growSec;
  const elapsed = (Date.now() - new Date(plot.planted_at).getTime()) / 1000;
  if (elapsed < growTime) return { valid: false, error: "Not ready yet" };

  // 4. Rate limit check
  const harvestsThisHour = await countHarvests(wallet, 60); // last 60 min
  if (harvestsThisHour >= 20) return { valid: false, error: "Too many harvests" };

  return { valid: true };
}
```

---

## 11. UI ELEMENTS

### Header Bar
```
[Haruka's Realm]   💰 Gold   🌸 $HARUKA balance   ⭐ Level   🔥 Streak   [wallet...xyz]
```

### Sidebar Tabs
```
[🌱 Seeds]  [📦 Harvest]  [🛒 Market]  [📊 Revenue]
```

### Claim Section (in Harvest tab or separate)
```
🌸 Unclaimed: 285 $HARUKA
📊 Today: 315 / 1,000 claimed
🔥 Streak: Day 5 (1.4× bonus active!)

[Claim Rewards] (min 100 $HARUKA)
```

### Lucky Harvest Notifications
```
Normal:    "Harvested Carrot! +5 $HARUKA"
Lucky 🍀:  "🍀 LUCKY! Harvested Carrot! +10 $HARUKA (2×)"
Super 🌟:  "🌟 SUPER LUCKY! Harvested Pumpkin! +650 $HARUKA (5×)"
Jackpot 💎: "💎 JACKPOT! Harvested Strawberry! +500 $HARUKA (10×)"
```

### Revenue Tab
```
📊 Weekly Revenue Share

This week's pool: 45,000 $HARUKA
Your estimated share: ~360 $HARUKA
Next payout: Sunday 00:00 UTC

Last week received: ✅ 299 $HARUKA

💎 Hold more $HARUKA = bigger weekly share
   No staking needed — just hold in your wallet
```

### Gate Screen (balance < 1,000)
```
🔒 HOLD TO PLAY

Hold at least 1,000 $HARUKA to enter Haruka's Realm
Current balance: [X] $HARUKA

[Buy on Pump.fun]   [Connect Different Wallet]
```

---

## 12. REWARD POOL SUSTAINABILITY

### Inflow vs Outflow Analysis

```
OUTFLOW (worst case):
- 100 active players × 1,000 cap/day = 100,000/day
- Pool (500k) lasts: 5 days

OUTFLOW (realistic — avg player earns ~300/day):
- 50 players × 300/day = 15,000/day
- Pool lasts: 33 days without any refill

INFLOW (marketplace refill — 3.3% of volume):
- At 100k volume/day → 3,300/day refill
- At 500k volume/day → 16,500/day refill (break-even!)
- At 1M volume/day  → 33,000/day refill (pool grows)

DYNAMIC CAP ensures pool never fully drains:
- Pool drops below 50k → cap drops to 300
- Pool drops below 10k → cap drops to 0 (marketplace-only earning)
- Marketplace fees slowly refill pool back up
- Cap automatically increases when pool recovers
```

---

## 13. FULL FLOW DIAGRAM

```
┌──────────────────────────────────────────────────┐
│                PLAYER OPENS GAME                  │
└─────────────────────┬────────────────────────────┘
                      ↓
              [Connect Wallet]
                      ↓
          Balance ≥ 1,000 $HARUKA?
           ↓ YES              ↓ NO
       [GAME LOADS]     ["BUY $HARUKA" screen]
           ↓
    Check login streak → update multiplier
           ↓
   ┌───────────────────────────────────┐
   │   PLANT → GROW → HARVEST LOOP    │
   │                                   │
   │   Every harvest:                  │
   │   +Gold (in-game)                │
   │   +$HARUKA reward (pool)         │
   │     × streak multiplier          │
   │     × lucky roll multiplier      │
   └──────────────┬────────────────────┘
                  ↓
        ┌─────────┴──────────┐
        ↓                    ↓
   [SELL TO SHOP]      [MARKETPLACE]
   = Gold only         = $HARUKA (P2P)
                             ↓
                     Fee split on trade:
                     60% → seller
                     30% → revenue share pool
                     6.7% → burn 🔥
                     3.3% → reward pool ♻️
                             ↓
              ┌──────────────┴──────────────┐
              ↓                             ↓
    [CLAIM REWARDS]              [WEEKLY REVENUE SHARE]
    Player claims                Auto-distributed
    accumulated $HARUKA          to ALL holders
    from harvest rewards         proportional to balance
              ↓                             ↓
         $HARUKA in player wallet
              ↓
    HOLD (earn revenue share)
    or SWAP to SOL (take profit)
```

---

## 14. WHAT MAKES THIS STRONGER THAN KINTARA

| | Kintara | Haruka's Realm |
|---|---|---|
| Emotional Connection | Generic game, no personality | Haruka — voice, memory, Live2D |
| Earning Model | Grind → sell Gold for $KINS | Farm → harvest rewards + P2P marketplace |
| Holder Benefit | Token utility only | **30% revenue share** to all holders weekly |
| Burn System | Basic fee burn | Multi-layer: marketplace burn + premium burns |
| Lucky Factor | None | Lucky harvest multipliers (2×/5×/10×) |
| Retention | Grind fatigue | Streak system + daily cap + lucky excitement |
| AFK Potential | Must be online | Future: agents farm for you |
| Rare Assets | Standard | Future: evolving agents with lineage |
| Difficulty to Copy | Medium | High — Soul Engine + Live2D is unique |

---

## 15. QUICK REFERENCE TABLE

| Parameter | Value |
|-----------|-------|
| Token | $HARUKA |
| CA | `9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump` |
| Treasury | `5o5fW5CYtaYLRwdNoJeXhfajvwX48X1NxvXqtbXmtJHb` |
| Reward Pool | 500,000 $HARUKA |
| Min Hold to Play | 1,000 $HARUKA |
| Daily Reward Cap | Dynamic: 100 - 1,000 based on pool health |
| Min Claim | 100 $HARUKA |
| Claim Processing Fee | 2% burned |
| Streak Max Bonus | 1.7× at Day 7+ |
| Lucky Harvest Chances | 12% (2×), 2.5% (5×), 0.5% (10×) |
| Marketplace Seller Cut | 60% |
| Revenue Share | 30% of trade volume → holders weekly |
| Platform Cut | 10% (6.7% burn + 3.3% pool refill) |
| Revenue Share Payout | Weekly, proportional, no staking |
| Min Revenue Payout | 10 $HARUKA |
| Listing Expiry | 7 days |
| Max Harvests/Hour | 20 per wallet |
| Max API Calls/Min | 60 per wallet |
| Network | Solana Mainnet |
