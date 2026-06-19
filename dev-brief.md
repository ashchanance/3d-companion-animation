# HARUKA'S REALM — Farm Game Dev Brief

**Project:** Click-based farm management game
**Target:** Embed into `harukacompanion.tech/game`
**Status:** Playable demo ready, single-player MVP

---

## 1. WHAT YOU'RE BUILDING

A click-based farm game where players:
- Plant seeds on plots
- Wait for crops to grow through 5 visual stages
- Harvest when ready
- Sell harvested crops at shop for Gold
- Use Gold to expand farm
- Earn XP → level up → unlock new crop types

**Vibe:** Casual, satisfying, FarmVille-style. Designed for short check-in sessions throughout the day.

**Asset pack:** Tiny Wonder Farm (already sent to dev — pixel art 16×16 sprite-based).

---

## 2. WHAT'S ALREADY BUILT (PLAYABLE DEMO)

The file `haruka-realm-farm.html` is a **fully playable single-file demo**:
- Open in any browser → it works
- All game mechanics implemented
- All sprites from Tiny Wonder Farm packed in (base64)
- Progress auto-saves to `localStorage`
- Mobile responsive
- ~68 KB total

**Use this as your reference implementation.** Logic, balancing, UI styling — all working. Your job is mostly: integrate, replace localStorage with real database, polish.

---

## 3. CORE GAMEPLAY LOOP

```
1. Player selects seed from sidebar
2. Player clicks empty plot → seed planted (gold deducted)
3. Crop grows visually through 5 stages over X seconds
4. Plot pulses gold when ready → player clicks to harvest
5. Harvested crop goes to inventory
6. Player switches to Harvest tab → sells for gold
7. Gold accumulates → expand farm or buy expensive seeds
8. Harvesting awards XP → level up → unlock new crop types
```

---

## 4. GAME CONFIG (BALANCED)

### Crops (6 types)

| Crop | Unlock Lvl | Seed Cost | Grow Time | Sell Price | Profit | XP |
|------|-----------|-----------|-----------|------------|--------|-----|
| Carrot | 1 | 10 💰 | 10s | 25 💰 | +15 | 5 |
| Potato | 1 | 20 💰 | 20s | 50 💰 | +30 | 10 |
| Tomato | 2 | 35 💰 | 35s | 90 💰 | +55 | 18 |
| Strawberry | 3 | 60 💰 | 55s | 160 💰 | +100 | 30 |
| Lettuce | 4 | 90 💰 | 80s | 240 💰 | +150 | 48 |
| Pumpkin | 5 | 140 💰 | 115s | 380 💰 | +240 | 75 |

**Demo note:** Growth times above are demo values (10s–115s). For production, multiply ×10 for casual pacing (1.6 min – 19 min), or tune based on player testing.

### Level XP Table

| Level | XP Required |
|-------|-------------|
| 1 → 2 | 50 |
| 2 → 3 | 150 |
| 3 → 4 | 320 |
| 4 → 5 | 560 |
| 5 → 6 | 900 |
| 6 → 7 | 1350 |
| 7 → 8 | 1900 |
| 8 → 9 | 2600 |
| 9 → 10 | 3500 |
| 10 (max) | 4600 |

### Farm Expansion

- Start: 9 plots (3×3 area within a 5×5 grid)
- Max: 25 plots (full 5×5)
- Cost to add 1 plot: `500 + (current_plots - 9) × 250`
- Example: 1st expansion = 500g, 2nd = 750g, … 16th = 4250g

### Starting Resources
- Gold: 100
- Level: 1
- Unlocked crops: Carrot, Potato

---

## 5. ASSET MAPPING

The demo HTML already has this mapping baked in, but for reference:

### `plants free.png` (80×96, grid 5 cols × 6 rows of 16×16)

Each ROW is one crop's 5 growth stages (col 0 = just planted, col 4 = ready to harvest):

| Row | Crop |
|-----|------|
| 0 | Pumpkin |
| 1 | Strawberry |
| 2 | Carrot |
| 3 | Potato |
| 4 | Tomato |
| 5 | Lettuce/Wheat |

### `items free.png` (80×48, grid 5 cols × 3 rows of 16×16)

| Row | Use |
|-----|-----|
| 0 | Harvested items (pumpkin, potato, carrot, tomato, lettuce in cols 0–4) |
| 1 | Seed bag icons (col mapping per CROPS config) |
| 2 | Extras (milk, leaves, flower) — unused in MVP |

### `spring farm tilemap.png`, `farm objects free.png`, `furniture free.png`
Currently used as background ambiance only. Available for Phase 2 features (decoration, indoor area).

### `characters/main character/`
- `portrait female.png` (64×64) — used in intro modal
- `walk and idle.png` (192×72) — available for future character movement feature

---

## 6. INTEGRATION INTO WEB HARUKA

### Step 1 — Embed the page

Add route `/game` to existing web Haruka:

```
harukacompanion.tech/
└── game/
    └── index.html   ← copy haruka-realm-farm.html here
```

The Coming Soon page that's already deployed can either redirect to `/game` once ready, or `/game` becomes the new content for that nav link.

### Step 2 — Match visual style with web Haruka

Demo uses warm browns/yellows (`#fff7e0`, `#d97706`, `#4a3017`). If web Haruka has different brand colors, tweak the CSS variables in the `<style>` block. Spritework stays as-is.

### Step 3 — (Optional) Connect to wallet

Demo runs without wallet — anyone can play. If you want token-gate:
- Check $HARUKA balance on page load
- If holder → show game
- If not → show "Hold $HARUKA to play" CTA

Keep it ungated initially to maximize plays / virality.

---

## 7. PERSISTENCE — PHASE 1 vs PHASE 2

### Phase 1 (current demo state)
- Save state in browser `localStorage`
- Pros: zero backend, free, instant
- Cons: progress is per-device, lost if user clears browser, no marketplace possible

### Phase 2 (when ready for marketplace)
- Migrate save state to Supabase (or similar)
- Schema below
- Enables: cross-device play, leaderboards, $HARUKA marketplace, anti-cheat

### Supabase Schema (Phase 2)

```sql
CREATE TABLE players (
  wallet_address TEXT PRIMARY KEY,
  gold INTEGER DEFAULT 100,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  unlocked_plots INTEGER DEFAULT 9,
  selected_seed TEXT DEFAULT 'carrot',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_played TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT REFERENCES players,
  plot_index INTEGER NOT NULL,
  crop TEXT,
  planted_at TIMESTAMPTZ,
  UNIQUE(wallet_address, plot_index)
);

CREATE TABLE inventory (
  wallet_address TEXT REFERENCES players,
  crop TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  PRIMARY KEY (wallet_address, crop)
);
```

**Anti-cheat in Phase 2:** Server validates grow timing (`now - planted_at >= growSec`) before allowing harvest. Never trust client-side reward calculation.

---

## 8. KNOWN LIMITATIONS / FUTURE WORK

**Phase 1 (now) — single-player core:**
- ✅ Plant, grow, harvest, sell loop
- ✅ 6 crops, level progression, farm expansion
- ✅ localStorage persistence
- ❌ No multiplayer
- ❌ No $HARUKA economy
- ❌ No leaderboard

**Phase 2 (after Phase 1 proves fun):**
- Cross-device sync via Supabase
- Wallet integration
- **Marketplace** — players trade harvested crops for $HARUKA
- **Tier system** — hold more $HARUKA → bigger starting farm / better crops
- **Burn mechanic** — fast-forward growth, premium decorations, exclusive seeds

**Phase 3 (full vision):**
- Decorate farm with furniture (`furniture free.png` already in pack)
- Animated character moving around (`walk and idle.png` already in pack)
- Indoor area (`farm inside free.png` from full asset pack)
- Seasonal events, limited-time crops
- Guilds / friend visits

---

## 9. DEV CHECKLIST

**Phase 1 — Single Player Embed (3-5 hari)**

- [ ] Copy `haruka-realm-farm.html` to `/game/index.html` di web Haruka
- [ ] Tambah nav link "Game" → arahkan ke `/game`
- [ ] Test di desktop + mobile (Chrome, Safari, Firefox)
- [ ] Adjust colors/fonts kalau perlu sync sama web Haruka brand
- [ ] (Optional) Tambah analytics: track plays, daily active players, retention
- [ ] Deploy → announce di Twitter & Telegram

**Phase 2 — Persistence & Marketplace (timeline depend on Phase 1 reception)**

- [ ] Setup Supabase (free tier cukup awal)
- [ ] Implement schema dari section 7
- [ ] Replace `localStorage` calls dengan Supabase API calls
- [ ] Add wallet connect (pakai adapter yang udah ada di web Haruka)
- [ ] Server-side validation untuk anti-cheat
- [ ] Build marketplace UI: list crops for $HARUKA, buy from others
- [ ] Integrate Solana transfer logic (5% fee, 2.5% burn)
- [ ] Test end-to-end with real wallets
- [ ] Tunemics balancing kalau perlu

---

## 10. HOW CLAUDE (BIX'S AI ASSISTANT) CAN HELP

Anytime dev stuck atau Bix mau iterate:

**Bix can ask Claude to:**
- Tweak balancing numbers (sell prices, grow times, XP curve)
- Add new crop types or features
- Generate marketing content (X posts, Telegram announcements)
- Design Phase 2 marketplace logic
- Debug code errors (just paste error + relevant code)
- Generate sprite mapping for additional asset packs

**Dev workflow:**
1. Implement Phase 1 with the provided HTML demo
2. Show Bix the live version on web Haruka
3. Collect player feedback for 1-2 weeks
4. Bring feedback to Bix → Bix consult with Claude → iterate
5. Plan Phase 2 with concrete data on what worked

---

## 11. FILES IN THIS DELIVERY

| File | Purpose |
|------|---------|
| `haruka-realm-farm.html` | **Playable game** — single file, self-contained, ready to embed |
| `dev-brief.md` (this file) | Complete spec, balancing, asset mapping, integration guide |

That's it. The demo file IS the implementation. Read this brief, open the HTML, play it, then integrate.
