export const HARUKA_ECONOMY = {
  minimumHoldToPlay: 1000,
  minimumClaim: 100,
  claimBurnRate: 0.02,
  rewardPoolReferenceSupply: 25000000,
  luckyHarvestTable: [
    { key: 'normal', chance: 0.85, multiplier: 1 },
    { key: 'lucky', chance: 0.12, multiplier: 2 },
    { key: 'superLucky', chance: 0.025, multiplier: 5 },
    { key: 'jackpot', chance: 0.005, multiplier: 10 }
  ],
  marketplaceSplit: {
    seller: 0.6,
    revenueShare: 0.3,
    burn: 0.067,
    rewardPoolRefill: 0.033
  }
}

export function getStreakMultiplier(streakDays) {
  if (streakDays >= 7) return 1.7
  if (streakDays >= 5) return 1.4
  if (streakDays >= 3) return 1.2
  if (streakDays >= 2) return 1.1
  return 1
}

export function getDailyCap(poolBalance) {
  if (poolBalance > 400000) return 1000
  if (poolBalance >= 200000) return 600
  if (poolBalance >= 50000) return 300
  if (poolBalance >= 10000) return 100
  return 0
}

export function getHolderRevenueBoost(balance) {
  if (balance >= 5000000) return 1.15
  if (balance >= 1000000) return 1.1
  if (balance >= 100000) return 1.05
  return 1
}

export function calculateHarvestReward({ baseReward, streakDays, luckyMultiplier, remainingDailyCap, rewardPoolBalance }) {
  const rawReward = Math.round(baseReward * getStreakMultiplier(streakDays) * luckyMultiplier)
  return Math.max(0, Math.min(rawReward, remainingDailyCap, rewardPoolBalance))
}

export function calculateClaimBreakdown(claimableAmount) {
  const burned = Number((claimableAmount * HARUKA_ECONOMY.claimBurnRate).toFixed(2))
  const netClaimed = Number((claimableAmount - burned).toFixed(2))
  return { claimableAmount, burned, netClaimed }
}

export function calculateMarketplaceSplit(listingValue) {
  return {
    seller: Number((listingValue * HARUKA_ECONOMY.marketplaceSplit.seller).toFixed(2)),
    revenueShare: Number((listingValue * HARUKA_ECONOMY.marketplaceSplit.revenueShare).toFixed(2)),
    burn: Number((listingValue * HARUKA_ECONOMY.marketplaceSplit.burn).toFixed(2)),
    rewardPoolRefill: Number((listingValue * HARUKA_ECONOMY.marketplaceSplit.rewardPoolRefill).toFixed(2))
  }
}

export function estimateRevenueShare({ weeklyPool, holderBalance }) {
  const boost = getHolderRevenueBoost(holderBalance)
  return Math.floor((weeklyPool || 0) * (holderBalance / HARUKA_ECONOMY.rewardPoolReferenceSupply) * boost)
}
