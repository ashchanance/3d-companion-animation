const canvas = document.querySelector('#haruka-game-canvas')
if (!canvas) {
  throw new Error('Missing #haruka-game-canvas element for the HARUKA game route.')
}

const c = canvas.getContext('2d')
if (!c) {
  throw new Error('Failed to create a 2D rendering context for the HARUKA game route.')
}

canvas.width = 1024
canvas.height = 576

const farmUi = {
  dashboard: document.querySelector('.farm-overlay'),
  goldValue: document.querySelector('#farmGoldValue'),
  readyValue: document.querySelector('#farmReadyValue'),
  emptyValue: document.querySelector('#farmEmptyValue'),
  seedValue: document.querySelector('#farmSeedValue'),
  fieldValue: document.querySelector('#farmFieldValue'),
  actionShortValue: document.querySelector('#farmActionShortValue'),
  actionValue: document.querySelector('#farmActionValue'),
  modeValue: document.querySelector('#farmModeValue'),
  zoneValue: document.querySelector('#farmZoneValue'),
  hintValue: document.querySelector('#farmHintValue'),
  dialogueBox: document.querySelector('#characterDialogueBox'),
  seedButtons: Array.from(document.querySelectorAll('[data-farm-seed]')),
  xpBar: document.querySelector('#farmXpBar'),
  xpValue: document.querySelector('#farmXpValue'),
  actionKeyBadge: document.querySelector('.rpg-key-badge'),
  harukaValue: document.querySelector('#farmHarukaValue'),
  unclaimedValue: document.querySelector('#farmUnclaimedValue'),
  dailyCapValue: document.querySelector('#farmDailyCapValue'),
  streakValue: document.querySelector('#farmStreakValue'),
  claimButton: document.querySelector('#btnClaimRewards'),
  economyGate: document.querySelector('#economyGatePanel'),
  economyGateBalance: document.querySelector('#economyGateBalance'),
  economyGateStatus: document.querySelector('#economyGateStatus'),
  economyTabButtons: Array.from(document.querySelectorAll('[data-economy-view]')),
  economyPanels: Array.from(document.querySelectorAll('[data-economy-panel]')),
  marketInventoryValue: document.querySelector('#marketInventoryValue'),
  marketShopValue: document.querySelector('#marketShopValue'),
  marketSellerValue: document.querySelector('#marketSellerValue'),
  marketRevenueValue: document.querySelector('#marketRevenueValue'),
  marketBurnValue: document.querySelector('#marketBurnValue'),
  marketRefillValue: document.querySelector('#marketRefillValue'),
  marketStatusValue: document.querySelector('#marketStatusValue'),
  sellInventoryButton: document.querySelector('#btnSellInventory'),
  revenueWeekPoolValue: document.querySelector('#revenueWeekPoolValue'),
  revenueEstimateValue: document.querySelector('#revenueEstimateValue'),
  revenueNextValue: document.querySelector('#revenueNextValue'),
  revenueBoostValue: document.querySelector('#revenueBoostValue')
}

const FARM_STORAGE_KEY = 'haruka-realm-canvas-farm-v1'
const FARM_TILE_SIZE = 48
const FARM_SPRITE_SIZE = 16
const FARM_SEED_ORDER = ['carrot', 'potato', 'tomato', 'strawberry', 'lettuce', 'pumpkin']
const HARUKA_MINT = '9AWBK3E1ALof3LtUqUrxzagNV3gDtkBa2bGvv4mepump'
const TREASURY_WALLET = '5o5fW5CYtaYLRwdNoJeXhfajvwX48X1NxvXqtbXmtJHb'
const HARUKA_MIN_HOLD_TO_PLAY = 1000
const HARUKA_INITIAL_REWARD_POOL = 500000
const HARUKA_MIN_CLAIM = 100
const HARUKA_CLAIM_BURN_RATE = 0.02
const HARUKA_REWARD_CLAIM_TIMEOUT_MS = 60000
const HARUKA_REWARD_STATE_TIMEOUT_MS = 12000
const HARUKA_REWARD_PROOF_STORAGE_PREFIX = 'haruka.reward.proof.v1'
const MARKETPLACE_FEE_SPLIT = {
  seller: 0.6,
  revenue: 0.3,
  burn: 0.067,
  rewardPool: 0.033
}
const REVENUE_SHARE_REFERENCE_SUPPLY = 25000000
const STREAK_MILESTONES = new Set([3, 5, 7])
const FARM_PLOT_BLUEPRINTS = [
  { id: 'meadow-1', fieldId: 'meadow-field', tileX: 26, tileY: 24, cropKey: 'carrot', plantedOffsetMs: 42000 },
  { id: 'meadow-2', fieldId: 'meadow-field', tileX: 27, tileY: 24, cropKey: 'potato', plantedOffsetMs: 52000 },
  { id: 'meadow-3', fieldId: 'meadow-field', tileX: 28, tileY: 24, cropKey: 'tomato', plantedOffsetMs: 94000 },
  { id: 'meadow-4', fieldId: 'meadow-field', tileX: 29, tileY: 24, cropKey: 'carrot', plantedOffsetMs: 16000 },
  { id: 'meadow-5', fieldId: 'meadow-field', tileX: 30, tileY: 24, cropKey: 'potato', plantedOffsetMs: 36000 },
  { id: 'meadow-6', fieldId: 'meadow-field', tileX: 31, tileY: 24, cropKey: 'tomato', plantedOffsetMs: 64000 },
  { id: 'dock-1', fieldId: 'dock-field', tileX: 49, tileY: 21, cropKey: 'strawberry', plantedOffsetMs: 126000 },
  { id: 'dock-2', fieldId: 'dock-field', tileX: 50, tileY: 21, cropKey: 'lettuce', plantedOffsetMs: 180000 },
  { id: 'dock-3', fieldId: 'dock-field', tileX: 51, tileY: 21, cropKey: 'pumpkin', plantedOffsetMs: 280000 },
  { id: 'dock-4', fieldId: 'dock-field', tileX: 49, tileY: 22, cropKey: 'strawberry', plantedOffsetMs: 68000 },
  { id: 'dock-5', fieldId: 'dock-field', tileX: 50, tileY: 22, cropKey: 'lettuce', plantedOffsetMs: 134000 },
  { id: 'dock-6', fieldId: 'dock-field', tileX: 51, tileY: 22, cropKey: 'pumpkin', plantedOffsetMs: 172000 }
]

const FARM_FIELDS = [
  { id: 'meadow-field', label: 'Meadow patch' },
  { id: 'dock-field', label: 'Dock patch' }
]

const FARM_CROPS = {
  carrot: {
    label: 'Carrot',
    row: 2,
    growMs: 10000,
    cost: 12,
    sellPrice: 25,
    harukaReward: 5,
    level: 1
  },
  potato: {
    label: 'Potato',
    row: 3,
    growMs: 20000,
    cost: 18,
    sellPrice: 50,
    harukaReward: 12,
    level: 1
  },
  tomato: {
    label: 'Tomato',
    row: 4,
    growMs: 35000,
    cost: 28,
    sellPrice: 90,
    harukaReward: 25,
    level: 2
  },
  strawberry: {
    label: 'Strawberry',
    row: 1,
    growMs: 55000,
    cost: 42,
    sellPrice: 160,
    harukaReward: 50,
    level: 3
  },
  lettuce: {
    label: 'Lettuce',
    row: 5,
    growMs: 80000,
    cost: 60,
    sellPrice: 240,
    harukaReward: 80,
    level: 4
  },
  pumpkin: {
    label: 'Pumpkin',
    row: 0,
    growMs: 115000,
    cost: 90,
    sellPrice: 380,
    harukaReward: 130,
    level: 5
  }
}

farmUi.seedButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const seedKey = button.dataset.farmSeed
    setSelectedFarmSeed(seedKey)
  })
})

if (farmUi.claimButton) {
  farmUi.claimButton.addEventListener('click', claimHarukaRewards)
}

farmUi.economyTabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setEconomyView(button.dataset.economyView)
  })
})

if (farmUi.sellInventoryButton) {
  farmUi.sellInventoryButton.addEventListener('click', sellAllInventoryToShop)
}

const collisionsMap = []
for (let i = 0; i < collisions.length; i += 70) {
  collisionsMap.push(collisions.slice(i, 70 + i))
}

const battleZonesMap = []
for (let i = 0; i < battleZonesData.length; i += 70) {
  battleZonesMap.push(battleZonesData.slice(i, 70 + i))
}

const charactersMap = []
for (let i = 0; i < charactersMapData.length; i += 70) {
  charactersMap.push(charactersMapData.slice(i, 70 + i))
}

const boundaries = []
const offset = {
  x: -735,
  y: -650
}

let farmState = loadFarmState()
let claimRequestPending = false
let rewardStateRequestPending = false

collisionsMap.forEach((row, i) => {
  row.forEach((symbol, j) => {
    if (symbol === 1025)
      boundaries.push(
        new Boundary({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          }
        })
      )
  })
})

const battleZones = []

battleZonesMap.forEach((row, i) => {
  row.forEach((symbol, j) => {
    if (symbol === 1025)
      battleZones.push(
        new Boundary({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          }
        })
      )
  })
})

const characters = []
const villagerImg = new Image()
villagerImg.src = '/game/img/villager/Idle.png'

const oldManImg = new Image()
oldManImg.src = '/game/img/oldMan/Idle.png'

charactersMap.forEach((row, i) => {
  row.forEach((symbol, j) => {
    if (symbol === 1026) {
      characters.push(
        new Character({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          },
          image: villagerImg,
          frames: {
            max: 4,
            hold: 60
          },
          scale: 3,
          animate: true,
          dialogue: ['...', 'Hey mister, have you seen my Doggochu?']
        })
      )
    } else if (symbol === 1031) {
      characters.push(
        new Character({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          },
          image: oldManImg,
          frames: {
            max: 4,
            hold: 60
          },
          scale: 3,
          dialogue: ['My bones hurt.']
        })
      )
    }

    if (symbol !== 0) {
      boundaries.push(
        new Boundary({
          position: {
            x: j * Boundary.width + offset.x,
            y: i * Boundary.height + offset.y
          }
        })
      )
    }
  })
})

const image = new Image()
image.src = '/game/img/Pellet Town.png'

const foregroundImage = new Image()
foregroundImage.src = '/game/img/foregroundObjects.png'

const playerDownImage = new Image()
playerDownImage.src = '/game/img/playerDown.png'

const playerUpImage = new Image()
playerUpImage.src = '/game/img/playerUp.png'

const playerLeftImage = new Image()
playerLeftImage.src = '/game/img/playerLeft.png'

const playerRightImage = new Image()
playerRightImage.src = '/game/img/playerRight.png'

const player = new Sprite({
  position: {
    x: canvas.width / 2 - 192 / 4 / 2,
    y: canvas.height / 2 - 68 / 2
  },
  image: playerDownImage,
  frames: {
    max: 4,
    hold: 10
  },
  sprites: {
    up: playerUpImage,
    left: playerLeftImage,
    right: playerRightImage,
    down: playerDownImage
  }
})
player.farmInteractionZone = null

const background = new Sprite({
  position: {
    x: offset.x,
    y: offset.y
  },
  image: image
})

const foreground = new Sprite({
  position: {
    x: offset.x,
    y: offset.y
  },
  image: foregroundImage
})

const farmPlantsImage = new Image()
farmPlantsImage.src = '/game/farm-plants.png'

const farmPlots = createFarmPlots()
const farmZones = createFarmZones()

const keys = {
  w: {
    pressed: false
  },
  a: {
    pressed: false
  },
  s: {
    pressed: false
  },
  d: {
    pressed: false
  }
}

const movables = [
  background,
  ...boundaries,
  ...farmPlots,
  ...farmZones,
  foreground,
  ...battleZones,
  ...characters
]
const renderables = [
  background,
  ...boundaries,
  ...battleZones,
  ...farmPlots,
  ...characters,
  player,
  foreground
]

const battle = {
  initiated: false,
  confirming: false,
  cooldown: 0
}
let animationId

function animate() {
  animationId = window.requestAnimationFrame(animate)
  renderables.forEach((renderable) => {
    renderable.draw()
  })
  syncFarmInteractionZone()
  updateFarmUi()

  let moving = true
  player.animate = false

  if (battle.initiated || battle.confirming || (document.querySelector('#mainMenu') && document.querySelector('#mainMenu').style.display !== 'none')) return

  if (keys.w.pressed && lastKey === 'w') {
    player.animate = true
    player.image = player.sprites.up

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: 0, y: 3 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x,
              y: boundary.position.y + 3
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving) {
      movables.forEach((movable) => {
        movable.position.y += 3
      })
    }
  } else if (keys.a.pressed && lastKey === 'a') {
    player.animate = true
    player.image = player.sprites.left

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: 3, y: 0 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x + 3,
              y: boundary.position.y
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving) {
      movables.forEach((movable) => {
        movable.position.x += 3
      })
    }
  } else if (keys.s.pressed && lastKey === 's') {
    player.animate = true
    player.image = player.sprites.down

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: 0, y: -3 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x,
              y: boundary.position.y - 3
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving) {
      movables.forEach((movable) => {
        movable.position.y -= 3
      })
    }
  } else if (keys.d.pressed && lastKey === 'd') {
    player.animate = true
    player.image = player.sprites.right

    checkForCharacterCollision({
      characters,
      player,
      characterOffset: { x: -3, y: 0 }
    })

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i]
      if (
        rectangularCollision({
          rectangle1: player,
          rectangle2: {
            ...boundary,
            position: {
              x: boundary.position.x - 3,
              y: boundary.position.y
            }
          }
        })
      ) {
        moving = false
        break
      }
    }

    if (moving) {
      movables.forEach((movable) => {
        movable.position.x -= 3
      })
    }
  }
}

let farmUiLastRefresh = 0
let farmMessageTimeoutId = 0
let harukaNarrationTimeoutId = 0
let currentEconomyView = 'harvest'
let farmHintOverride = {
  text: '',
  expiresAt: 0
}

const HARUKA_EVENT_SCRIPTS = {
  loginGranted: [
    ({ shortAddress }) => `Welcome back, ${shortAddress}. The gates are open and the farm remembers you.`,
    ({ shortAddress }) => `I checked your wallet, ${shortAddress}. You are clear to enter Haruka's Realm.`
  ],
  loginDenied: [
    ({ balance }) => `I can see ${formatHarukaAmount(balance)} $HARUKA right now. We still need 1,000 before I can open the realm.`,
    ({ balance }) => `The wallet is connected, but only ${formatHarukaAmount(balance)} $HARUKA is showing. Bring it above the gate and I will let you in.`
  ],
  plant: [
    ({ cropLabel, zoneLabel }) => `${cropLabel} is in the soil at ${zoneLabel}. I will keep an eye on that patch for you.`,
    ({ cropLabel }) => `${cropLabel} planted. Good choice. It should keep the harvest loop moving.`
  ],
  harvest: [
    ({ cropCount, harukaAmount }) => `Clean harvest. ${cropCount} plots converted into ${formatHarukaAmount(harukaAmount)} unclaimed $HARUKA.`,
    ({ goldAmount }) => `That run looked efficient. Gold is up by ${goldAmount} and the farm pace is holding.`
  ],
  lucky: [
    ({ cropLabel, harukaAmount }) => `Lucky break. ${cropLabel} doubled the reward and pushed ${formatHarukaAmount(harukaAmount)} $HARUKA into your stack.`
  ],
  superLucky: [
    ({ cropLabel, harukaAmount }) => `That was a real spike. ${cropLabel} hit super lucky and dumped ${formatHarukaAmount(harukaAmount)} $HARUKA at once.`
  ],
  jackpot: [
    ({ cropLabel, harukaAmount }) => `Jackpot confirmed. ${cropLabel} just exploded into ${formatHarukaAmount(harukaAmount)} $HARUKA. Screenshot-worthy.`
  ],
  streakMilestone: [
    ({ streakDays, streakMultiplier }) => `Day ${streakDays} streak. The reward engine is running at ${streakMultiplier.toFixed(1)}x now.`,
    ({ streakDays }) => `You held the streak through day ${streakDays}. That consistency is compounding.`
  ],
  dailyCap: [
    ({ dailyCap }) => `Daily harvest cap reached at ${formatHarukaAmount(dailyCap)} $HARUKA. Next step is inventory management or marketplace prep.`
  ],
  claim: [
    ({ netClaimed, burned }) => `Claim ledger updated. ${formatHarukaAmount(netClaimed)} $HARUKA is queued net and ${formatHarukaAmount(burned)} was marked for burn.`,
    ({ netClaimed }) => `Claim request staged locally for ${formatHarukaAmount(netClaimed)} $HARUKA. Treasury settlement still belongs to the backend.`
  ],
  levelUp: [
    ({ level }) => `Level ${level}. The farm is scaling with you now.`,
    ({ level }) => `You just hit level ${level}. I can feel the loop tightening.`
  ],
  sellInventory: [
    ({ goldAmount, cropCount }) => `Inventory cleared into ${goldAmount} gold across ${cropCount} crops. Clean shop turnover.`,
    ({ goldAmount }) => `Shop sale completed. ${goldAmount} gold is back in circulation for seeds and expansion.`
  ],
  walletDisconnected: [
    () => `Wallet link removed. I switched the farm back to local guest mode.`
  ]
}

function pickHarukaScript(eventKey, payload = {}) {
  const candidates = HARUKA_EVENT_SCRIPTS[eventKey]
  if (!Array.isArray(candidates) || !candidates.length) {
    return ''
  }

  const candidate = candidates[Math.floor(Math.random() * candidates.length)]
  return typeof candidate === 'function' ? candidate(payload) : String(candidate)
}

function triggerHarukaNarration(eventKey, payload = {}) {
  if (!farmUi.dialogueBox || battle.initiated || player.isInteracting) {
    return
  }

  const message = pickHarukaScript(eventKey, payload)
  if (!message) {
    return
  }

  farmUi.dialogueBox.innerHTML = message
  farmUi.dialogueBox.style.display = 'flex'
  window.clearTimeout(harukaNarrationTimeoutId)
  harukaNarrationTimeoutId = window.setTimeout(() => {
    if (!player.isInteracting) {
      farmUi.dialogueBox.style.display = 'none'
    }
  }, 5000)
}

function getPlayerLevel() {
  if (!farmState) return 1
  const xp = farmState.xp || 0
  let level = 1
  if (xp >= 3500) level = 10
  else if (xp >= 2600) level = 9
  else if (xp >= 1900) level = 8
  else if (xp >= 1350) level = 7
  else if (xp >= 900) level = 6
  else if (xp >= 560) level = 5
  else if (xp >= 320) level = 4
  else if (xp >= 150) level = 3
  else if (xp >= 50) level = 2
  return level
}

function createFarmPlots() {
  return FARM_PLOT_BLUEPRINTS.map((blueprint) => ({
    id: blueprint.id,
    fieldId: blueprint.fieldId,
    position: {
      x: blueprint.tileX * Boundary.width + offset.x,
      y: blueprint.tileY * Boundary.height + offset.y
    },
    width: FARM_TILE_SIZE,
    height: FARM_TILE_SIZE,
    draw() {
      drawFarmPlot(this)
    }
  }))
}

function createFarmZones() {
  return FARM_FIELDS.map((field) => {
    const fieldPlots = farmPlots.filter((plot) => plot.fieldId === field.id)
    const xPositions = fieldPlots.map((plot) => plot.position.x)
    const yPositions = fieldPlots.map((plot) => plot.position.y)
    const minX = Math.min(...xPositions)
    const maxX = Math.max(...xPositions)
    const minY = Math.min(...yPositions)
    const maxY = Math.max(...yPositions)

    return {
      id: field.id,
      label: field.label,
      plotIds: fieldPlots.map((plot) => plot.id),
      position: {
        x: minX - 24,
        y: minY - 24
      },
      width: maxX - minX + FARM_TILE_SIZE + 48,
      height: maxY - minY + FARM_TILE_SIZE + 48
    }
  })
}

function drawFarmPlot(plot) {
  const plotState = farmState.plots[plot.id]
  if (!plotState) {
    return
  }

  c.save()
  c.globalAlpha = isFarmPlotEmpty(plotState) ? 0.26 : 0.18
  c.fillStyle = '#3d6c38'
  c.fillRect(plot.position.x + 6, plot.position.y + 30, plot.width - 12, plot.height - 14)
  c.globalAlpha = 0.38
  c.fillStyle = '#6f8f42'
  c.fillRect(plot.position.x + 10, plot.position.y + 34, plot.width - 20, 2)
  c.fillRect(plot.position.x + 10, plot.position.y + 40, plot.width - 20, 2)
  c.restore()

  if (isFarmPlotEmpty(plotState) || !farmPlantsImage.complete) {
    return
  }

  const crop = FARM_CROPS[plotState.cropKey]
  const stage = getFarmPlotStage(plotState)

  c.drawImage(
    farmPlantsImage,
    stage * FARM_SPRITE_SIZE,
    crop.row * FARM_SPRITE_SIZE,
    FARM_SPRITE_SIZE,
    FARM_SPRITE_SIZE,
    plot.position.x,
    plot.position.y,
    FARM_TILE_SIZE,
    FARM_TILE_SIZE
  )
}

function getFarmPlotStage(plotState) {
  const progress = getFarmPlotProgress(plotState)
  return Math.min(4, Math.floor(progress * 5))
}

function isFarmPlotEmpty(plotState) {
  return !plotState?.cropKey
}

function getFarmPlotProgress(plotState) {
  if (isFarmPlotEmpty(plotState)) {
    return 0
  }

  const crop = FARM_CROPS[plotState.cropKey]
  const elapsed = Date.now() - plotState.plantedAt
  return Math.max(0, Math.min(1, elapsed / crop.growMs))
}

function getReadyFarmPlots(zone) {
  return zone.plotIds.filter((plotId) => {
    const plotState = farmState.plots[plotId]
    return !isFarmPlotEmpty(plotState) && getFarmPlotProgress(plotState) >= 1
  })
}

function getEmptyFarmPlots(zone) {
  return zone.plotIds.filter((plotId) => isFarmPlotEmpty(farmState.plots[plotId]))
}

function getTotalReadyPlotCount() {
  return Object.values(farmState.plots).filter((plotState) => !isFarmPlotEmpty(plotState) && getFarmPlotProgress(plotState) >= 1).length
}

function getTotalEmptyPlotCount() {
  return Object.values(farmState.plots).filter((plotState) => isFarmPlotEmpty(plotState)).length
}

function getTotalPlantedPlotCount() {
  return FARM_PLOT_BLUEPRINTS.length - getTotalEmptyPlotCount()
}

function getSoonestHarvestSeconds(zone) {
  const candidatePlotIds = zone ? zone.plotIds : Object.keys(farmState.plots)
  let smallestMs = Number.POSITIVE_INFINITY

  candidatePlotIds.forEach((plotId) => {
    const plotState = farmState.plots[plotId]
    if (isFarmPlotEmpty(plotState)) {
      return
    }

    const crop = FARM_CROPS[plotState.cropKey]
    const remainingMs = Math.max(0, crop.growMs - (Date.now() - plotState.plantedAt))
    if (remainingMs < smallestMs) {
      smallestMs = remainingMs
    }
  })

  if (!Number.isFinite(smallestMs)) {
    return 0
  }

  return Math.ceil(smallestMs / 1000)
}

function syncFarmInteractionZone() {
  player.farmInteractionZone = null

  for (let i = 0; i < farmZones.length; i++) {
    const zone = farmZones[i]
    if (
      rectangularCollision({
        rectangle1: player,
        rectangle2: zone
      })
    ) {
      player.farmInteractionZone = zone
      break
    }
  }
}

function loadFarmState(customWalletAddress) {
  const baseState = createBaseFarmState()
  let key = 'haruka-realm-canvas-farm-v1'

  if (customWalletAddress) {
    key = `haruka-realm-canvas-farm-v1-${customWalletAddress}`
  } else {
    try {
      const rawContext = window.localStorage.getItem('haruka.portfolio.context.v1')
      if (rawContext) {
        const context = JSON.parse(rawContext)
        if (context && context.walletAddress) {
          key = `haruka-realm-canvas-farm-v1-${context.walletAddress}`
        }
      }
    } catch (_) {}
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      // If we connected a wallet, but it has no saved progress yet,
      // copy the guest progress (from 'haruka-realm-canvas-farm-v1') to this wallet
      // so the player doesn't lose their work!
      if (key !== 'haruka-realm-canvas-farm-v1') {
        const guestRaw = window.localStorage.getItem('haruka-realm-canvas-farm-v1')
        if (guestRaw) {
          const parsed = JSON.parse(guestRaw)
          const normalized = normalizeFarmState(parsed, baseState)
          // Save it immediately for this wallet
          window.localStorage.setItem(key, JSON.stringify(normalized))
          return normalized
        }
      }
      return baseState
    }

    const parsed = JSON.parse(raw)
    return normalizeFarmState(parsed, baseState)
  } catch (_error) {
    return baseState
  }
}

function getFarmStorageKey() {
  try {
    const raw = window.localStorage.getItem('haruka.portfolio.context.v1')
    if (raw) {
      const context = JSON.parse(raw)
      if (context && context.walletAddress) {
        return `haruka-realm-canvas-farm-v1-${context.walletAddress}`
      }
    }
  } catch (_) {}
  return 'haruka-realm-canvas-farm-v1'
}

function persistFarmState() {
  const key = getFarmStorageKey()
  window.localStorage.setItem(key, JSON.stringify(farmState))
}

function toFiniteFarmNumber(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function getFarmDateKey(offsetDays = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function createEmptyInventory() {
  return FARM_SEED_ORDER.reduce((inventory, seedKey) => {
    inventory[seedKey] = 0
    return inventory
  }, {})
}

function normalizeInventory(value) {
  const inventory = createEmptyInventory()
  FARM_SEED_ORDER.forEach((seedKey) => {
    inventory[seedKey] = Math.max(0, Math.floor(toFiniteFarmNumber(value?.[seedKey], 0)))
  })
  return inventory
}

function createDailyRewards(date = getFarmDateKey()) {
  return {
    date,
    earned: 0,
    claimed: 0,
    claimCount: 0
  }
}

function normalizeDailyRewards(value) {
  const today = getFarmDateKey()
  if (!value || value.date !== today) {
    return createDailyRewards(today)
  }

  return {
    date: today,
    earned: Math.max(0, toFiniteFarmNumber(value.earned, 0)),
    claimed: Math.max(0, toFiniteFarmNumber(value.claimed, 0)),
    claimCount: Math.max(0, Math.floor(toFiniteFarmNumber(value.claimCount, 0)))
  }
}

function getDailyCapFromPool(poolBalance) {
  if (poolBalance > 400000) return 1000
  if (poolBalance > 200000) return 600
  if (poolBalance > 50000) return 300
  if (poolBalance > 10000) return 100
  return 0
}

function getDailyCapForState() {
  return getDailyCapFromPool(farmState?.rewardPoolBalance ?? HARUKA_INITIAL_REWARD_POOL)
}

function getStreakMultiplier(consecutiveDays) {
  if (consecutiveDays >= 7) return 1.7
  if (consecutiveDays >= 5) return 1.4
  if (consecutiveDays >= 3) return 1.2
  if (consecutiveDays >= 2) return 1.1
  return 1.0
}

function rollLuckyHarvest() {
  const roll = Math.random()
  if (roll < 0.005) return { type: 'jackpot', multi: 10, label: 'JACKPOT' }
  if (roll < 0.03) return { type: 'super_lucky', multi: 5, label: 'SUPER LUCKY' }
  if (roll < 0.15) return { type: 'lucky', multi: 2, label: 'LUCKY' }
  return { type: 'normal', multi: 1, label: 'Normal' }
}

function formatHarukaAmount(value) {
  const amount = Math.max(0, toFiniteFarmNumber(value, 0))
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}

function getWalletHarukaBalance() {
  const wallet = getWalletContext()
  return Math.max(0, toFiniteFarmNumber(wallet?.haruka, 0))
}

function hasHarukaGameAccess() {
  return getWalletHarukaBalance() >= HARUKA_MIN_HOLD_TO_PLAY
}

function getAccessGateMessage() {
  const balance = getWalletHarukaBalance()
  if (!getWalletContext()) {
    return `Connect a Solana wallet holding at least ${HARUKA_MIN_HOLD_TO_PLAY} $HARUKA to enter Haruka's Realm.`
  }

  return `Hold at least ${HARUKA_MIN_HOLD_TO_PLAY} $HARUKA to enter. Current balance: ${formatHarukaAmount(balance)} $HARUKA.`
}

function getHolderRevenueBoost(balance) {
  if (balance >= 5000000) return 1.15
  if (balance >= 1000000) return 1.1
  if (balance >= 100000) return 1.05
  return 1.0
}

function getInventoryEntries() {
  const inventory = normalizeInventory(farmState.inventory)
  return FARM_SEED_ORDER
    .map((cropKey) => ({ cropKey, quantity: inventory[cropKey], crop: FARM_CROPS[cropKey] }))
    .filter((entry) => entry.quantity > 0)
}

function getInventoryMarketSnapshot() {
  const entries = getInventoryEntries()
  return entries.reduce((summary, entry) => {
    summary.cropCount += entry.quantity
    summary.shopValue += entry.quantity * entry.crop.sellPrice
    summary.referenceHarukaValue += entry.quantity * entry.crop.harukaReward
    return summary
  }, {
    cropCount: 0,
    shopValue: 0,
    referenceHarukaValue: 0
  })
}

function formatInventorySummaryText() {
  const entries = getInventoryEntries()
  if (!entries.length) {
    return 'No crops stored.'
  }

  return entries
    .map((entry) => `${entry.crop.label} x${entry.quantity}`)
    .join(' | ')
}

function setEconomyView(nextView) {
  if (!nextView || currentEconomyView === nextView) {
    return
  }

  currentEconomyView = nextView
  updateEconomyUi()
}

function sellAllInventoryToShop() {
  const snapshot = getInventoryMarketSnapshot()
  if (!snapshot.cropCount) {
    showFarmStatusMessage('No crop inventory is ready for the shop yet.')
    updateFarmUi(true)
    return
  }

  farmState.gold += snapshot.shopValue
  farmState.inventory = createEmptyInventory()
  persistFarmState()
  showFarmStatusMessage(`Sold ${snapshot.cropCount} stored crops to the shop for ${snapshot.shopValue}g.`)
  triggerHarukaNarration('sellInventory', {
    goldAmount: snapshot.shopValue,
    cropCount: snapshot.cropCount
  })
  updateFarmUi(true)
}
function refreshDailyRewards() {
  farmState.dailyRewards = normalizeDailyRewards(farmState.dailyRewards)
  return farmState.dailyRewards
}

function updateHarvestStreak() {
  const today = getFarmDateKey()
  const yesterday = getFarmDateKey(-1)

  if (farmState.lastHarvestDate === today) {
    return farmState.loginStreak || 1
  }

  farmState.loginStreak = farmState.lastHarvestDate === yesterday ? (farmState.loginStreak || 0) + 1 : 1
  farmState.lastHarvestDate = today
  return farmState.loginStreak
}

function recordInventoryHarvest(cropKey, quantity = 1) {
  farmState.inventory = normalizeInventory(farmState.inventory)
  farmState.inventory[cropKey] = (farmState.inventory[cropKey] || 0) + quantity
}

function creditHarukaHarvestReward({ cropKey, crop, plotId, plantedAt, streakMultiplier, luckyRoll, remainingDailyCap }) {
  const uncappedReward = Math.round(crop.harukaReward * streakMultiplier * luckyRoll.multi)
  const reward = Math.max(0, Math.min(uncappedReward, remainingDailyCap, farmState.rewardPoolBalance || 0))
  const now = Date.now()

  farmState.unclaimedHaruka += reward
  farmState.totalEarnedHaruka += reward
  farmState.rewardPoolBalance = Math.max(0, farmState.rewardPoolBalance - reward)
  farmState.dailyRewards.earned += reward
  farmState.harvestLog.unshift({
    cropKey,
    plotId,
    plantedAt,
    harvestedAt: now,
    baseReward: crop.harukaReward,
    streakMultiplier,
    luckyMultiplier: luckyRoll.multi,
    luckyType: luckyRoll.type,
    finalReward: reward,
    uncappedReward
  })
  farmState.harvestLog = farmState.harvestLog.slice(0, 30)

  return { reward, uncappedReward }
}

async function claimHarukaRewards() {
  refreshDailyRewards()
  const wallet = getWalletContext()
  if (!wallet?.walletAddress) {
    showFarmStatusMessage('Connect your wallet first so rewards can be claimed to the correct address.')
    updateFarmUi(true)
    return
  }

  if (claimRequestPending) {
    showFarmStatusMessage('Reward claim already in progress.')
    updateFarmUi(true)
    return
  }

  const claimable = Math.floor(farmState.unclaimedHaruka)
  if (claimable < HARUKA_MIN_CLAIM) {
    showFarmStatusMessage(`Claim minimum is ${HARUKA_MIN_CLAIM} $HARUKA. Unclaimed: ${formatHarukaAmount(farmState.unclaimedHaruka)} $HARUKA.`)
    updateFarmUi(true)
    return
  }

  claimRequestPending = true
  showFarmStatusMessage(`Submitting on-chain claim for ${formatHarukaAmount(claimable)} $HARUKA...`)
  updateFarmUi(true)

  try {
    const payload = await fetchRewardClaim(wallet.walletAddress, claimable, HARUKA_REWARD_CLAIM_TIMEOUT_MS)
    const grossClaimed = Number.parseFloat(String(payload?.claim?.grossUi || claimable)) || claimable
    const netClaimed = Number.parseFloat(String(payload?.claim?.netUi || 0)) || 0
    const burned = Number.parseFloat(String(payload?.claim?.burnedUi || 0)) || 0
    const transferSignature = String(payload?.transfer?.signature || '').trim()
    applyAuthoritativeRewardStatePayload(payload, { persist: false })

    const refreshedContext = await refreshWalletContextFromChain(wallet.walletAddress, wallet.walletProvider).catch((error) => {
      console.warn('Wallet snapshot refresh after claim failed:', error)
      return null
    })

    persistFarmState()
    const signaturePreview = transferSignature ? ` Tx ${formatWalletAddress(transferSignature)}.` : ''
    const refreshSuffix = refreshedContext ? ' Wallet balance has been refreshed from chain.' : ''
    showFarmStatusMessage(`Claim complete: ${formatHarukaAmount(netClaimed)} $HARUKA sent, ${formatHarukaAmount(burned)} burned.${signaturePreview}${refreshSuffix}`)
    triggerHarukaNarration('claim', { netClaimed, burned })
  } catch (error) {
    console.error(error)
    showFarmStatusMessage(`Reward claim failed: ${error instanceof Error ? error.message : 'Unknown error.'}`)
  } finally {
    claimRequestPending = false
    updateFarmUi(true)
  }
}

function updateEconomyUi() {
  refreshDailyRewards()
  const wallet = getWalletContext()
  const walletBalance = getWalletHarukaBalance()
  const dailyCap = getDailyCapForState()
  const remainingDaily = Math.max(0, dailyCap - farmState.dailyRewards.earned)
  const hasAccess = hasHarukaGameAccess()
  const inventorySnapshot = getInventoryMarketSnapshot()
  const revenueBoost = getHolderRevenueBoost(walletBalance)
  const estimatedRevenueShare = Math.floor((farmState.marketStats.revenueSharePool || 0) * (walletBalance / REVENUE_SHARE_REFERENCE_SUPPLY) * revenueBoost)

  if (farmUi.harukaValue) {
    farmUi.harukaValue.textContent = `${formatHarukaAmount(walletBalance)} $HARUKA`
  }

  if (farmUi.unclaimedValue) {
    farmUi.unclaimedValue.textContent = `${formatHarukaAmount(farmState.unclaimedHaruka)} $HARUKA`
  }

  if (farmUi.dailyCapValue) {
    farmUi.dailyCapValue.textContent = `${formatHarukaAmount(farmState.dailyRewards.earned)} / ${formatHarukaAmount(dailyCap)}`
  }

  if (farmUi.streakValue) {
    const streak = farmState.loginStreak || 0
    farmUi.streakValue.textContent = `Day ${streak || 1} (${getStreakMultiplier(streak || 1).toFixed(1)}x)`
  }

  if (farmUi.claimButton) {
    const walletConnected = Boolean(wallet?.walletAddress)
    const rewardProofReady = walletConnected && Boolean(getStoredRewardProof(wallet.walletAddress))
    farmUi.claimButton.disabled = claimRequestPending || !rewardProofReady || farmState.unclaimedHaruka < HARUKA_MIN_CLAIM
    if (claimRequestPending) {
      farmUi.claimButton.textContent = 'Claiming...'
    } else if (walletConnected && !rewardProofReady) {
      farmUi.claimButton.textContent = 'Syncing reward proof...'
    } else if (!walletConnected) {
      farmUi.claimButton.textContent = 'Connect wallet to claim'
    } else {
      farmUi.claimButton.textContent = farmState.unclaimedHaruka >= HARUKA_MIN_CLAIM ? 'Claim Rewards' : `Claim at ${HARUKA_MIN_CLAIM}`
    }
  }

  if (farmUi.economyGate) {
    farmUi.economyGate.hidden = hasAccess
  }

  if (farmUi.economyGateBalance) {
    farmUi.economyGateBalance.textContent = `${formatHarukaAmount(walletBalance)} $HARUKA`
  }

  if (farmUi.economyGateStatus) {
    farmUi.economyGateStatus.textContent = hasAccess ? `Access granted. ${formatHarukaAmount(remainingDaily)} $HARUKA reward cap remains today.` : getAccessGateMessage()
  }

  if (farmUi.marketInventoryValue) {
    farmUi.marketInventoryValue.textContent = formatInventorySummaryText()
  }

  if (farmUi.marketShopValue) {
    farmUi.marketShopValue.textContent = `${inventorySnapshot.shopValue}g`
  }

  if (farmUi.marketSellerValue) {
    farmUi.marketSellerValue.textContent = `${formatHarukaAmount(inventorySnapshot.referenceHarukaValue * MARKETPLACE_FEE_SPLIT.seller)} $HARUKA`
  }

  if (farmUi.marketRevenueValue) {
    farmUi.marketRevenueValue.textContent = `${formatHarukaAmount(inventorySnapshot.referenceHarukaValue * MARKETPLACE_FEE_SPLIT.revenue)} $HARUKA`
  }

  if (farmUi.marketBurnValue) {
    farmUi.marketBurnValue.textContent = `${formatHarukaAmount(inventorySnapshot.referenceHarukaValue * MARKETPLACE_FEE_SPLIT.burn)} $HARUKA`
  }

  if (farmUi.marketRefillValue) {
    farmUi.marketRefillValue.textContent = `${formatHarukaAmount(inventorySnapshot.referenceHarukaValue * MARKETPLACE_FEE_SPLIT.rewardPool)} $HARUKA`
  }

  if (farmUi.marketStatusValue) {
    farmUi.marketStatusValue.textContent = inventorySnapshot.cropCount
      ? `Local inventory is ready. Marketplace listing and SPL settlement still need backend routes.`
      : 'Harvest crops first. Inventory appears here before shop sale or marketplace listing.'
  }

  if (farmUi.sellInventoryButton) {
    farmUi.sellInventoryButton.disabled = inventorySnapshot.cropCount === 0
  }

  if (farmUi.revenueWeekPoolValue) {
    farmUi.revenueWeekPoolValue.textContent = `${formatHarukaAmount(farmState.marketStats.revenueSharePool || 0)} $HARUKA`
  }

  if (farmUi.revenueEstimateValue) {
    farmUi.revenueEstimateValue.textContent = walletBalance >= HARUKA_MIN_HOLD_TO_PLAY
      ? `${formatHarukaAmount(estimatedRevenueShare)} $HARUKA (local est.)`
      : 'Hold 1,000+ $HARUKA to qualify.'
  }

  if (farmUi.revenueNextValue) {
    farmUi.revenueNextValue.textContent = 'Sunday 00:00 UTC'
  }

  if (farmUi.revenueBoostValue) {
    farmUi.revenueBoostValue.textContent = `${Math.round((revenueBoost - 1) * 100)}% holder boost`
  }

  farmUi.economyTabButtons.forEach((button) => {
    const isActive = button.dataset.economyView === currentEconomyView
    button.classList.toggle('is-active', isActive)
    button.setAttribute('aria-selected', isActive ? 'true' : 'false')
  })

  farmUi.economyPanels.forEach((panel) => {
    panel.hidden = panel.dataset.economyPanel !== currentEconomyView
  })

  const btnPlay = document.getElementById('btnPlayGame')
  const btnBattle = document.getElementById('btnEnterBattle')
  if (btnPlay) {
    btnPlay.disabled = !hasAccess
    btnPlay.title = hasAccess ? 'Enter Haruka Realm' : getAccessGateMessage()
  }
  if (btnBattle) {
    btnBattle.disabled = !hasAccess
    btnBattle.title = hasAccess ? 'Enter battle' : getAccessGateMessage()
  }

  const dropdownBalance = document.getElementById('walletDropdownBalance')
  if (dropdownBalance) {
    dropdownBalance.textContent = wallet ? `${formatHarukaAmount(walletBalance)} $HARUKA` : 'Not Connected'
  }
}
function createBaseFarmState() {
  const plots = {}

  FARM_PLOT_BLUEPRINTS.forEach((blueprint) => {
    plots[blueprint.id] = {
      cropKey: null,
      plantedAt: null
    }
  })

  return {
    gold: 100,
    harvests: 0,
    xp: 0,
    selectedSeed: 'carrot',
    plots,
    inventory: createEmptyInventory(),
    unclaimedHaruka: 0,
    totalEarnedHaruka: 0,
    totalClaimedHaruka: 0,
    totalBurnedHaruka: 0,
    rewardPoolBalance: HARUKA_INITIAL_REWARD_POOL,
    loginStreak: 0,
    lastHarvestDate: null,
    dailyRewards: createDailyRewards(),
    harvestLog: [],
    claimTransactions: [],
    marketStats: {
      marketplaceVolume: 0,
      revenueSharePool: 0,
      burnedFromTrades: 0,
      rewardPoolRefill: 0
    }
  }
}

function normalizeFarmState(parsed, fallbackState) {
  const plots = {}

  FARM_PLOT_BLUEPRINTS.forEach((blueprint) => {
    const savedPlot = parsed?.plots?.[blueprint.id]
    plots[blueprint.id] = {
      cropKey:
        savedPlot?.cropKey === null
          ? null
          : FARM_CROPS[savedPlot?.cropKey]
            ? savedPlot.cropKey
            : null,
      plantedAt:
        typeof savedPlot?.plantedAt === 'number' && Number.isFinite(savedPlot.plantedAt)
          ? savedPlot.plantedAt
          : null
    }
  })

  return {
    gold:
      typeof parsed?.gold === 'number' && Number.isFinite(parsed.gold)
        ? parsed.gold
        : fallbackState.gold,
    harvests:
      typeof parsed?.harvests === 'number' && Number.isFinite(parsed.harvests)
        ? parsed.harvests
        : fallbackState.harvests,
    xp:
      typeof parsed?.xp === 'number' && Number.isFinite(parsed.xp)
        ? parsed.xp
        : fallbackState.xp,
    selectedSeed: FARM_CROPS[parsed?.selectedSeed] ? parsed.selectedSeed : fallbackState.selectedSeed,
    plots,
    inventory: normalizeInventory(parsed?.inventory || fallbackState.inventory),
    unclaimedHaruka: Math.max(0, toFiniteFarmNumber(parsed?.unclaimedHaruka, fallbackState.unclaimedHaruka)),
    totalEarnedHaruka: Math.max(0, toFiniteFarmNumber(parsed?.totalEarnedHaruka, fallbackState.totalEarnedHaruka)),
    totalClaimedHaruka: Math.max(0, toFiniteFarmNumber(parsed?.totalClaimedHaruka, fallbackState.totalClaimedHaruka)),
    totalBurnedHaruka: Math.max(0, toFiniteFarmNumber(parsed?.totalBurnedHaruka, fallbackState.totalBurnedHaruka)),
    rewardPoolBalance: Math.max(0, toFiniteFarmNumber(parsed?.rewardPoolBalance, fallbackState.rewardPoolBalance)),
    loginStreak: Math.max(0, Math.floor(toFiniteFarmNumber(parsed?.loginStreak, fallbackState.loginStreak))),
    lastHarvestDate: typeof parsed?.lastHarvestDate === 'string' ? parsed.lastHarvestDate : fallbackState.lastHarvestDate,
    dailyRewards: normalizeDailyRewards(parsed?.dailyRewards || fallbackState.dailyRewards),
    harvestLog: Array.isArray(parsed?.harvestLog) ? parsed.harvestLog.slice(0, 30) : fallbackState.harvestLog,
    claimTransactions: Array.isArray(parsed?.claimTransactions) ? parsed.claimTransactions.slice(0, 20) : fallbackState.claimTransactions,
    marketStats: {
      marketplaceVolume: Math.max(0, toFiniteFarmNumber(parsed?.marketStats?.marketplaceVolume, fallbackState.marketStats.marketplaceVolume)),
      revenueSharePool: Math.max(0, toFiniteFarmNumber(parsed?.marketStats?.revenueSharePool, fallbackState.marketStats.revenueSharePool)),
      burnedFromTrades: Math.max(0, toFiniteFarmNumber(parsed?.marketStats?.burnedFromTrades, fallbackState.marketStats.burnedFromTrades)),
      rewardPoolRefill: Math.max(0, toFiniteFarmNumber(parsed?.marketStats?.rewardPoolRefill, fallbackState.marketStats.rewardPoolRefill))
    }
  }
}



async function harvestFarmZone(zone) {
  if (!hasHarukaGameAccess()) {
    showFarmStatusMessage(getAccessGateMessage())
    updateFarmUi(true)
    return
  }

  const wallet = getWalletContext()
  if (!wallet?.walletAddress) {
    showFarmStatusMessage('Connect your wallet first so server reward validation can run.')
    updateFarmUi(true)
    return
  }

  if (rewardStateRequestPending || claimRequestPending) {
    showFarmStatusMessage('Reward state sync is already running. Please wait a moment.')
    updateFarmUi(true)
    return
  }

  const readyPlotIds = getReadyFarmPlots(zone)

  if (!readyPlotIds.length) {
    const emptyCount = getEmptyFarmPlots(zone).length
    if (emptyCount > 0) {
      showFarmStatusMessage(`No crops to harvest in ${zone.label}. Press Space to plant ${FARM_CROPS[farmState.selectedSeed].label}!`)
    } else {
      const nextSeconds = getSoonestHarvestSeconds(zone)
      showFarmStatusMessage(`${zone.label} is still growing. Next crop matures in ${formatFarmDuration(nextSeconds * 1000)} (Left click to harvest when ready).`)
    }
    updateFarmUi(true)
    return
  }

  refreshDailyRewards()
  rewardStateRequestPending = true

  try {
    const payload = await fetchRewardState(wallet.walletAddress, 'harvest', {
      zoneId: zone.id
    })
    const harvestEntries = Array.isArray(payload?.harvest?.entries) ? payload.harvest.entries : []
    if (!harvestEntries.length) {
      showFarmStatusMessage(`${zone.label} is still growing. Wait a moment and try harvesting again.`)
      applyAuthoritativeRewardStatePayload(payload)
      updateFarmUi(true)
      return
    }

    applyAuthoritativeRewardStatePayload(payload, { persist: false })

    const multiplier = getGoldMultiplier()
    const xpTable = {
      carrot: 5,
      potato: 10,
      tomato: 18,
      strawberry: 30,
      lettuce: 48,
      pumpkin: 75
    }

    let totalGold = 0
    let totalXp = 0
    let strongestLucky = null

    harvestEntries.forEach((entry) => {
      const crop = FARM_CROPS[entry.cropKey]
      if (!crop) {
        return
      }

      totalGold += Math.round(crop.sellPrice * multiplier)
      totalXp += xpTable[entry.cropKey] || 5
      recordInventoryHarvest(entry.cropKey, 1)

      if (entry.luckyMultiplier > 1 && (!strongestLucky || entry.luckyMultiplier > strongestLucky.multi)) {
        strongestLucky = {
          type: entry.luckyType,
          multi: entry.luckyMultiplier,
          label: String(entry.luckyType || 'normal').replace(/_/g, ' ').toUpperCase(),
          cropLabel: crop.label,
          reward: entry.finalReward
        }
      }
    })

    const oldLvl = getPlayerLevel()
    farmState.gold += totalGold
    farmState.harvests += harvestEntries.length
    farmState.xp = (farmState.xp || 0) + totalXp
    persistFarmState()

    const newLvl = getPlayerLevel()
    const totalHaruka = Number(payload?.harvest?.totalHaruka || 0)
    const streakDays = Number(payload?.harvest?.streakDays || farmState.loginStreak || 0)
    const streakMultiplier = Number(payload?.harvest?.streakMultiplier || 1)
    const dailyCap = Number(payload?.harvest?.dailyCap || getDailyCapForState())
    const bonusPercent = Math.round((multiplier - 1) * 100)
    const bonusText = bonusPercent > 0 ? ` (+${bonusPercent}% Holder Bonus!)` : ''
    const streakText = streakMultiplier > 1 ? `, streak ${streakMultiplier.toFixed(1)}x` : ''
    const harukaText = totalHaruka > 0 ? `, +${formatHarukaAmount(totalHaruka)} $HARUKA${streakText}` : ', daily $HARUKA cap reached'
    const luckyText = strongestLucky ? ` ${strongestLucky.label}: ${strongestLucky.cropLabel} x${strongestLucky.multi}.` : ''
    showFarmStatusMessage(`Harvested ${harvestEntries.length} plots in ${zone.label} for ${totalGold}g${bonusText}, +${totalXp} XP${harukaText}.${luckyText}`)

    if (totalHaruka <= 0) {
      triggerHarukaNarration('dailyCap', { dailyCap })
    } else if (strongestLucky?.type === 'jackpot') {
      triggerHarukaNarration('jackpot', { cropLabel: strongestLucky.cropLabel, harukaAmount: strongestLucky.reward })
    } else if (strongestLucky?.type === 'super_lucky') {
      triggerHarukaNarration('superLucky', { cropLabel: strongestLucky.cropLabel, harukaAmount: strongestLucky.reward })
    } else if (strongestLucky?.type === 'lucky') {
      triggerHarukaNarration('lucky', { cropLabel: strongestLucky.cropLabel, harukaAmount: strongestLucky.reward })
    } else if (STREAK_MILESTONES.has(streakDays)) {
      triggerHarukaNarration('streakMilestone', { streakDays, streakMultiplier })
    } else {
      triggerHarukaNarration('harvest', { cropCount: harvestEntries.length, harukaAmount: totalHaruka, goldAmount: totalGold })
    }

    updateFarmUi(true)
    triggerXpGainAnimation(totalXp)

    if (newLvl > oldLvl) {
      keys.w.pressed = false
      keys.a.pressed = false
      keys.s.pressed = false
      keys.d.pressed = false

      triggerLevelUpCelebration(newLvl, () => {
        const modal = document.querySelector('#battleConfirmModal')
        if (modal) {
          triggerHarukaNarration('levelUp', { level: newLvl })
          modal.querySelector('.rpg-confirm-title').textContent = 'LEVEL UP!'
          modal.querySelector('.rpg-confirm-text').textContent = `Congratulations! You reached Level ${newLvl}! Do you want to enter the Battle Zone to earn bonus XP and Gold?`
          modal.style.display = 'flex'
          battle.confirming = true
        }
      })
    }
  } catch (error) {
    console.error(error)
    showFarmStatusMessage(`Harvest sync failed: ${error instanceof Error ? error.message : 'Unknown error.'}`)
    updateFarmUi(true)
  } finally {
    rewardStateRequestPending = false
  }
}

async function plantFarmZone(zone) {
  if (!hasHarukaGameAccess()) {
    showFarmStatusMessage(getAccessGateMessage())
    updateFarmUi(true)
    return
  }

  const wallet = getWalletContext()
  if (!wallet?.walletAddress) {
    showFarmStatusMessage('Connect your wallet first so server reward validation can run.')
    updateFarmUi(true)
    return
  }

  if (rewardStateRequestPending || claimRequestPending) {
    showFarmStatusMessage('Reward state sync is already running. Please wait a moment.')
    updateFarmUi(true)
    return
  }

  const emptyPlotIds = getEmptyFarmPlots(zone)
  if (!emptyPlotIds.length) {
    showFarmStatusMessage(`${zone.label} has no empty soil right now.`)
    updateFarmUi(true)
    return
  }

  const selectedCrop = FARM_CROPS[farmState.selectedSeed]
  const playerLvl = getPlayerLevel()
  if (playerLvl < selectedCrop.level) {
    showFarmStatusMessage(`Locked: ${selectedCrop.label} requires Level ${selectedCrop.level}! Current level: ${playerLvl}.`)
    updateFarmUi(true)
    return
  }

  if (farmState.gold < selectedCrop.cost) {
    showFarmStatusMessage(`You need ${selectedCrop.cost}g to plant ${selectedCrop.label}. Current gold: ${farmState.gold}g.`)
    updateFarmUi(true)
    return
  }

  rewardStateRequestPending = true

  try {
    const payload = await fetchRewardState(wallet.walletAddress, 'plant', {
      zoneId: zone.id,
      cropKey: farmState.selectedSeed
    })
    applyAuthoritativeRewardStatePayload(payload, { persist: false })
    farmState.gold -= selectedCrop.cost
    persistFarmState()
    const plantedAt = Number(payload?.plant?.plantedAt || Date.now())
    showFarmStatusMessage(`Planted ${selectedCrop.label} in ${zone.label} for ${selectedCrop.cost}g. Grow time: ${formatFarmDuration(selectedCrop.growMs)}.`)
    if (farmState.plots[payload?.plant?.plotId]) {
      farmState.plots[payload.plant.plotId].plantedAt = plantedAt
    }
    updateFarmUi(true)
  } catch (error) {
    console.error(error)
    showFarmStatusMessage(`Plant sync failed: ${error instanceof Error ? error.message : 'Unknown error.'}`)
    updateFarmUi(true)
  } finally {
    rewardStateRequestPending = false
  }
}

function updateFarmUi(force = false) {
  const now = Date.now()
  if (!force && now - farmUiLastRefresh < 180) {
    return
  }
  farmUiLastRefresh = now

  const readyCount = getTotalReadyPlotCount()
  const emptyCount = getTotalEmptyPlotCount()
  const plantedCount = getTotalPlantedPlotCount()
  const activeZone = player.farmInteractionZone
  const selectedCrop = FARM_CROPS[farmState.selectedSeed]
  const actionSummary = getFarmActionSummary({
    activeZone,
    readyCount,
    emptyCount,
    selectedCrop
  })

  const levelBadge = document.querySelector('.rpg-level-badge')
  if (levelBadge) {
    levelBadge.textContent = `LV ${getPlayerLevel()}`
  }

  if (farmUi.xpBar && farmUi.xpValue) {
    const xp = farmState.xp || 0
    const level = getPlayerLevel()
    const thresholds = [0, 50, 150, 320, 560, 900, 1350, 1900, 2600, 3500]

    if (level >= 10) {
      farmUi.xpBar.style.width = '100%'
      farmUi.xpValue.textContent = 'MAX'
    } else {
      const minXp = thresholds[level - 1]
      const maxXp = thresholds[level]
      const levelXpRange = maxXp - minXp
      const currentLevelXp = Math.max(0, xp - minXp)
      const percent = Math.min(100, (currentLevelXp / levelXpRange) * 100)

      farmUi.xpBar.style.width = `${percent}%`
      farmUi.xpValue.textContent = `${currentLevelXp} / ${levelXpRange} XP`
    }
  }

  if (farmUi.goldValue) {
    farmUi.goldValue.textContent = `${farmState.gold}g`
  }

  if (farmUi.readyValue) {
    farmUi.readyValue.textContent = `${readyCount} plots`
  }

  if (farmUi.emptyValue) {
    farmUi.emptyValue.textContent = `${emptyCount} plots`
  }

  if (farmUi.seedValue) {
    farmUi.seedValue.textContent = selectedCrop.label
  }

  if (farmUi.fieldValue) {
    farmUi.fieldValue.textContent = `${plantedCount} / ${FARM_PLOT_BLUEPRINTS.length}`
  }

  if (farmUi.actionShortValue) {
    farmUi.actionShortValue.textContent = actionSummary.shortLabel
  }

  if (farmUi.actionValue) {
    farmUi.actionValue.textContent = actionSummary.detail
  }

  if (farmUi.modeValue) {
    farmUi.modeValue.textContent = actionSummary.modeLabel
  }

  if (farmUi.actionKeyBadge) {
    if (activeZone) {
      const activeReadyCount = getReadyFarmPlots(activeZone).length
      const activeEmptyCount = getEmptyFarmPlots(activeZone).length
      if (activeReadyCount > 0) {
        farmUi.actionKeyBadge.textContent = 'CLICK'
      } else if (activeEmptyCount > 0) {
        farmUi.actionKeyBadge.textContent = 'SPACE'
      } else {
        farmUi.actionKeyBadge.textContent = 'WAIT'
      }
    } else {
      farmUi.actionKeyBadge.textContent = 'INFO'
    }
  }

  if (farmUi.zoneValue) {
    farmUi.zoneValue.textContent = activeZone ? activeZone.label : 'Free roam'
  }

  if (farmUi.dashboard) {
    farmUi.dashboard.dataset.mode = actionSummary.dashboardMode
  }

  updateFarmSeedButtons()
  updateEconomyUi()

  if (farmUi.hintValue) {
    if (farmHintOverride.expiresAt > now && farmHintOverride.text) {
      farmUi.hintValue.textContent = farmHintOverride.text
    } else {
      farmUi.hintValue.textContent = actionSummary.hint
    }
  }
}

function getFarmActionSummary({ activeZone, readyCount, emptyCount, selectedCrop }) {
  if (activeZone) {
    const activeReadyCount = getReadyFarmPlots(activeZone).length
    const activeEmptyCount = getEmptyFarmPlots(activeZone).length

    if (activeReadyCount > 0) {
      return {
        shortLabel: 'Harvest',
        modeLabel: 'Harvest ready',
        dashboardMode: 'ready',
        detail: `Left click to harvest ${activeReadyCount} ready plots in ${activeZone.label}.`,
        hint: `Left click anywhere to harvest ${activeReadyCount} ready plots in ${activeZone.label}.`
      }
    }

    if (activeEmptyCount > 0) {
      return {
        shortLabel: 'Plant',
        modeLabel: `Plant ${selectedCrop.label}`,
        dashboardMode: 'empty',
        detail: `Space plants 1 ${selectedCrop.label} in ${activeZone.label} for ${selectedCrop.cost}g.`,
        hint: `Press Space to plant 1 ${selectedCrop.label} in ${activeZone.label} for ${selectedCrop.cost}g. Empty plots: ${activeEmptyCount}.`
      }
    }

    return {
      shortLabel: 'Wait',
      modeLabel: 'Growth in progress',
      dashboardMode: 'growing',
      detail: `${activeZone.label} is still growing. Next harvest in ${formatFarmDuration(getSoonestHarvestSeconds(activeZone) * 1000)}.`,
      hint: `${activeZone.label} is growing. Left click to harvest when ready.`
    }
  }

  if (readyCount > 0) {
    return {
      shortLabel: 'Harvest',
      modeLabel: 'Ready harvest',
      dashboardMode: 'ready',
      detail: `${readyCount} plots are ready. Walk into a patch and Left click to collect them.`,
      hint: `${readyCount} plots are ready. Walk into a patch and Left click to harvest them.`
    }
  }

  if (emptyCount > 0) {
    return {
      shortLabel: 'Replant',
      modeLabel: 'Manual replant',
      dashboardMode: 'empty',
      detail: `${emptyCount} empty plots need planting. Select seed (1-6 or Q/E) and press Space in a patch.`,
      hint: `${emptyCount} empty plots need planting. Walk into a patch and press Space to plant.`
    }
  }

  return {
    shortLabel: 'Grow',
    modeLabel: 'Growing cycle',
    dashboardMode: 'growing',
    detail: `${selectedCrop.label} costs ${selectedCrop.cost}g. Next harvest in ${formatFarmDuration(getSoonestHarvestSeconds() * 1000)}.`,
    hint: `All planted crops are growing. Next harvest in ${formatFarmDuration(getSoonestHarvestSeconds() * 1000)}.`
  }
}

function updateFarmSeedButtons() {
  if (!farmUi.seedButtons.length) {
    return
  }

  const playerLvl = getPlayerLevel()

  farmUi.seedButtons.forEach((button, index) => {
    const seedKey = button.dataset.farmSeed
    const crop = FARM_CROPS[seedKey]
    if (!crop) {
      return
    }

    const isActive = farmState.selectedSeed === seedKey
    button.classList.toggle('is-active', isActive)
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false')

    // Handle locked crop visuals and interactivity
    const isLocked = playerLvl < crop.level
    button.classList.toggle('is-locked', isLocked)
    
    const keySlot = button.querySelector('.farm-seed-button__key')
    const nameSlot = button.querySelector('.farm-seed-button__name')
    const metaSlots = button.querySelectorAll('.farm-seed-button__meta span')
    const iconSlot = button.querySelector('.seed-icon')

    if (iconSlot) {
      const defaultIcons = {
        carrot: 'CR',
        potato: 'PT',
        tomato: 'TM',
        strawberry: 'SB',
        lettuce: 'LT',
        pumpkin: 'PK'
      }
      iconSlot.textContent = isLocked ? 'LOCK' : defaultIcons[seedKey]
    }

    if (keySlot) {
      keySlot.textContent = String(index + 1)
    }

    if (nameSlot) {
      nameSlot.textContent = crop.label
    }

    if (metaSlots[0]) {
      metaSlots[0].textContent = isLocked ? `Lv ${crop.level}` : `${crop.cost}g`
      if (isLocked) {
        metaSlots[0].style.color = '#ff4d4f'
      } else {
        metaSlots[0].style.color = '' // Restore default
      }
    }

    if (metaSlots[1]) {
      metaSlots[1].textContent = isLocked ? 'LOCKED' : formatFarmDuration(crop.growMs)
      if (isLocked) {
        metaSlots[1].style.color = '#8a96a3'
      } else {
        metaSlots[1].style.color = '' // Restore default
      }
    }
  })
}

function showFarmStatusMessage(message) {
  farmHintOverride = {
    text: message,
    expiresAt: Date.now() + 1800
  }

  if (farmUi.hintValue) {
    farmUi.hintValue.textContent = message
  }

  if (!farmUi.dialogueBox || battle.initiated || player.isInteracting) {
    return
  }

  farmUi.dialogueBox.innerHTML = message
  farmUi.dialogueBox.style.display = 'flex'
  window.clearTimeout(farmMessageTimeoutId)
  farmMessageTimeoutId = window.setTimeout(() => {
    if (!player.isInteracting) {
      farmUi.dialogueBox.style.display = 'none'
    }
  }, 1800)
}

function setSelectedFarmSeed(seedKey) {
  if (!FARM_CROPS[seedKey] || farmState.selectedSeed === seedKey) {
    return
  }

  const crop = FARM_CROPS[seedKey]
  const playerLvl = getPlayerLevel()
  if (playerLvl < crop.level) {
    showFarmStatusMessage(`Locked: ${crop.label} requires Level ${crop.level}!`)
    return
  }

  farmState.selectedSeed = seedKey
  persistFarmState()
  showFarmStatusMessage(`Selected ${crop.label}. Plant cost is ${crop.cost}g with ${formatFarmDuration(crop.growMs)} grow time.`)
  updateFarmUi(true)
}

function cycleFarmSeed(step) {
  const currentIndex = FARM_SEED_ORDER.indexOf(farmState.selectedSeed)
  const playerLvl = getPlayerLevel()

  let idx = currentIndex
  for (let i = 0; i < FARM_SEED_ORDER.length; i++) {
    idx = (idx + step + FARM_SEED_ORDER.length) % FARM_SEED_ORDER.length
    const seedKey = FARM_SEED_ORDER[idx]
    if (playerLvl >= FARM_CROPS[seedKey].level) {
      setSelectedFarmSeed(seedKey)
      return
    }
  }
}

function formatFarmDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }

  if (seconds === 0) {
    return `${minutes}m`
  }

  return `${minutes}m ${seconds}s`
}

const normalizeControlKey = (key) => {
  switch (String(key).toLowerCase()) {
    case 'arrowup':
      return 'w'
    case 'arrowleft':
      return 'a'
    case 'arrowdown':
      return 's'
    case 'arrowright':
      return 'd'
    case ' ':
    case 'space':
    case 'spacebar':
      return 'space'
    default:
      return String(key).toLowerCase()
  }
}

let lastKey = ''
window.addEventListener('keydown', (e) => {
  const key = normalizeControlKey(e.key)

  if (key === 'escape' && !battle.initiated) {
    e.preventDefault()
    toggleMainMenu()
    return
  }

  if (battle.initiated || battle.confirming || (document.querySelector('#mainMenu') && document.querySelector('#mainMenu').style.display !== 'none')) return

  if (
    key === 'space' ||
    key === 'w' ||
    key === 'a' ||
    key === 's' ||
    key === 'd' ||
    key === 'q' ||
    key === 'e' ||
    /^[1-6]$/.test(key)
  ) {
    e.preventDefault()
  }

  if (player.isInteracting) {
    switch (key) {
      case 'space':
        player.interactionAsset.dialogueIndex++

        const { dialogueIndex, dialogue } = player.interactionAsset
        if (dialogueIndex <= dialogue.length - 1) {
          document.querySelector('#characterDialogueBox').innerHTML =
            player.interactionAsset.dialogue[dialogueIndex]
          return
        }

        player.isInteracting = false
        player.interactionAsset.dialogueIndex = 0
        document.querySelector('#characterDialogueBox').style.display = 'none'

        break
    }
    return
  }

  switch (key) {
    case 'space':
      if (player.interactionAsset) {
        const firstMessage = player.interactionAsset.dialogue[0]
        document.querySelector('#characterDialogueBox').innerHTML = firstMessage
        document.querySelector('#characterDialogueBox').style.display = 'flex'
        player.isInteracting = true
        break
      }

      if (!player.farmInteractionZone) return

      plantFarmZone(player.farmInteractionZone)
      break
    case 'q':
      cycleFarmSeed(-1)
      break
    case 'e':
      cycleFarmSeed(1)
      break
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
      setSelectedFarmSeed(FARM_SEED_ORDER[Number.parseInt(key, 10) - 1])
      break
    case 'w':
      keys.w.pressed = true
      lastKey = 'w'
      break
    case 'a':
      keys.a.pressed = true
      lastKey = 'a'
      break
    case 's':
      keys.s.pressed = true
      lastKey = 's'
      break
    case 'd':
      keys.d.pressed = true
      lastKey = 'd'
      break
  }
})

window.addEventListener('keyup', (e) => {
  const key = normalizeControlKey(e.key)
  if (battle.initiated || battle.confirming || (document.querySelector('#mainMenu') && document.querySelector('#mainMenu').style.display !== 'none')) return

  if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
    e.preventDefault()
  }

  switch (key) {
    case 'w':
      keys.w.pressed = false
      break
    case 'a':
      keys.a.pressed = false
      break
    case 's':
      keys.s.pressed = false
      break
    case 'd':
      keys.d.pressed = false
      break
  }
})

let clicked = false
addEventListener('click', (e) => {
  if (!clicked) {
    audio.Map.play()
    clicked = true
  }

  // If in battle, menu or dialogue, do not harvest
  if (battle.initiated || battle.confirming || player.isInteracting) return
  const mainMenu = document.querySelector('#mainMenu')
  if (mainMenu && mainMenu.style.display !== 'none') return

  // If clicking on buttons or interactive UI elements, ignore
  if (
    e.target.tagName === 'BUTTON' || 
    e.target.closest('button') || 
    e.target.closest('.rpg-hud-player') || 
    e.target.closest('.rpg-hud-tracker') || 
    e.target.closest('.rpg-hud-hotbar-container') || 
    e.target.closest('.rpg-controls-card') ||
    e.target.closest('.rpg-menu-modal')
  ) {
    return
  }

  // If player is in a farm interaction zone, left click will harvest
  if (player.farmInteractionZone) {
    harvestFarmZone(player.farmInteractionZone)
  }
})

// Battle start sequence handler
window.startBattleSequence = () => {
  battle.confirming = false
  battle.initiated = true

  window.cancelAnimationFrame(animationId)

  audio.Map.stop()
  audio.initBattle.play()
  audio.battle.play()

  gsap.to('#overlappingDiv', {
    opacity: 1,
    repeat: 3,
    yoyo: true,
    duration: 0.4,
    onComplete() {
      gsap.to('#overlappingDiv', {
        opacity: 1,
        duration: 0.4,
        onComplete() {
          initBattle()
          animateBattle()
          gsap.to('#overlappingDiv', {
            opacity: 0,
            duration: 0.4
          })
        }
      })
    }
  })
}

// Battle confirmation modal buttons (preserved for fallback/compatibility)
document.querySelector('#btnConfirmBattleYes').addEventListener('click', () => {
  document.querySelector('#battleConfirmModal').style.display = 'none'
  window.startBattleSequence()
})

document.querySelector('#btnConfirmBattleNo').addEventListener('click', () => {
  document.querySelector('#battleConfirmModal').style.display = 'none'
  battle.confirming = false
  battle.cooldown = Date.now() + 6000 // 6-second cooldown
})

// Main Menu control functions
function toggleMainMenu() {
  const menu = document.querySelector('#mainMenu')
  if (!menu) return

  if (menu.style.display === 'none') {
    openMainMenu()
  } else {
    closeMainMenu()
  }
}

function openMainMenu() {
  const menu = document.querySelector('#mainMenu')
  if (menu) {
    menu.style.display = 'flex'
    gsap.to(menu, { opacity: 1, pointerEvents: 'auto', duration: 0.3 })
    keys.w.pressed = false
    keys.a.pressed = false
    keys.s.pressed = false
    keys.d.pressed = false
    if (window.updateProfileAndRecords) {
      window.updateProfileAndRecords()
    }
  }
}

function closeMainMenu() {
  const menu = document.querySelector('#mainMenu')
  if (menu) {
    gsap.to(menu, {
      opacity: 0,
      pointerEvents: 'none',
      duration: 0.3,
      onComplete: () => {
        menu.style.display = 'none'
      }
    })
  }
}

// Expose getPlayerLevel globally
window.getPlayerLevel = getPlayerLevel

// Helper for XP gain floating text and HUD flash animation
function triggerXpGainAnimation(amount) {
  if (!amount) return

  // 1. Flash the XP bar row
  const xpBarRow = document.querySelector('.rpg-xp-row')
  if (xpBarRow) {
    xpBarRow.style.transform = 'scale(1.1)'
    xpBarRow.style.borderColor = '#00e5ff'
    xpBarRow.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.8)'
    xpBarRow.style.transition = 'all 0.1s ease-out'
    setTimeout(() => {
      xpBarRow.style.transform = 'none'
      xpBarRow.style.borderColor = ''
      xpBarRow.style.boxShadow = ''
      xpBarRow.style.transition = 'all 0.3s ease-out'
    }, 400)
  }

  // 2. Create rising floating text (+XP) near portrait
  const portraitBox = document.querySelector('.rpg-portrait-box')
  if (portraitBox) {
    const floatText = document.createElement('div')
    floatText.className = 'rpg-xp-float'
    floatText.textContent = `+${amount} XP`
    
    const rect = portraitBox.getBoundingClientRect()
    const gameLayout = document.querySelector('.game-layout')
    const layoutRect = gameLayout.getBoundingClientRect()
    
    // Position relative to .game-layout
    const left = rect.left - layoutRect.left + rect.width / 2
    const top = rect.top - layoutRect.top
    
    floatText.style.left = `${left}px`
    floatText.style.top = `${top}px`
    gameLayout.appendChild(floatText)

    gsap.to(floatText, {
      y: -50,
      opacity: 0,
      scale: 1.3,
      duration: 1.2,
      ease: 'power2.out',
      onComplete: () => {
        floatText.remove()
      }
    })
  }
}

// Fullscreen level-up animation & particle burst
function triggerLevelUpCelebration(newLevel, onCelebrationComplete) {
  const overlay = document.querySelector('#levelUpOverlay')
  const levelVal = document.querySelector('#levelUpModalVal')
  if (!overlay || !levelVal) {
    if (onCelebrationComplete) onCelebrationComplete()
    return
  }

  levelVal.textContent = newLevel
  overlay.style.display = 'flex'

  if (window.audio && window.audio.initBattle) {
    window.audio.initBattle.play() // play retro battle sound as celebration sound
  }

  gsap.set(overlay, { opacity: 0 })
  const banner = overlay.querySelector('.level-up-banner')
  gsap.set(banner, { scale: 0.2, opacity: 0, rotation: -10 })

  gsap.to(overlay, {
    opacity: 1,
    duration: 0.3,
    onComplete: () => {
      gsap.to(banner, {
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.8,
        ease: 'back.out(2.5)'
      })

      // Spawn floating sparkles/emojis
      const gameLayout = document.querySelector('.game-layout')
      const emojis = ['XP', 'STAR', 'WIN', 'SPARK', 'CROWN', 'FIRE']
      for (let i = 0; i < 20; i++) {
        setTimeout(() => {
          const particle = document.createElement('div')
          particle.className = 'rpg-particle'
          particle.textContent = emojis[Math.floor(Math.random() * emojis.length)]
          
          const x = gameLayout.clientWidth / 2 + (Math.random() - 0.5) * 200
          const y = gameLayout.clientHeight / 2 + (Math.random() - 0.5) * 100
          
          particle.style.left = `${x}px`
          particle.style.top = `${y}px`
          
          const dx = (Math.random() - 0.5) * 300
          const dy = -150 - Math.random() * 200
          const dr = (Math.random() - 0.5) * 360
          
          particle.style.setProperty('--dx', `${dx}px`)
          particle.style.setProperty('--dy', `${dy}px`)
          particle.style.setProperty('--dr', `${dr}deg`)
          
          gameLayout.appendChild(particle)
          setTimeout(() => particle.remove(), 1200)
        }, i * 50)
      }
    }
  })

  // Pulsing gold avatar portrait
  const portraitBox = document.querySelector('.rpg-portrait-box')
  if (portraitBox) {
    portraitBox.style.boxShadow = '0 0 25px #ffca28, inset 0 0 15px #ffca28'
    portraitBox.style.borderColor = '#ffca28'
    portraitBox.classList.add('portrait-level-glow')
  }

  setTimeout(() => {
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.5,
      onComplete: () => {
        overlay.style.display = 'none'
        
        if (portraitBox) {
          portraitBox.style.boxShadow = ''
          portraitBox.style.borderColor = ''
          portraitBox.classList.remove('portrait-level-glow')
        }

        if (onCelebrationComplete) {
          onCelebrationComplete()
        }
      }
    })
  }, 2800)
}

// Battle reward helper
window.awardBattleReward = (gold, xp) => {
  const oldLvl = getPlayerLevel()

  farmState.gold += gold
  farmState.xp = (farmState.xp || 0) + xp
  persistFarmState()
  updateFarmUi(true)

  // Trigger XP gain animation
  triggerXpGainAnimation(xp)

  const newLvl = getPlayerLevel()

  if (newLvl > oldLvl) {
    // If they level up, trigger the celebration overlay when they return to the map.
    // Delay it slightly to let the fadeout complete.
    setTimeout(() => {
      triggerLevelUpCelebration(newLvl, () => {
        const modal = document.querySelector('#battleConfirmModal')
        if (modal) {
          modal.querySelector('.rpg-confirm-title').textContent = 'LEVEL UP!'
          modal.querySelector('.rpg-confirm-text').textContent = `Congratulations! You reached Level ${newLvl}! Do you want to enter the Battle Zone to earn bonus XP and Gold?`
          modal.style.display = 'flex'
          battle.confirming = true
        }
      })
    }, 1200)
  }
}

// Bind HUD Menu Button
const btnOpenMenu = document.querySelector('#btnOpenMenu')
if (btnOpenMenu) {
  btnOpenMenu.addEventListener('click', () => {
    openMainMenu()
  })
}

// =======================================================
// WEB3 WALLET INTEGRATION FOR HARUKA FARM
// =======================================================

const HARUKA_PORTFOLIO_STORAGE_KEY = 'haruka.portfolio.context.v1'
const HARUKA_SNAPSHOT_TIMEOUT_MS = 9000
const HARUKA_TIER_DEFINITIONS = [
  { tier: 3, label: 'Forest Guard', minHaruka: 5000000, memoryDepth: 'legendary', perks: ['Everything Tier 2', 'Gaming companion mode', 'Swap inside chat', 'Deeper memory', 'Private community access', 'Name listed on website'] },
  { tier: 2, label: 'Partner', minHaruka: 2500000, memoryDepth: 'deep', perks: ['Everything Tier 1', 'Custom personality settings', 'Priority response', 'Reduced API rate (developers)', 'Early access new features', 'Exclusive background scenes'] },
  { tier: 1, label: 'Companion', minHaruka: 500000, memoryDepth: 'warm', perks: ['Everything Tier 0', 'Memory unlocked', 'Faster response', 'Portfolio management'] },
  { tier: 0, label: 'Free', minHaruka: 0, memoryDepth: 'light', perks: ['Basic chat', 'Voice interaction', 'Live2D expressions', 'EN/JP toggle', 'Standard response speed'] }
]

function getWalletContext() {
  try {
    const raw = window.localStorage.getItem(HARUKA_PORTFOLIO_STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error(e)
  }
  return null
}

function createPortfolioContextFromSnapshot(walletAddress, walletProvider, snapshot, source = 'utility-page') {
  const tier = detectHarukaTier(snapshot.haruka)
  return {
    walletAddress,
    shortAddress: formatWalletAddress(walletAddress),
    walletProvider,
    sol: snapshot.sol || 0,
    usdc: snapshot.usdc || 0,
    haruka: snapshot.haruka || 0,
    harukaPriceUsd: snapshot.harukaPriceUsd,
    harukaChange24h: snapshot.harukaChange24h,
    harukaMarketCap: snapshot.harukaMarketCap,
    harukaVolume24h: snapshot.harukaVolume24h,
    tier: tier.tier,
    tierLabel: tier.label,
    tierMinHaruka: tier.minHaruka,
    memoryDepth: tier.memoryDepth,
    unlockedPerks: getTierPerksForLevel(tier.tier),
    capturedAt: snapshot.capturedAt || new Date().toISOString(),
    source
  }
}

async function fetchPortfolioSnapshot(walletAddress, timeoutMs = HARUKA_SNAPSHOT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch('/api/haruka/portfolio-snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ walletAddress }),
      signal: controller.signal
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'HARUKA could not fetch the wallet snapshot.')
    }

    return payload
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Live wallet snapshot timed out. Retrying with cached context if available.')
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function getRewardProofStorageKey(walletAddress) {
  return `${HARUKA_REWARD_PROOF_STORAGE_PREFIX}:${walletAddress}`
}

function getStoredRewardProof(walletAddress) {
  const normalized = String(walletAddress || '').trim()
  if (!normalized) {
    return ''
  }

  try {
    return String(window.localStorage.getItem(getRewardProofStorageKey(normalized)) || '').trim()
  } catch (error) {
    console.error(error)
    return ''
  }
}

function setStoredRewardProof(walletAddress, proof) {
  const normalizedWallet = String(walletAddress || '').trim()
  const normalizedProof = String(proof || '').trim()
  if (!normalizedWallet || !normalizedProof) {
    return
  }

  window.localStorage.setItem(getRewardProofStorageKey(normalizedWallet), normalizedProof)
}

function applyAuthoritativeRewardStatePayload(payload, { persist = true } = {}) {
  const state = payload?.state
  const walletAddress = String(state?.walletAddress || getWalletContext()?.walletAddress || '').trim()
  if (!state || !walletAddress) {
    return
  }

  if (payload?.proof) {
    setStoredRewardProof(walletAddress, payload.proof)
  }

  if (state.plots && typeof state.plots === 'object') {
    farmState.plots = JSON.parse(JSON.stringify(state.plots))
  }
  farmState.unclaimedHaruka = Math.max(0, Number(state.unclaimedHaruka) || 0)
  farmState.totalEarnedHaruka = Math.max(0, Number(state.totalEarnedHaruka) || 0)
  farmState.totalClaimedHaruka = Math.max(0, Number(state.totalClaimedHaruka) || 0)
  farmState.totalBurnedHaruka = Math.max(0, Number(state.totalBurnedHaruka) || 0)
  farmState.rewardPoolBalance = Math.max(0, Number(state.rewardPoolBalance) || 0)
  farmState.loginStreak = Math.max(0, Number(state.loginStreak) || 0)
  farmState.lastHarvestDate = typeof state.lastHarvestDate === 'string' ? state.lastHarvestDate : null
  if (state.dailyRewards) {
    farmState.dailyRewards = {
      date: String(state.dailyRewards.date || getFarmDateKey()),
      earned: Math.max(0, Number(state.dailyRewards.earned) || 0),
      claimed: Math.max(0, Number(state.dailyRewards.claimed) || 0),
      claimCount: Math.max(0, Math.floor(Number(state.dailyRewards.claimCount) || 0))
    }
  }
  farmState.harvestLog = Array.isArray(state.harvestLog) ? state.harvestLog.slice(0, 30) : []
  farmState.claimTransactions = Array.isArray(state.claimTransactions) ? state.claimTransactions.slice(0, 20) : []

  if (persist) {
    persistFarmState()
  }
}

async function fetchRewardState(walletAddress, action = 'load', extra = {}, timeoutMs = HARUKA_REWARD_STATE_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch('/api/haruka/reward-state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress,
        proof: getStoredRewardProof(walletAddress),
        action,
        ...extra
      }),
      signal: controller.signal
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `HARUKA reward state ${action} failed.`)
    }

    return payload
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Reward state ${action} timed out before the server responded.`)
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function hydrateRewardStateFromServer(walletAddress) {
  const payload = await fetchRewardState(walletAddress, 'load')
  applyAuthoritativeRewardStatePayload(payload)
  return payload
}

async function fetchRewardClaim(walletAddress, amount, timeoutMs = HARUKA_REWARD_CLAIM_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch('/api/haruka/reward-claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        walletAddress,
        amount: String(amount),
        proof: getStoredRewardProof(walletAddress)
      }),
      signal: controller.signal
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.ok) {
      if (payload?.state && payload?.proof) {
        applyAuthoritativeRewardStatePayload(payload)
      }
      throw new Error(payload.error || payload.reason || 'HARUKA reward claim failed.')
    }

    return payload
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Reward claim exceeded the 60 second treasury timeout. The Solana RPC is responding too slowly.')
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function refreshWalletContextFromChain(walletAddress, walletProvider) {
  const snapshot = await fetchPortfolioSnapshot(walletAddress)
  const context = createPortfolioContextFromSnapshot(walletAddress, walletProvider, snapshot, 'reward-claim-refresh')
  window.localStorage.setItem(HARUKA_PORTFOLIO_STORAGE_KEY, JSON.stringify(context))
  updateWalletNavbarUI(context)
  return context
}

function getCachedWalletContextForAddress(walletAddress) {
  const cached = getWalletContext()
  if (!cached) {
    return null
  }

  return cached.walletAddress === walletAddress ? cached : null
}

function getGoldMultiplier() {
  const wallet = getWalletContext()
  if (!wallet) return 1.0
  if (wallet.tier === 3) return 1.5
  if (wallet.tier === 2) return 1.25
  if (wallet.tier === 1) return 1.10
  return 1.0
}

function detectHarukaTier(harukaBalance) {
  const normalizedBalance = Number.isFinite(harukaBalance) ? harukaBalance : 0
  return HARUKA_TIER_DEFINITIONS.find((entry) => normalizedBalance >= entry.minHaruka) || HARUKA_TIER_DEFINITIONS[HARUKA_TIER_DEFINITIONS.length - 1]
}

function getTierPerksForLevel(tier) {
  const ascendingDefinitions = [...HARUKA_TIER_DEFINITIONS].sort((a, b) => a.tier - b.tier)
  return [...new Set(
    ascendingDefinitions
      .filter((entry) => entry.tier <= tier)
      .flatMap((entry) => entry.perks)
  )]
}

function formatWalletAddress(address) {
  const normalized = String(address || '').trim()
  if (normalized.length <= 10) return normalized
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`
}

function getProvider(kind) {
  if (kind === 'phantom') {
    return window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null) || null
  }
  if (kind === 'solflare') {
    return window.solflare || (window.solana?.isSolflare ? window.solana : null) || null
  }
  return null
}

function updateWalletNavbarUI(context) {
  const btn = document.getElementById('btnConnectWallet')
  const dropdown = document.getElementById('walletInfoDropdown')
  const dropdownAddress = document.getElementById('walletDropdownAddress')
  const dropdownBalance = document.getElementById('walletDropdownBalance')
  const dropdownTier = document.getElementById('walletDropdownTier')
  const btnText = document.getElementById('walletBtnText')

  if (context) {
    if (btnText) btnText.textContent = context.shortAddress
    if (dropdownAddress) dropdownAddress.textContent = context.walletAddress
    if (dropdownBalance) dropdownBalance.textContent = `${formatHarukaAmount(context.haruka)} $HARUKA`
    if (dropdownTier) {
      dropdownTier.textContent = `Tier ${context.tier} - ${context.tierLabel}`
      dropdownTier.className = `wallet-tier-pill tier-${context.tier}`
    }
    updatePlayerHUDMultiplier(context.tier)
  } else {
    if (btnText) btnText.textContent = 'Connect Wallet'
    if (dropdownBalance) dropdownBalance.textContent = 'Not Connected'
    if (dropdown) dropdown.style.display = 'none'
    const badge = document.querySelector('.rpg-multiplier-badge')
    if (badge) badge.remove()
  }
}

function updatePlayerHUDMultiplier(tier) {
  const header = document.querySelector('.rpg-player-header')
  if (!header) return

  let badge = header.querySelector('.rpg-multiplier-badge')
  if (tier === 0 || !tier) {
    if (badge) badge.remove()
    return
  }

  if (!badge) {
    badge = document.createElement('span')
    badge.className = 'rpg-multiplier-badge'
    const menuBtn = document.getElementById('btnOpenMenu')
    if (menuBtn) {
      header.insertBefore(badge, menuBtn)
    } else {
      header.appendChild(badge)
    }
  }

  const multiplierText = {
    1: '1.1x Gold',
    2: '1.25x Gold',
    3: '1.5x Gold'
  }
  badge.textContent = multiplierText[tier] || ''
}

async function connectWallet(kind) {
  const provider = getProvider(kind)
  if (!provider) {
    const urls = {
      phantom: 'https://phantom.app/',
      solflare: 'https://solflare.com/'
    }
    alert(`HARUKA could not find ${kind === 'phantom' ? 'Phantom' : 'Solflare'} in this browser. Opening the install page.`)
    window.open(urls[kind], '_blank', 'noopener,noreferrer')
    return
  }

  try {
    showFarmStatusMessage('Connecting to wallet...')
    await provider.connect()
    const walletAddress = provider.publicKey?.toString()
    if (!walletAddress) {
      throw new Error('Wallet did not expose a public key.')
    }

    showFarmStatusMessage('Loading portfolio snapshot...')
    let context
    let usingCachedSnapshot = false

    try {
      const snapshot = await fetchPortfolioSnapshot(walletAddress)
      context = createPortfolioContextFromSnapshot(walletAddress, kind, snapshot, 'utility-page')
    } catch (snapshotError) {
      const cachedContext = getCachedWalletContextForAddress(walletAddress)
      if (!cachedContext) {
        throw snapshotError
      }

      usingCachedSnapshot = true
      context = {
        ...cachedContext,
        walletProvider: kind,
        source: 'cached-snapshot-fallback',
        capturedAt: cachedContext.capturedAt || new Date().toISOString()
      }
      showFarmStatusMessage('Live snapshot is unavailable. Using the last cached wallet snapshot for now.')
    }

    window.localStorage.setItem(HARUKA_PORTFOLIO_STORAGE_KEY, JSON.stringify(context))
    farmState = loadFarmState(walletAddress)
    try {
      await hydrateRewardStateFromServer(walletAddress)
    } catch (rewardStateError) {
      console.warn('Reward proof hydration failed:', rewardStateError)
      showFarmStatusMessage(`Wallet connected, but reward sync is unavailable: ${rewardStateError instanceof Error ? rewardStateError.message : 'Unknown error.'}`)
    }
    updateWalletNavbarUI(context)
    const tier = detectHarukaTier(context.haruka)
    const accessGranted = hasHarukaGameAccess()
    const accessMessage = accessGranted
      ? `Connected! active tier: ${tier.label}. HARUKA Realm access granted${usingCachedSnapshot ? ' via cached snapshot' : ''}.`
      : `Connected, but access needs ${HARUKA_MIN_HOLD_TO_PLAY} $HARUKA. Current: ${formatHarukaAmount(context.haruka)} $HARUKA.`
    showFarmStatusMessage(accessMessage)
    triggerHarukaNarration(accessGranted ? 'loginGranted' : 'loginDenied', {
      shortAddress: context.shortAddress,
      balance: context.haruka
    })
    
    if (window.updateProfileAndRecords) {
      window.updateProfileAndRecords()
    }
    updateFarmUi(true)
  } catch (error) {
    console.error(error)
    showFarmStatusMessage(`Wallet connection failed: ${error instanceof Error ? error.message : 'Unknown error.'}`)
    try {
      await provider.disconnect?.()
    } catch (disconnectError) {
      console.error(disconnectError)
    }
    alert(`Wallet connection failed: ${error instanceof Error ? error.message : error}`)
    updateFarmUi(true)
  }
}

async function disconnectWallet() {
  const context = getWalletContext()
  if (context) {
    const provider = getProvider(context.walletProvider)
    if (provider && typeof provider.disconnect === 'function') {
      try {
        await provider.disconnect()
      } catch (err) {
        console.warn('Provider disconnect failed:', err)
      }
    }
  }

  window.localStorage.removeItem(HARUKA_PORTFOLIO_STORAGE_KEY)
  farmState = loadFarmState()
  updateWalletNavbarUI(null)
  showFarmStatusMessage('Wallet disconnected.')
  triggerHarukaNarration('walletDisconnected')
  
  if (window.updateProfileAndRecords) {
    window.updateProfileAndRecords()
  }
  updateFarmUi(true)
}

function initializeWallet() {
  // Bind UI buttons
  const btnConnect = document.getElementById('btnConnectWallet')
  const dropdown = document.getElementById('walletInfoDropdown')
  const modal = document.getElementById('walletModal')
  
  const btnPhantom = document.getElementById('btnConnectPhantom')
  const btnSolflare = document.getElementById('btnConnectSolflare')
  const btnCloseModal = document.getElementById('btnCloseWalletModal')
  const btnDisconnect = document.getElementById('btnDisconnectWallet')
  const btnGateConnect = document.getElementById('btnGateConnectWallet')

  if (btnConnect) {
    btnConnect.addEventListener('click', (e) => {
      e.stopPropagation()
      const context = getWalletContext()
      if (context) {
        // Toggle dropdown
        if (dropdown) {
          dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none'
        }
      } else {
        // Open selection modal
        if (modal) modal.style.display = 'flex'
      }
    })
  }

  if (btnPhantom) {
    btnPhantom.addEventListener('click', () => {
      if (modal) modal.style.display = 'none'
      connectWallet('phantom')
    })
  }

  if (btnSolflare) {
    btnSolflare.addEventListener('click', () => {
      if (modal) modal.style.display = 'none'
      connectWallet('solflare')
    })
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      if (modal) modal.style.display = 'none'
    })
  }

  if (btnGateConnect) {
    btnGateConnect.addEventListener('click', () => {
      if (modal) modal.style.display = 'flex'
    })
  }

  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', () => {
      disconnectWallet()
    })
  }

  // Close dropdown on click outside
  window.addEventListener('click', (e) => {
    if (dropdown && dropdown.style.display !== 'none') {
      if (!btnConnect.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none'
      }
    }
  })

  // Load existing wallet state
  const context = getWalletContext()
  if (context) {
    updateWalletNavbarUI(context)
    void hydrateRewardStateFromServer(context.walletAddress)
      .then(() => {
        updateFarmUi(true)
      })
      .catch((error) => {
        console.warn('Initial reward proof hydration failed:', error)
      })
  }
  updateFarmUi(true)
}

animate()
updateFarmUi(true)
initializeWallet()

