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
  actionKeyBadge: document.querySelector('.rpg-key-badge')
}

const FARM_STORAGE_KEY = 'haruka-realm-canvas-farm-v1'
const FARM_TILE_SIZE = 48
const FARM_SPRITE_SIZE = 16
const FARM_SEED_ORDER = ['carrot', 'potato', 'tomato', 'strawberry', 'lettuce', 'pumpkin']
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
    growMs: 90000,
    cost: 12,
    sellPrice: 25,
    level: 1
  },
  potato: {
    label: 'Potato',
    row: 3,
    growMs: 150000,
    cost: 18,
    sellPrice: 50,
    level: 1
  },
  tomato: {
    label: 'Tomato',
    row: 4,
    growMs: 240000,
    cost: 28,
    sellPrice: 90,
    level: 2
  },
  strawberry: {
    label: 'Strawberry',
    row: 1,
    growMs: 360000,
    cost: 42,
    sellPrice: 160,
    level: 3
  },
  lettuce: {
    label: 'Lettuce',
    row: 5,
    growMs: 540000,
    cost: 60,
    sellPrice: 240,
    level: 4
  },
  pumpkin: {
    label: 'Pumpkin',
    row: 0,
    growMs: 720000,
    cost: 90,
    sellPrice: 380,
    level: 5
  }
}

farmUi.seedButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const seedKey = button.dataset.farmSeed
    setSelectedFarmSeed(seedKey)
  })
})

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

const farmState = loadFarmState()

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
let farmHintOverride = {
  text: '',
  expiresAt: 0
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

function loadFarmState() {
  const baseState = createBaseFarmState()

  try {
    const raw = window.localStorage.getItem(FARM_STORAGE_KEY)
    if (!raw) {
      return baseState
    }

    const parsed = JSON.parse(raw)
    return normalizeFarmState(parsed, baseState)
  } catch (_error) {
    return baseState
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
    plots
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
    plots
  }
}

function persistFarmState() {
  window.localStorage.setItem(FARM_STORAGE_KEY, JSON.stringify(farmState))
}

function harvestFarmZone(zone) {
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

  let totalGold = 0
  let totalXp = 0
  readyPlotIds.forEach((plotId) => {
    const plotState = farmState.plots[plotId]
    const crop = FARM_CROPS[plotState.cropKey]
    totalGold += crop.sellPrice
    
    // Add crop XP based on dev-brief:
    const xpTable = {
      carrot: 5,
      potato: 10,
      tomato: 18,
      strawberry: 30,
      lettuce: 48,
      pumpkin: 75
    }
    totalXp += xpTable[plotState.cropKey] || 5

    plotState.cropKey = null
    plotState.plantedAt = null
  })

  const oldLvl = getPlayerLevel()

  farmState.gold += totalGold
  farmState.harvests += readyPlotIds.length
  farmState.xp = (farmState.xp || 0) + totalXp
  persistFarmState()
  
  const newLvl = getPlayerLevel()

  showFarmStatusMessage(`Harvested ${readyPlotIds.length} plots in ${zone.label} for ${totalGold}g and +${totalXp} XP. The soil is now empty.`)
  updateFarmUi(true)
  
  // Trigger XP Gain HUD/floating text animation
  triggerXpGainAnimation(totalXp)

  // Level Up check and Battle option
  if (newLvl > oldLvl) {
    // Reset overworld direction keys to freeze character
    keys.w.pressed = false
    keys.a.pressed = false
    keys.s.pressed = false
    keys.d.pressed = false
    
    // Play full-screen level up celebration
    triggerLevelUpCelebration(newLvl, () => {
      const modal = document.querySelector('#battleConfirmModal')
      if (modal) {
        modal.querySelector('.rpg-confirm-title').textContent = 'LEVEL UP!'
        modal.querySelector('.rpg-confirm-text').textContent = `Congratulations! You reached Level ${newLvl}! Do you want to enter the Battle Zone to earn bonus XP and Gold?`
        modal.style.display = 'flex'
        battle.confirming = true
      }
    })
  }
}

function plantFarmZone(zone) {
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

  const plotState = farmState.plots[emptyPlotIds[0]]
  plotState.cropKey = farmState.selectedSeed
  plotState.plantedAt = Date.now()
  farmState.gold -= selectedCrop.cost
  persistFarmState()
  showFarmStatusMessage(`Planted ${selectedCrop.label} in ${zone.label} for ${selectedCrop.cost}g. Grow time: ${formatFarmDuration(selectedCrop.growMs)}.`)
  updateFarmUi(true)
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
        carrot: '🥕',
        potato: '🥔',
        tomato: '🍅',
        strawberry: '🍓',
        lettuce: '🥬',
        pumpkin: '🎃'
      }
      iconSlot.textContent = isLocked ? '🔒' : defaultIcons[seedKey]
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
      const emojis = ['✨', '⭐', '🎉', '🌟', '👑', '🔥']
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

animate()
updateFarmUi(true)
