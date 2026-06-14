# HARUKA - Kintara Gaming Companion Brief

---

## OVERVIEW

Haruka akan menjadi AI companion yang spesifik untuk game Kintara.
Dia tidak hanya "lihat screenshot" - dia benar-benar ngerti game ini
dan bisa guide, comment, dan react secara natural ke gameplay user.

Primary recommendation:
- Browser extension becomes the gaming companion surface
- HARUKA web app remains the core runtime, soul engine, voice, and settings source of truth
- Extension only handles tab detection, lightweight overlay UI, and frame/context capture

This should be built as a hybrid product, not a full extension-only rewrite.

1. User opens Kintara in browser
2. HARUKA extension detects supported tab
3. Extension starts Kintara companion mode
4. Extension captures frames or tab snapshots on an interval
5. Extension sends structured game context into HARUKA runtime
6. HARUKA runtime decides whether to speak, react, warn, or stay quiet

---

## PART 0 - RECOMMENDED ARCHITECTURE (HYBRID EXTENSION)

### Why extension is the better surface

- Feels native to gameplay because Haruka can live on top of the Kintara tab
- Better UX than forcing user to switch back to the HARUKA page
- Easier to add per-site activation, start/stop controls, compact overlay, and side panel
- Better long-term fit for game-specific companions beyond Kintara

### Why HARUKA web runtime should stay the core

- Existing HARUKA chat route, soul prompt flow, settings, and voice runtime already live in this repo
- Existing OpenSouls / provider / Character Card logic should remain the source of truth
- Avoid duplicating AI runtime, memory logic, and provider config inside the extension
- Easier to maintain one backend contract than splitting personality logic across two apps

### Extension responsibility split

**Browser extension**
- Detect Kintara tab or allowed hostnames
- Show popup or side panel to activate Kintara Gaming Mode
- Capture frames from the active tab
- Send frame analysis requests and structured context to HARUKA runtime
- Render small overlay reactions without blocking gameplay

**HARUKA runtime in this repo**
- Own soul identity, profile bias, and response rules
- Own Kintara knowledge and game-specific prompt overlays
- Own decision logic for when Haruka should speak or stay quiet
- Own TTS / voice output and final response generation

### Recommended extension components

**1. Popup**
- Quick toggle: Start Kintara Mode / Stop Kintara Mode
- Shows current tab support status
- Lets user choose compact overlay vs side panel

**2. Content script**
- Runs only on supported Kintara pages
- Anchors a small overlay bubble on top of the game tab
- Receives reactions from background worker
- Must stay visually light and non-intrusive

**3. Background service worker**
- Orchestrates capture loop
- Manages alarms, timing, throttling, and tab state
- Sends frame/context payloads to HARUKA runtime

**4. Optional side panel**
- Better for users who want richer companion presence
- Can show latest realm, activity, danger level, and recent Haruka comments

### Recommended runtime contract addition

Do not inject fake `[SYSTEM]` chat messages from the extension.
Instead, add structured fields to the HARUKA request such as:

```ts
source: 'gaming-companion'
selectedGame: 'kintara'
gameContext: {
  realm: 'Whisperwood',
  activity: 'Chopping trees',
  health: 'High',
  danger: 'None',
  notableObjects: ['trees', 'pond', 'other player'],
  shouldInterrupt: false
}
```

This is cleaner than stuffing game state into regular chat history.

---

## PART 1 - KINTARA KNOWLEDGE BASE
### (Masukkan ke game-specific prompt overlay / soul prompt module)

```markdown
## Kintara Gaming Knowledge

You are watching the user play Kintara - a browser-based isometric MMO on Solana.
You know this game deeply. Use this knowledge to guide and react naturally.

---

### ABOUT KINTARA
- Browser-based isometric MMO on Solana
- Player needs 1,000 $KINS in wallet to play
- Movement: click ground to walk, character paths around obstacles
- Everything saves automatically: inventory, gold, skills, quests, structures

---

### REALMS & MAPS

**Mainland** - Main hub. Safe zone. Where player spawns.
Key landmarks:
- Plaza Fountain (center) - stand near it to heal quickly
- Bank building - deposit/withdraw items (only works here)
- Marketplace building - open marketplace UI from anywhere via HUD
- North portal -> Wilderness
- South portal -> Whisperwood
- East portal -> The Pond
- Arena plaza (northeast) -> Arena scene
- Mine entrance -> interior mining area (rocks + coal)
- Armory - safe combat practice
- Spinner Wheel - near casino (columns 25-26)

**Wilderness** - Dangerous. North of Mainland. PvP enabled outside safe camp.
- Safe camp (south fenced area) - PvP off, mobs cannot chase inside
- Tougher mobs, better rewards, mount drops possible
- DEATH RISK: can drop items into tombstone
- Portal north -> Wilderness North
- Portal east -> Wilderness East

**Wilderness North** - Reached from top of Wilderness.
- PvP full map (no safe camp)
- Level-gated cave at far north
- Lower mob density than main Wilderness

**Wilderness East** - Large wild area east of main Wilderness.
- Also reachable from north edge of The Pond
- Full PvP, mob danger similar to main Wilderness

**The Pond** - Calm fishing realm. PvP OFF.
- Best spot for fishing sessions
- Roast Pit here - ONLY place to cook raw fish for cooking XP
- Enter from Mainland east portal

**Whisperwood** - Peaceful woods south of Mainland. PvP OFF.
- Good for tree chopping and fishing
- ONLY place to place a personal shack (1 per player)
- Enter from Mainland south portal

**Arena** - Full PvP scene. Enter from Mainland arena plaza.
- Moving floor rollers that push players
- Spectator benches and chair tiles
- Use for structured PvP

---

### RESOURCES & GATHERING

| Resource | Tool Needed | Where to Find |
|---|---|---|
| Wood | Axe | Trees on Mainland, Whisperwood, Wilderness |
| Stone | Pickaxe | Rocks on Mainland, Mine interior, Wilderness |
| Coal | Pickaxe | Coal clusters, Mine interior, some rocks |
| Fish (Raw) | Fishing Rod | Whisperwood ponds, The Pond, marked water tiles |

Gathering rules:
- Equip tool on hotbar, stand next to resource, click to gather
- Stackable items stack up to 999 per slot
- Level 2 tools gather twice as much and give double XP
- Upgrade tools at the Anvil (takes 60 seconds per smith)

---

### SKILLS

| Skill | How to Level |
|---|---|
| Combat | Fighting mobs, training at armory |
| Woodcutting | Chopping trees |
| Mining | Mining rocks and coal |
| Fishing | Successful catches |
| Cooking | Cooking raw fish at The Pond Roast Pit |

- Early levels come quickly, late levels take longer
- Need average skill level 5 to use Spinner Wheel
- High combat level needed for Wilderness North cave

---

### COMBAT

- Melee-focused: equip sword, click enemies
- No armor - cosmetics do not affect damage
- Healing methods:
  1. Plaza Fountain (Mainland center) - stand nearby
  2. Firepits - build in field for temporary healing
  3. Health potions - drink from hotbar
  4. Kiting - walk away during enemy attack wind-ups
- Mobs chase when you get close
- Mobs can drop mounts (rare)
- Mobs do NOT drop gold currently

---

### STRUCTURES (Building)

**Firepit**
- Cost: 20 stone + 20 coal + 50 wood
- Lasts ~30 seconds
- Stand next to it to heal
- NOT for cooking fish

**Shack**
- Cost: 500 wood + 200 stone
- Whisperwood ONLY
- 1 per player (personal landmark, no storage)
- Use /pickup to move it

---

### ECONOMY

**Gold** - Main in-game currency
- Earned from: daily quests, selling on Marketplace, events, Spinner Wheel
- Spent on: cosmetics, building, merchant shops

**$KINS** - On-chain Solana token
- Need 1,000 $KINS minimum to play
- Used for: paid Spinner spins ($3 USD per spin), Marketplace gold-for-$KINS trades
- Paid spinner: 50% burned, 50% to treasury
- Marketplace $KINS fee: 95% to seller, 5% to treasury

---

### MARKETPLACE

- Open from radar HUD button (cart icon) - works from anywhere
- Tabs: Buy / Sell / My Listings
- Gold listings: normal item trades for gold (no fee)
- Gold-for-$KINS listings: trade in-game gold for $KINS on-chain

---

### DAILY QUESTS

Types:
- Gather objectives: chop X wood, mine X stone, catch X fish
- Combat objectives: kill X mobs in specific realm
- Rewards: gold, items, XP, sometimes profile badges
- Resets daily - check quest UI for time remaining

---

### SPINNER WHEEL

- Location: Mainland near casino (columns 25-26)
- Requirement: average skill level 5
- Free spin: every 12 hours
- Prizes: wood, stone, coal (most common), gold (~1 in 20 chance)
- Paid spin: $3 USD worth of $KINS, extra spin anytime

---

### DEATH & TOMBSTONES

- In Wilderness, Wilderness North, Wilderness East: dying can drop items into tombstone
- Respawn at safe location, tombstone appears where you died
- Recover items quickly before tombstone expires
- Safe zones (no tombstones): Mainland, Whisperwood, The Pond

---

### KEYBINDINGS (Default)

- I - inventory
- M - map
- B - build menu
- C - chat
- F - friends
- R - rotate camera
- 1-6 - hotbar slots
- 0 - clear hotbar selection
- Esc - close modal

---

### SLASH COMMANDS

- /pickup - pick up your firepit or shack
- /lock / /unlock - lock structures against mis-clicks
- /dismount - leave a mount
- /who - list nearby players
- /help - list all commands

---

### TIPS FOR NEW PLAYERS

1. Follow tutorial NPC on Mainland first
2. Put tools on hotbar (open I, drag to number keys)
3. Visit plaza fountain to heal for free
4. Do not go to Wilderness before armory practice
5. Bank valuable items before Wilderness trips
6. Do not place shack without scouting location first
7. Roast Pit at The Pond for cooking XP (NOT mainland firepits)

---

### GAMING MODE BEHAVIOR RULES

When watching user play Kintara:
- React like a knowledgeable friend watching over their shoulder
- Keep responses SHORT - 1-2 sentences max
- Only comment when something notable happens
- Use correct Kintara game terms (realm names, item names, etc.)
- Be encouraging, helpful, not annoying
- If nothing interesting is happening, stay quiet
- Never break character as Haruka
- Prioritize safety warnings (Wilderness death risk, tombstone recovery)
```

---

## PART 2 - VISION PROMPT (Kintara-Specific)

Ini prompt yang dikirim ke vision model setiap screenshot diambil.
Ganti generic prompt dengan ini:

```javascript
const KINTARA_VISION_PROMPT = `You are watching someone play Kintara,
a browser-based isometric MMO on Solana.

Analyze this screenshot and identify only what is clearly visible.
Return your result in a compact structured format:

REALM: Mainland | Wilderness | Wilderness North | Wilderness East | The Pond | Whisperwood | Arena | Unknown
ACTIVITY: Walking | Chopping trees | Mining | Fishing | Fighting mob | Trading | Building | Idle | Other
HEALTH: High | Medium | Low | Critical | Not visible
DANGER: None | Mob pressure | Low health | PvP threat | Tombstone risk | Unknown
NEARBY: short comma-separated list
QUEST_UI: short comma-separated list

Rules:
- Use Kintara game terms
- If something is not clearly visible, say "Not visible" or "Unknown"
- Do not guess
- Keep response concise`;
```

Recommended improvement:
- Prefer JSON output from the vision layer if the model supports it
- Do not parse free-form natural language if structured output is available

---

## PART 3 - GAME STATE TRACKER

Track what is happening across screenshots for better context.

```javascript
let kintaraGameState = {
  currentRealm: 'Unknown',
  lastActivity: 'Unknown',
  healthStatus: 'Unknown',
  lastDanger: 'None',
  sessionStartTime: Date.now(),
  lastSpokenAt: 0,
  warningGiven: {
    lowHealth: false,
    wildernessDanger: false,
    tombstone: false
  }
};

function updateGameState(vision) {
  const realm = vision.realm || 'Unknown';
  const activity = vision.activity || 'Unknown';
  const health = vision.health || 'Unknown';
  const danger = vision.danger || 'None';
  const nearby = vision.nearby || [];

  kintaraGameState.currentRealm = realm;
  kintaraGameState.lastActivity = activity;
  kintaraGameState.healthStatus = health;
  kintaraGameState.lastDanger = danger;

  const isInDangerZone = ['Wilderness', 'Wilderness North', 'Wilderness East'].includes(realm);
  const hasLowHealth = health === 'Low' || health === 'Critical';
  const now = Date.now();
  const cooldownPassed = now - kintaraGameState.lastSpokenAt > 12000;

  if (isInDangerZone && hasLowHealth && !kintaraGameState.warningGiven.lowHealth && cooldownPassed) {
    kintaraGameState.warningGiven.lowHealth = true;
    kintaraGameState.lastSpokenAt = now;

    return {
      shouldSpeak: true,
      priority: 'HIGH',
      realm,
      activity,
      health,
      danger,
      notableObjects: nearby,
      contextForHaruka: `[KINTARA ALERT] Player is in ${realm} with ${health.toLowerCase()} health. Warn them to use a potion, kite away, or move toward safety. Mention tombstone risk calmly but urgently.`
    };
  }

  if (!hasLowHealth) {
    kintaraGameState.warningGiven.lowHealth = false;
  }

  return {
    shouldSpeak: false,
    priority: 'LOW',
    realm,
    activity,
    health,
    danger,
    notableObjects: nearby,
    contextForHaruka: `[KINTARA CONTEXT] Realm: ${realm}. Activity: ${activity}. Health: ${health}. Danger: ${danger}.`
  };
}
```

Important:
- Check exact realm names before generic substring matching
- `Wilderness North` and `Wilderness East` must not collapse into plain `Wilderness`
- Add cooldowns so Haruka does not become noisy

---

## PART 4 - HARUKA RESPONSE EXAMPLES PER SITUATION

Ini contoh response yang natural dari Haruka per situasi di Kintara.
Masukkan ke soul prompt sebagai few-shot examples:

```markdown
## Kintara Response Examples

### Player chopping trees in Whisperwood
"Whisperwood is a good call for wood - peaceful and no PvP to worry about."

### Player entering Wilderness
"Heading into the Wilderness? Bank your valuables first if you have not already - tombstones are real out there."

### Player has low health in Wilderness
"Your health looks low and you are in the Wilderness - use a potion or kite back toward the safe camp now."

### Player fishing at The Pond
"The Pond is the best spot for fishing. Do not forget to cook at the Roast Pit here for cooking XP."

### Player at Mainland fountain
"Good call standing by the fountain - it is the fastest free heal in the game."

### Player opens Marketplace
"Checking the Marketplace? Remember you can open it from anywhere via the HUD."

### Player dies (tombstone appears)
"You dropped a tombstone - go back and recover it quickly before it expires."

### Player doing daily quest
"Daily quests are worth doing - the gold and XP rewards add up fast."

### Player at Spinner Wheel
"Free spin every 12 hours - mostly resources, but gold is possible. Worth clicking."

### Player levels up a skill
"Skill leveling up feels good. Higher combat opens the cave in Wilderness North later."
```

---

## PART 5 - INTEGRATION TO HARUKA RUNTIME + EXTENSION FLOW

Do not assume a full gaming mode already exists in this repo.
Implement the Kintara flow as an extension-driven pipeline that talks to HARUKA runtime.

```javascript
// Extension background worker
async function analyzeKintaraFrame(base64Image) {
  const visionResponse = await callVisionModel(base64Image, KINTARA_VISION_PROMPT);
  const stateUpdate = updateGameState(visionResponse);

  await fetch('/api/haruka/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'gaming-companion',
      selectedGame: 'kintara',
      gameContext: {
        realm: stateUpdate.realm,
        activity: stateUpdate.activity,
        health: stateUpdate.health,
        danger: stateUpdate.danger,
        notableObjects: stateUpdate.notableObjects,
        shouldInterrupt: stateUpdate.shouldSpeak === true
      },
      message: stateUpdate.contextForHaruka
    })
  });
}
```

### Recommended response flow

1. Extension captures frame every few seconds, not every animation frame
2. Vision model returns structured Kintara observations
3. Extension updates local game state
4. Only meaningful deltas are sent to HARUKA runtime
5. HARUKA decides whether to:
   - stay quiet
   - show a small overlay comment
   - speak a short warning
   - give a strategic tip

### Important guardrails

- Add cooldowns so Haruka does not talk too often
- Deduplicate repeated warnings
- Prioritize danger, low health, and tombstone recovery over flavor commentary
- Keep normal comments short and sparse
- Never block gameplay with a large modal

---

## PART 6 - EXTENSION UI SURFACE

Recommended UI entry point is the browser extension popup, not a big in-page gaming panel.

```html
<section class="haruka-extension-popup">
  <h4>HARUKA Gaming Mode</h4>
  <p>Haruka detected a supported game tab.</p>

  <div class="game-selector">
    <button class="game-option active" data-game="kintara">
      <span class="game-name">Kintara</span>
      <span class="game-badge">Supported</span>
    </button>
    <button class="game-option disabled" disabled>
      <span class="game-name">Other Games</span>
      <span class="game-badge">Coming Soon</span>
    </button>
  </div>

  <div class="mode-options">
    <label>
      <input type="radio" name="ui-mode" value="overlay" checked>
      Compact Overlay
    </label>
    <label>
      <input type="radio" name="ui-mode" value="sidepanel">
      Side Panel
    </label>
  </div>

  <button id="start-kintara-mode">Start Kintara Companion</button>
  <button id="stop-kintara-mode" class="secondary">Stop</button>

  <p class="helper-text">
    Haruka will watch the active Kintara tab, react only when needed, and keep comments short.
  </p>
</section>
```

### Recommended in-tab overlay behavior

```html
<div id="haruka-kintara-overlay" class="haruka-overlay minimized">
  <div class="overlay-badge">HARUKA</div>
  <div class="overlay-status">Watching Kintara</div>
  <div class="overlay-reply">Whisperwood is safe for wood farming.</div>
  <button class="overlay-mute">Mute</button>
  <button class="overlay-collapse">Hide</button>
</div>
```

### UX rules

- Overlay should be small, movable, and collapsible
- Default state should be compact, not chat-panel sized
- Speech should be optional
- User must be able to pause Haruka quickly
- Do not cover central combat or inventory areas

---

## PART 7 - STARTUP BEHAVIOR

```javascript
async function startGamingMode(game) {
  selectedGame = game;

  if (game !== 'kintara') {
    return;
  }

  await connectToHarukaRuntime({
    source: 'gaming-companion',
    selectedGame: 'kintara'
  });

  await startTabCapture();
  await showOverlay({ mode: 'overlay' });
}
```

### Startup rules

- Kintara should be the default selected game
- If active tab is not Kintara, disable start button
- On start, Haruka should load Kintara knowledge silently
- Haruka should wait for real game context before speaking
- First comment should only happen after meaningful signal, not immediately on launch

---

## PART 8 - REPO FIT NOTES

For this HARUKA repo:

- Keep soul identity, Character Card bias, provider routing, and response rules in the existing HARUKA runtime
- Do not move personality logic into the extension
- Add game-specific prompt composition beside the existing prompt flow
- Add a new request shape for `selectedGame` and `gameContext`
- Treat extension as a thin orchestration layer

Suggested implementation seams:

- `src/chatmanager.ts` for any local gaming-mode receive/display behavior
- `src/harukaPromptComposer.ts` for Kintara prompt overlay composition
- `src/harukaChatContract.ts` for new `gaming-companion` request fields
- `src/server/harukaChatService.ts` for routing and validation of game context
- separate extension folder for `manifest`, `background`, `content`, and popup UI

---

## TESTING CHECKLIST

- [ ] Extension popup can detect supported Kintara tab
- [ ] Kintara selected by default
- [ ] Compact overlay appears on supported tab
- [ ] Overlay can be collapsed, muted, and stopped
- [ ] Kintara knowledge loaded into game-specific prompt layer
- [ ] Vision prompt Kintara-specific terpasang
- [ ] Game state tracker jalan antar screenshot
- [ ] Structured game context sent to HARUKA runtime
- [ ] Haruka identify realm dengan benar dari screenshot
- [ ] Haruka warn saat player low health di Wilderness
- [ ] Haruka react ke gathering activities
- [ ] Haruka remind cooking di The Pond Roast Pit
- [ ] Haruka warn tombstone risk saat masuk Wilderness
- [ ] Response max 2 kalimat - tidak verbose
- [ ] Cooldown prevents repeated spam commentary
- [ ] Gaming mode can stop cleanly when tab closes or user disables it
