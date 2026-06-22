const crypto = require('crypto');

const ROUTE_VERSION = 'api-haruka-reward-state-2026-06-22-v1';
const HARUKA_INITIAL_REWARD_POOL = 500000;
const HARUKA_MIN_CLAIM = 100;
const HARUKA_CLAIM_BURN_RATE = 0.02;
const MAX_HARVEST_LOG = 30;
const MAX_CLAIM_LOG = 20;
const DEFAULT_TIMEZONE = 'Asia/Jakarta';
const RANDOM_ROLL_MAX = 1_000_000;

const FARM_FIELDS = {
  'meadow-field': { id: 'meadow-field', label: 'Meadow patch' },
  'dock-field': { id: 'dock-field', label: 'Dock patch' }
};

const FARM_CROPS = {
  carrot: { label: 'Carrot', growMs: 10000, harukaReward: 5 },
  potato: { label: 'Potato', growMs: 20000, harukaReward: 12 },
  tomato: { label: 'Tomato', growMs: 35000, harukaReward: 25 },
  strawberry: { label: 'Strawberry', growMs: 60000, harukaReward: 50 },
  lettuce: { label: 'Lettuce', growMs: 90000, harukaReward: 80 },
  pumpkin: { label: 'Pumpkin', growMs: 120000, harukaReward: 130 }
};

const FARM_PLOT_BLUEPRINTS = [
  { id: 'meadow-1', fieldId: 'meadow-field' },
  { id: 'meadow-2', fieldId: 'meadow-field' },
  { id: 'meadow-3', fieldId: 'meadow-field' },
  { id: 'meadow-4', fieldId: 'meadow-field' },
  { id: 'meadow-5', fieldId: 'meadow-field' },
  { id: 'meadow-6', fieldId: 'meadow-field' },
  { id: 'dock-1', fieldId: 'dock-field' },
  { id: 'dock-2', fieldId: 'dock-field' },
  { id: 'dock-3', fieldId: 'dock-field' },
  { id: 'dock-4', fieldId: 'dock-field' },
  { id: 'dock-5', fieldId: 'dock-field' },
  { id: 'dock-6', fieldId: 'dock-field' }
];

function parsePositiveNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value || '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function roundHarukaAmount(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getDateKey(timestamp, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(timestamp));
}

function getDailyCapFromPool(poolBalance) {
  if (poolBalance > 400000) return 1000;
  if (poolBalance > 200000) return 600;
  if (poolBalance > 50000) return 300;
  if (poolBalance > 10000) return 100;
  return 0;
}

function getStreakMultiplier(consecutiveDays) {
  if (consecutiveDays >= 7) return 1.7;
  if (consecutiveDays >= 5) return 1.4;
  if (consecutiveDays >= 3) return 1.2;
  if (consecutiveDays >= 2) return 1.1;
  return 1.0;
}

function rollLuckyHarvest() {
  const roll = crypto.randomInt(0, RANDOM_ROLL_MAX) / RANDOM_ROLL_MAX;
  if (roll < 0.005) return { type: 'jackpot', multi: 10, label: 'JACKPOT' };
  if (roll < 0.03) return { type: 'super_lucky', multi: 5, label: 'SUPER LUCKY' };
  if (roll < 0.15) return { type: 'lucky', multi: 2, label: 'LUCKY' };
  return { type: 'normal', multi: 1, label: 'Normal' };
}

function createDailyRewards(date) {
  return {
    date,
    earned: 0,
    claimed: 0,
    claimCount: 0
  };
}

function readRewardStateConfig() {
  const secretSource = String(
    process.env.HARUKA_REWARD_STATE_SECRET ||
    process.env.HARUKA_BUYBACK_TREASURY_PRIVATE_KEY ||
    process.env.CRON_SECRET ||
    ''
  ).trim();

  const config = {
    secret: secretSource ? crypto.createHash('sha256').update(`haruka-reward-state:${secretSource}`).digest('hex') : '',
    timezone: String(process.env.HARUKA_REWARD_TIMEZONE || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE,
    minClaim: parsePositiveNumber(process.env.HARUKA_REWARD_MIN_CLAIM, HARUKA_MIN_CLAIM),
    burnRate: parsePositiveNumber(process.env.HARUKA_REWARD_CLAIM_BURN_RATE, HARUKA_CLAIM_BURN_RATE)
  };

  const issues = [];
  if (!config.secret) {
    issues.push('HARUKA_REWARD_STATE_SECRET, HARUKA_BUYBACK_TREASURY_PRIVATE_KEY, or CRON_SECRET is required.');
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

function createBasePlots() {
  return FARM_PLOT_BLUEPRINTS.reduce((plots, blueprint) => {
    plots[blueprint.id] = {
      cropKey: null,
      plantedAt: null
    };
    return plots;
  }, {});
}

function createBaseRewardState(walletAddress, config, now = Date.now()) {
  return {
    walletAddress,
    plots: createBasePlots(),
    unclaimedHaruka: 0,
    totalEarnedHaruka: 0,
    totalClaimedHaruka: 0,
    totalBurnedHaruka: 0,
    rewardPoolBalance: HARUKA_INITIAL_REWARD_POOL,
    loginStreak: 0,
    lastHarvestDate: null,
    dailyRewards: createDailyRewards(getDateKey(now, config.timezone)),
    harvestLog: [],
    claimTransactions: [],
    claimNonce: 0
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeRewardState(state, config, now = Date.now()) {
  const baseState = createBaseRewardState(state.walletAddress, config, now);
  const normalizedPlots = createBasePlots();

  FARM_PLOT_BLUEPRINTS.forEach((blueprint) => {
    const savedPlot = state && state.plots ? state.plots[blueprint.id] : null;
    const cropKey = savedPlot && FARM_CROPS[savedPlot.cropKey] ? savedPlot.cropKey : null;
    const plantedAt = typeof savedPlot?.plantedAt === 'number' && Number.isFinite(savedPlot.plantedAt) ? savedPlot.plantedAt : null;
    normalizedPlots[blueprint.id] = {
      cropKey,
      plantedAt: cropKey ? plantedAt : null
    };
  });

  const dateKey = getDateKey(now, config.timezone);
  const existingDailyRewards = state && state.dailyRewards && state.dailyRewards.date === dateKey
    ? state.dailyRewards
    : createDailyRewards(dateKey);

  return {
    walletAddress: String(state.walletAddress || baseState.walletAddress).trim(),
    plots: normalizedPlots,
    unclaimedHaruka: Math.max(0, roundHarukaAmount(state.unclaimedHaruka ?? baseState.unclaimedHaruka)),
    totalEarnedHaruka: Math.max(0, roundHarukaAmount(state.totalEarnedHaruka ?? baseState.totalEarnedHaruka)),
    totalClaimedHaruka: Math.max(0, roundHarukaAmount(state.totalClaimedHaruka ?? baseState.totalClaimedHaruka)),
    totalBurnedHaruka: Math.max(0, roundHarukaAmount(state.totalBurnedHaruka ?? baseState.totalBurnedHaruka)),
    rewardPoolBalance: Math.max(0, roundHarukaAmount(state.rewardPoolBalance ?? baseState.rewardPoolBalance)),
    loginStreak: Math.max(0, Math.floor(Number(state.loginStreak ?? baseState.loginStreak) || 0)),
    lastHarvestDate: typeof state.lastHarvestDate === 'string' ? state.lastHarvestDate : null,
    dailyRewards: {
      date: dateKey,
      earned: Math.max(0, roundHarukaAmount(existingDailyRewards.earned)),
      claimed: Math.max(0, roundHarukaAmount(existingDailyRewards.claimed)),
      claimCount: Math.max(0, Math.floor(Number(existingDailyRewards.claimCount) || 0))
    },
    harvestLog: Array.isArray(state.harvestLog) ? state.harvestLog.slice(0, MAX_HARVEST_LOG) : [],
    claimTransactions: Array.isArray(state.claimTransactions) ? state.claimTransactions.slice(0, MAX_CLAIM_LOG) : [],
    claimNonce: Math.max(0, Math.floor(Number(state.claimNonce ?? 0) || 0))
  };
}

function encodeBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signEncodedPayload(encodedPayload, config) {
  return crypto.createHmac('sha256', config.secret).update(encodedPayload).digest('base64url');
}

function createRewardStateProof(state, config) {
  const payload = encodeBase64Url(JSON.stringify(state));
  const signature = signEncodedPayload(payload, config);
  return `${payload}.${signature}`;
}

function parseRewardStateProof(proof, walletAddress, config, now = Date.now()) {
  const raw = String(proof || '').trim();
  if (!raw) {
    return createBaseRewardState(walletAddress, config, now);
  }

  const separatorIndex = raw.lastIndexOf('.');
  if (separatorIndex <= 0) {
    throw new Error('Reward proof format is invalid.');
  }

  const encodedPayload = raw.slice(0, separatorIndex);
  const signature = raw.slice(separatorIndex + 1);
  const expectedSignature = signEncodedPayload(encodedPayload, config);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('Reward proof signature is invalid.');
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload));
  if (String(payload.walletAddress || '').trim() !== walletAddress) {
    throw new Error('Reward proof wallet address does not match the connected wallet.');
  }

  return normalizeRewardState(payload, config, now);
}

function summarizeRewardState(state, config, now = Date.now()) {
  const normalized = normalizeRewardState(state, config, now);
  return {
    walletAddress: normalized.walletAddress,
    plots: cloneJson(normalized.plots),
    unclaimedHaruka: normalized.unclaimedHaruka,
    totalEarnedHaruka: normalized.totalEarnedHaruka,
    totalClaimedHaruka: normalized.totalClaimedHaruka,
    totalBurnedHaruka: normalized.totalBurnedHaruka,
    rewardPoolBalance: normalized.rewardPoolBalance,
    loginStreak: normalized.loginStreak,
    lastHarvestDate: normalized.lastHarvestDate,
    dailyRewards: cloneJson(normalized.dailyRewards),
    harvestLog: cloneJson(normalized.harvestLog),
    claimTransactions: cloneJson(normalized.claimTransactions),
    claimNonce: normalized.claimNonce,
    dailyCap: getDailyCapFromPool(normalized.rewardPoolBalance),
    timeZone: config.timezone,
    capturedAt: new Date(now).toISOString()
  };
}

function getZoneBlueprints(zoneId) {
  return FARM_PLOT_BLUEPRINTS.filter((blueprint) => blueprint.fieldId === zoneId);
}

function getReadyPlotsForZone(state, zoneId, now = Date.now()) {
  return getZoneBlueprints(zoneId)
    .map((blueprint) => {
      const plotState = state.plots[blueprint.id];
      const cropKey = plotState?.cropKey;
      const crop = cropKey ? FARM_CROPS[cropKey] : null;
      if (!crop || typeof plotState.plantedAt !== 'number') {
        return null;
      }

      const readyAt = plotState.plantedAt + crop.growMs;
      return readyAt <= now
        ? {
            plotId: blueprint.id,
            cropKey,
            crop,
            plantedAt: plotState.plantedAt
          }
        : null;
    })
    .filter(Boolean);
}

function getEmptyPlotsForZone(state, zoneId) {
  return getZoneBlueprints(zoneId)
    .map((blueprint) => {
      const plotState = state.plots[blueprint.id];
      return !plotState?.cropKey
        ? {
            plotId: blueprint.id
          }
        : null;
    })
    .filter(Boolean);
}

function refreshDailyRewards(state, config, now = Date.now()) {
  state.dailyRewards = normalizeRewardState({ ...state, walletAddress: state.walletAddress }, config, now).dailyRewards;
  return state.dailyRewards;
}

function updateHarvestStreak(state, config, now = Date.now()) {
  const today = getDateKey(now, config.timezone);
  const yesterday = getDateKey(now - 86400000, config.timezone);

  if (state.lastHarvestDate === today) {
    return state.loginStreak || 1;
  }

  state.loginStreak = state.lastHarvestDate === yesterday ? (state.loginStreak || 0) + 1 : 1;
  state.lastHarvestDate = today;
  return state.loginStreak;
}

function buildClaimPreview(state, config) {
  const claimable = Math.floor(Math.max(0, Number(state.unclaimedHaruka) || 0));
  const burned = roundHarukaAmount(claimable * config.burnRate);
  const netClaimed = roundHarukaAmount(claimable - burned);

  return {
    grossClaimed: claimable,
    netClaimed,
    burned
  };
}

function applyClaimSettlement(state, config, settlement) {
  const nextState = normalizeRewardState(state, config, settlement.now);
  const claim = buildClaimPreview(nextState, config);
  if (claim.grossClaimed < config.minClaim) {
    throw new Error(`Claim minimum is ${config.minClaim} $HARUKA.`);
  }
  if (claim.netClaimed <= 0) {
    throw new Error('Claim net amount must be greater than zero after burn.');
  }

  nextState.unclaimedHaruka = roundHarukaAmount(Math.max(0, nextState.unclaimedHaruka - claim.grossClaimed));
  nextState.totalClaimedHaruka = roundHarukaAmount(nextState.totalClaimedHaruka + claim.netClaimed);
  nextState.totalBurnedHaruka = roundHarukaAmount(nextState.totalBurnedHaruka + claim.burned);
  nextState.dailyRewards.claimed = roundHarukaAmount(nextState.dailyRewards.claimed + claim.grossClaimed);
  nextState.dailyRewards.claimCount += 1;
  nextState.claimTransactions.unshift({
    amount: claim.grossClaimed,
    netClaimed: claim.netClaimed,
    burned: claim.burned,
    txSignature: settlement.transferSignature,
    burnSignature: settlement.burnSignature || null,
    claimedAt: new Date(settlement.now).toISOString(),
    mode: 'on-chain',
    claimNonce: nextState.claimNonce
  });
  nextState.claimTransactions = nextState.claimTransactions.slice(0, MAX_CLAIM_LOG);
  nextState.claimNonce += 1;

  return {
    state: nextState,
    claim
  };
}

function createClaimMemo(walletAddress, claimNonce) {
  return `haruka-claim:${walletAddress}:${claimNonce}`;
}

function applyPlantAction(state, config, action) {
  const zone = FARM_FIELDS[action.zoneId];
  if (!zone) {
    throw new Error('Unknown farm zone.');
  }

  const crop = FARM_CROPS[action.cropKey];
  if (!crop) {
    throw new Error('Unknown crop key.');
  }

  const nextState = normalizeRewardState(state, config, action.now);
  const emptyPlots = getEmptyPlotsForZone(nextState, action.zoneId);
  if (!emptyPlots.length) {
    throw new Error(`${zone.label} has no empty soil right now.`);
  }

  const targetPlot = emptyPlots[0];
  nextState.plots[targetPlot.plotId] = {
    cropKey: action.cropKey,
    plantedAt: action.now
  };

  return {
    state: nextState,
    plant: {
      zoneId: action.zoneId,
      zoneLabel: zone.label,
      plotId: targetPlot.plotId,
      cropKey: action.cropKey,
      cropLabel: crop.label,
      plantedAt: action.now,
      growMs: crop.growMs
    }
  };
}

function applyHarvestAction(state, config, action) {
  const zone = FARM_FIELDS[action.zoneId];
  if (!zone) {
    throw new Error('Unknown farm zone.');
  }

  const nextState = normalizeRewardState(state, config, action.now);
  refreshDailyRewards(nextState, config, action.now);
  const readyPlots = getReadyPlotsForZone(nextState, action.zoneId, action.now);
  if (!readyPlots.length) {
    return {
      state: nextState,
      harvest: {
        zoneId: action.zoneId,
        zoneLabel: zone.label,
        readyPlotIds: [],
        entries: [],
        streakDays: nextState.loginStreak || 0,
        streakMultiplier: getStreakMultiplier(nextState.loginStreak || 0),
        totalHaruka: 0,
        dailyCap: getDailyCapFromPool(nextState.rewardPoolBalance)
      }
    };
  }

  const streakDays = updateHarvestStreak(nextState, config, action.now);
  const streakMultiplier = getStreakMultiplier(streakDays);
  const dailyCap = getDailyCapFromPool(nextState.rewardPoolBalance);
  let remainingDailyCap = Math.max(0, dailyCap - nextState.dailyRewards.earned);
  let totalHaruka = 0;
  const entries = [];

  readyPlots.forEach((plot) => {
    const luckyRoll = rollLuckyHarvest();
    const uncappedReward = Math.round(plot.crop.harukaReward * streakMultiplier * luckyRoll.multi);
    const reward = Math.max(0, Math.min(uncappedReward, remainingDailyCap, nextState.rewardPoolBalance || 0));
    remainingDailyCap = Math.max(0, remainingDailyCap - reward);
    totalHaruka = roundHarukaAmount(totalHaruka + reward);

    nextState.unclaimedHaruka = roundHarukaAmount(nextState.unclaimedHaruka + reward);
    nextState.totalEarnedHaruka = roundHarukaAmount(nextState.totalEarnedHaruka + reward);
    nextState.rewardPoolBalance = roundHarukaAmount(Math.max(0, nextState.rewardPoolBalance - reward));
    nextState.dailyRewards.earned = roundHarukaAmount(nextState.dailyRewards.earned + reward);
    nextState.harvestLog.unshift({
      cropKey: plot.cropKey,
      plotId: plot.plotId,
      plantedAt: plot.plantedAt,
      harvestedAt: action.now,
      baseReward: plot.crop.harukaReward,
      streakMultiplier,
      luckyMultiplier: luckyRoll.multi,
      luckyType: luckyRoll.type,
      finalReward: reward,
      uncappedReward
    });
    nextState.harvestLog = nextState.harvestLog.slice(0, MAX_HARVEST_LOG);
    nextState.plots[plot.plotId] = {
      cropKey: null,
      plantedAt: null
    };

    entries.push({
      plotId: plot.plotId,
      cropKey: plot.cropKey,
      cropLabel: plot.crop.label,
      plantedAt: plot.plantedAt,
      harvestedAt: action.now,
      baseReward: plot.crop.harukaReward,
      streakMultiplier,
      luckyType: luckyRoll.type,
      luckyMultiplier: luckyRoll.multi,
      finalReward: reward,
      uncappedReward
    });
  });

  return {
    state: nextState,
    harvest: {
      zoneId: action.zoneId,
      zoneLabel: zone.label,
      readyPlotIds: entries.map((entry) => entry.plotId),
      entries,
      streakDays,
      streakMultiplier,
      totalHaruka,
      dailyCap
    }
  };
}

function buildRewardStateSnapshot() {
  const config = readRewardStateConfig();
  return {
    rewardStateEnabled: true,
    rewardStateReady: config.ready,
    rewardStateRouteVersion: ROUTE_VERSION,
    rewardStateTimeZone: config.timezone,
    rewardStateMinClaim: config.minClaim,
    rewardStateBurnRate: config.burnRate,
    ...(config.issues.length ? { rewardStateIssues: config.issues } : {})
  };
}

module.exports = {
  ROUTE_VERSION,
  FARM_CROPS,
  FARM_FIELDS,
  FARM_PLOT_BLUEPRINTS,
  applyClaimSettlement,
  applyHarvestAction,
  applyPlantAction,
  buildClaimPreview,
  buildRewardStateSnapshot,
  createBaseRewardState,
  createRewardStateProof,
  createClaimMemo,
  getDailyCapFromPool,
  normalizeRewardState,
  parseRewardStateProof,
  readRewardStateConfig,
  summarizeRewardState
};
