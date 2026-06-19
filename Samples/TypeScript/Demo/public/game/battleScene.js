const battleBackgroundImage = new Image()
battleBackgroundImage.src = '/game/img/battleBackground.png'
const battleBackground = new Sprite({
  position: {
    x: 0,
    y: 0
  },
  image: battleBackgroundImage
})

let draggle
let emby
let renderedSprites
let battleAnimationId
let queue

function initBattle() {
  document.querySelector('#userInterface').style.display = 'block'
  document.querySelector('.farm-overlay').style.display = 'none'
  document.querySelector('.farm-legend').style.display = 'none'
  
  // Initialize dialogue box to show intro text
  const dialogueBox = document.querySelector('#dialogueBox')
  dialogueBox.style.display = 'flex'
  dialogueBox.classList.remove('waiting-for-input')
  dialogueBox.innerHTML = 'A wild Draggle appeared!'

  document.querySelector('#enemyHealthBar').style.width = '100%'
  document.querySelector('#playerHealthBar').style.width = '100%'

  // Reset HP numeric texts and level text dynamically
  const playerLvl = window.getPlayerLevel ? window.getPlayerLevel() : 1
  const enemyLvl = Math.max(1, playerLvl + 2)
  document.querySelector('.battle-card--player .battle-card__level').textContent = `Lv ${playerLvl}`
  document.querySelector('.battle-card--enemy .battle-card__level').textContent = `Lv ${enemyLvl}`

  document.querySelector('.battle-card--enemy .battle-card__hp-num').textContent = 'HP: 100 / 100'
  document.querySelector('.battle-card--player .battle-card__hp-num').textContent = 'HP: 100 / 100'

  const attacksBox = document.querySelector('#attacksBox')
  attacksBox.replaceChildren()

  // Disable button clicks during intro dialogue
  attacksBox.style.pointerEvents = 'none'
  attacksBox.style.opacity = '0.5'

  draggle = new Monster(monsters.Draggle)
  emby = new Monster(monsters.Emby)
  renderedSprites = [draggle, emby]
  queue = []

  emby.attacks.forEach((attack) => {
    const button = document.createElement('button')
    button.innerHTML = attack.name
    attacksBox.append(button)
  })

  // our event listeners for our buttons (attack)
  attacksBox.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', (e) => {
      const selectedAttack = attacks[e.currentTarget.innerHTML]
      if (!selectedAttack) return

      // Disable buttons immediately on turn start
      attacksBox.style.pointerEvents = 'none'
      attacksBox.style.opacity = '0.5'

      emby.attack({
        attack: selectedAttack,
        recipient: draggle,
        renderedSprites
      })

      if (draggle.health <= 0) {
        queue.push(() => {
          draggle.faint()
        })
        // Victory rewards slide
        queue.push(() => {
          const rewardGold = 50
          const rewardXp = 30
          
          if (window.awardBattleReward) {
            window.awardBattleReward(rewardGold, rewardXp)
          }
          
          const dialogueBox = document.querySelector('#dialogueBox')
          dialogueBox.innerHTML = `Victory! Earned ${rewardGold} Gold and +${rewardXp} XP!`
        })
        queue.push(() => {
          // fade back to black
          gsap.to('#overlappingDiv', {
            opacity: 1,
            onComplete: () => {
              cancelAnimationFrame(battleAnimationId)
              animate()
              document.querySelector('#userInterface').style.display = 'none'
              document.querySelector('.farm-overlay').style.display = 'block'
              document.querySelector('.farm-legend').style.display = 'block'

              gsap.to('#overlappingDiv', {
                opacity: 0
              })

              battle.initiated = false
              audio.Map.play()
            }
          })
        })
        return // Return early so dead enemy does not counter-attack
      }

      // draggle or enemy attacks right here
      const randomAttack =
        draggle.attacks[Math.floor(Math.random() * draggle.attacks.length)]

      queue.push(() => {
        draggle.attack({
          attack: randomAttack,
          recipient: emby,
          renderedSprites
        })

        if (emby.health <= 0) {
          queue.push(() => {
            emby.faint()
          })

          queue.push(() => {
            // fade back to black
            gsap.to('#overlappingDiv', {
              opacity: 1,
              onComplete: () => {
                cancelAnimationFrame(battleAnimationId)
                animate()
                document.querySelector('#userInterface').style.display = 'none'
                document.querySelector('.farm-overlay').style.display = 'block'
                document.querySelector('.farm-legend').style.display = 'block'

                gsap.to('#overlappingDiv', {
                  opacity: 0
                })

                battle.initiated = false
                audio.Map.play()
              }
            })
          })
        }
      })
    })

    button.addEventListener('mouseenter', (e) => {
      const selectedAttack = attacks[e.currentTarget.innerHTML]
      document.querySelector('#attackType').innerHTML = selectedAttack.type
      document.querySelector('#attackType').style.color = selectedAttack.color
    })
  })
}

function animateBattle() {
  battleAnimationId = window.requestAnimationFrame(animateBattle)
  battleBackground.draw()

  renderedSprites.forEach((sprite) => {
    sprite.draw()
  })
}

document.querySelector('#dialogueBox').addEventListener('click', (e) => {
  if (queue.length > 0) {
    queue[0]()
    queue.shift()
  } else {
    // Turn is finished. Show prompt to select next attack
    e.currentTarget.innerHTML = 'What will ' + emby.name + ' do?'
    e.currentTarget.classList.add('waiting-for-input')
    
    // Re-enable attack button interactions
    document.querySelector('#attacksBox').style.pointerEvents = 'auto'
    document.querySelector('#attacksBox').style.opacity = '1'
  }
})
