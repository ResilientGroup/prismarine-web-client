//@ts-check

import { Vec3 } from 'vec3'
import { proxy, subscribe } from 'valtio'
import * as THREE from 'three'

import { ControMax } from 'contro-max/build/controMax'
import { CommandEventArgument, SchemaCommandInput } from 'contro-max/build/types'
import { stringStartsWith } from 'contro-max/build/stringUtils'
import { UserOverrideCommand, UserOverridesConfig } from 'contro-max/build/types/store'
import { isGameActive, showModal, gameAdditionalState, activeModalStack, hideCurrentModal, miscUiState, hideModal, hideAllModals } from './globalState'
import { goFullscreen, isInRealGameSession, pointerLock, reloadChunks } from './utils'
import { options } from './optionsStorage'
import { openPlayerInventory } from './inventoryWindows'
import { chatInputValueGlobal } from './react/Chat'
import { fsState } from './loadSave'
import { customCommandsConfig } from './customCommands'
import type { CustomCommand } from './react/KeybindingsCustom'
import { showOptionsModal } from './react/SelectOption'
import widgets from './react/widgets'
import { getItemFromBlock } from './chatUtils'
import { gamepadUiCursorState, moveGamepadCursorByPx } from './react/GamepadUiCursor'
import { completeResourcepackPackInstall, copyServerResourcePackToRegular, resourcePackState } from './resourcePack'
import { showNotification } from './react/NotificationProvider'
import { lastConnectOptions } from './react/AppStatusProvider'
import { onCameraMove, onControInit } from './cameraRotationControls'
import { createNotificationProgressReporter } from './core/progressReporter'


export const customKeymaps = proxy(JSON.parse(localStorage.keymap || '{}')) as UserOverridesConfig
subscribe(customKeymaps, () => {
  localStorage.keymap = JSON.stringify(customKeymaps)
})

const controlOptions = {
  preventDefault: true
}

export const contro = new ControMax({
  commands: {
    general: {
      jump: ['Space', 'A'],
      inventory: ['KeyE', 'X'],
      drop: ['KeyQ', 'B'],
      sneak: ['ShiftLeft'],
      toggleSneakOrDown: [null, 'Right Stick'],
      sprint: ['ControlLeft', 'Left Stick'],
      nextHotbarSlot: [null, 'Right Bumper'],
      prevHotbarSlot: [null, 'Left Bumper'],
      attackDestroy: [null, 'Right Trigger'],
      interactPlace: [null, 'Left Trigger'],
      chat: [['KeyT', 'Enter']],
      command: ['Slash'],
      swapHands: ['KeyF'],
      zoom: ['KeyC'],
      selectItem: ['KeyH'], // default will be removed
      rotateCameraLeft: [null],
      rotateCameraRight: [null],
      rotateCameraUp: [null],
      rotateCameraDown: [null],
      viewerConsole: ['Backquote']
    },
    ui: {
      toggleFullscreen: ['F11'],
      back: [null/* 'Escape' */, 'B'],
      toggleMap: ['KeyM'],
      leftClick: [null, 'A'],
      rightClick: [null, 'Y'],
      speedupCursor: [null, 'Left Stick'],
      pauseMenu: [null, 'Start']
    },
    advanced: {
      lockUrl: ['KeyY'],
    },
    custom: {} as Record<string, SchemaCommandInput & { type: string, input: any[] }>,
    // waila: {
    //   showLookingBlockRecipe: ['Numpad3'],
    //   showLookingBlockUsages: ['Numpad4']
    // }
  } satisfies Record<string, Record<string, SchemaCommandInput>>,
  movementKeymap: 'WASD',
  movementVector: '2d',
  groupedCommands: {
    general: {
      switchSlot: ['Digits', []]
    }
  },
}, {
  defaultControlOptions: controlOptions,
  target: document,
  captureEvents () {
    return true
  },
  storeProvider: {
    load: () => customKeymaps,
    save () { },
  },
  gamepadPollingInterval: 10
})
window.controMax = contro
export type Command = CommandEventArgument<typeof contro['_commandsRaw']>['command']

onControInit()

updateBinds(customKeymaps)

const updateDoPreventDefault = () => {
  controlOptions.preventDefault = miscUiState.gameLoaded && !activeModalStack.length
}

subscribe(miscUiState, updateDoPreventDefault)
subscribe(activeModalStack, updateDoPreventDefault)
updateDoPreventDefault()

const setSprinting = (state: boolean) => {
  bot.setControlState('sprint', state)
  gameAdditionalState.isSprinting = state
}

contro.on('movementUpdate', ({ vector, soleVector, gamepadIndex }) => {
  // Don't allow movement while spectating an entity
  if (viewer.world.cameraEntity !== undefined) return

  if (gamepadIndex !== undefined && gamepadUiCursorState.display) {
    const deadzone = 0.1 // TODO make deadzone configurable
    if (Math.abs(soleVector.x) < deadzone && Math.abs(soleVector.z) < deadzone) {
      return
    }
    moveGamepadCursorByPx(soleVector.x, true)
    moveGamepadCursorByPx(soleVector.z, false)
    emitMousemove()
  }
  miscUiState.usingGamepadInput = gamepadIndex !== undefined
  if (!bot || !isGameActive(false)) return

  if (viewer.world.freeFlyMode) {
    // Create movement vector from input
    const direction = new THREE.Vector3(0, 0, 0)
    if (vector.z !== undefined) direction.z = vector.z
    if (vector.x !== undefined) direction.x = vector.x

    // Apply camera rotation to movement direction
    direction.applyQuaternion(viewer.camera.quaternion)

    // Update freeFlyState position with normalized direction
    const moveSpeed = 1
    direction.multiplyScalar(moveSpeed)
    viewer.world.freeFlyState.position.add(new Vec3(direction.x, direction.y, direction.z))
    return
  }

  // gamepadIndex will be used for splitscreen in future
  const coordToAction = [
    ['z', -1, 'forward'],
    ['z', 1, 'back'],
    ['x', -1, 'left'],
    ['x', 1, 'right'],
  ] as const

  const newState: Partial<typeof bot.controlState> = {}
  for (const [coord, v] of Object.entries(vector)) {
    if (v === undefined || Math.abs(v) < 0.3) continue
    // todo use raw values eg for slow movement
    const mappedValue = v < 0 ? -1 : 1
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    const foundAction = coordToAction.find(([c, mapV]) => c === coord && mapV === mappedValue)?.[2]!
    newState[foundAction] = true
  }

  for (const key of ['forward', 'back', 'left', 'right'] as const) {
    if (newState[key] === bot.controlState[key]) continue
    const action = !!newState[key]
    if (action && !isGameActive(true)) continue
    bot.setControlState(key, action)

    if (key === 'forward') {
      // todo workaround: need to refactor
      if (action) {
        void contro.emit('trigger', { command: 'general.forward' } as any)
      } else {
        setSprinting(false)
      }
    }
  }
})

let lastCommandTrigger = null as { command: string, time: number } | null

const secondActionActivationTimeout = 300
const secondActionCommands = {
  'general.jump' () {
    // if (bot.game.gameMode === 'spectator') return
    toggleFly()
  },
  'general.forward' () {
    setSprinting(true)
  }
}

// detect pause open, as ANY keyup event is not fired when you exit pointer lock (esc)
subscribe(activeModalStack, () => {
  if (activeModalStack.length) {
    // iterate over pressedKeys
    for (const key of contro.pressedKeys) {
      contro.pressedKeyOrButtonChanged({ code: key }, false)
    }
  }
})

const emitMousemove = () => {
  const { x, y } = gamepadUiCursorState
  const xAbs = x / 100 * window.innerWidth
  const yAbs = y / 100 * window.innerHeight
  const element = document.elementFromPoint(xAbs, yAbs) as HTMLElement | null
  if (!element) return
  element.dispatchEvent(new MouseEvent('mousemove', {
    clientX: xAbs,
    clientY: yAbs
  }))
}

let lastClickedEl = null as HTMLElement | null
let lastClickedElTimeout: ReturnType<typeof setTimeout> | undefined
const inModalCommand = (command: Command, pressed: boolean) => {
  if (pressed && !gamepadUiCursorState.display) return

  if (pressed) {
    if (command === 'ui.back') {
      hideCurrentModal()
    }
    if (command === 'ui.leftClick' || command === 'ui.rightClick') {
      // in percent
      const { x, y } = gamepadUiCursorState
      const xAbs = x / 100 * window.innerWidth
      const yAbs = y / 100 * window.innerHeight
      const el = document.elementFromPoint(xAbs, yAbs) as HTMLElement
      if (el) {
        if (el === lastClickedEl && command === 'ui.leftClick') {
          el.dispatchEvent(new MouseEvent('dblclick', {
            bubbles: true,
            clientX: xAbs,
            clientY: yAbs
          }))
          return
        }
        el.dispatchEvent(new MouseEvent('mousedown', {
          button: command === 'ui.leftClick' ? 0 : 2,
          bubbles: true,
          clientX: xAbs,
          clientY: yAbs
        }))
        el.dispatchEvent(new MouseEvent(command === 'ui.leftClick' ? 'click' : 'contextmenu', {
          bubbles: true,
          clientX: xAbs,
          clientY: yAbs
        }))
        el.dispatchEvent(new MouseEvent('mouseup', {
          button: command === 'ui.leftClick' ? 0 : 2,
          bubbles: true,
          clientX: xAbs,
          clientY: yAbs
        }))
        el.focus()
        lastClickedEl = el
        if (lastClickedElTimeout) clearTimeout(lastClickedElTimeout)
        lastClickedElTimeout = setTimeout(() => {
          lastClickedEl = null
        }, 500)
      }
    }
  }

  if (command === 'ui.speedupCursor') {
    gamepadUiCursorState.multiply = pressed ? 2 : 1
  }
}

// Camera rotation controls
const cameraRotationControls = {
  activeDirections: new Set<'left' | 'right' | 'up' | 'down'>(),
  interval: null as ReturnType<typeof setInterval> | null,
  config: {
    speed: 1, // movement per interval
    interval: 5 // ms between movements
  },
  movements: {
    left: { movementX: -0.5, movementY: 0 },
    right: { movementX: 0.5, movementY: 0 },
    up: { movementX: 0, movementY: -0.5 },
    down: { movementX: 0, movementY: 0.5 }
  },
  updateMovement () {
    if (cameraRotationControls.activeDirections.size === 0) {
      if (cameraRotationControls.interval) {
        clearInterval(cameraRotationControls.interval)
        cameraRotationControls.interval = null
      }
      return
    }

    if (!cameraRotationControls.interval) {
      cameraRotationControls.interval = setInterval(() => {
        // Combine all active movements
        const movement = { movementX: 0, movementY: 0 }
        for (const direction of cameraRotationControls.activeDirections) {
          movement.movementX += cameraRotationControls.movements[direction].movementX
          movement.movementY += cameraRotationControls.movements[direction].movementY
        }

        onCameraMove({
          ...movement,
          type: 'keyboardRotation',
          stopPropagation () {}
        })
      }, cameraRotationControls.config.interval)
    }
  },
  start (direction: 'left' | 'right' | 'up' | 'down') {
    cameraRotationControls.activeDirections.add(direction)
    cameraRotationControls.updateMovement()
  },
  stop (direction: 'left' | 'right' | 'up' | 'down') {
    cameraRotationControls.activeDirections.delete(direction)
    cameraRotationControls.updateMovement()
  },
  handleCommand (command: string, pressed: boolean) {
    // Don't allow movement while spectating an entity
    if (viewer.world.cameraEntity !== undefined) return

    const directionMap = {
      'general.rotateCameraLeft': 'left',
      'general.rotateCameraRight': 'right',
      'general.rotateCameraUp': 'up',
      'general.rotateCameraDown': 'down'
    } as const

    const direction = directionMap[command]
    if (direction) {
      if (pressed) cameraRotationControls.start(direction)
      else cameraRotationControls.stop(direction)
      return true
    }
    return false
  }
}
window.cameraRotationControls = cameraRotationControls

const setSneaking = (state: boolean) => {
  gameAdditionalState.isSneaking = state
  bot.setControlState('sneak', state)
}

const onTriggerOrReleased = (command: Command, pressed: boolean) => {
  // always allow release!
  if (!bot || !isGameActive(false)) return
  if (stringStartsWith(command, 'general')) {
    // handle general commands
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (command) {
      case 'general.jump':
        if (viewer.world.cameraEntity !== undefined) break
        if (viewer.world.freeFlyMode) {
          const moveSpeed = 0.5
          viewer.world.freeFlyState.position.add(new Vec3(0, pressed ? moveSpeed : 0, 0))
        } else {
          bot.setControlState('jump', pressed)
        }
        break
      case 'general.sneak':
        bot._client.write('entity_action', {
          entityId: bot.entity.id,
          actionId: pressed ? 0 : 1,
          jumpBoost: 0
        })
        if (viewer.world.cameraEntity !== undefined) {
          viewer.world.cameraEntity = undefined
          setSneaking(pressed)
          break
        }
        if (viewer.world.freeFlyMode) {
          const moveSpeed = 0.5
          viewer.world.freeFlyState.position.add(new Vec3(0, pressed ? -moveSpeed : 0, 0))
        } else {
          setSneaking(pressed)
        }
        break
      case 'general.sprint':
        // todo add setting to change behavior
        if (pressed) {
          setSprinting(pressed)
        }
        break
      case 'general.toggleSneakOrDown':
        if (gameAdditionalState.isFlying) {
          setSneaking(pressed)
        } else if (pressed) {
          setSneaking(!gameAdditionalState.isSneaking)
        }
        break
      case 'general.attackDestroy':
        document.dispatchEvent(new MouseEvent(pressed ? 'mousedown' : 'mouseup', { button: 0 }))
        break
      case 'general.interactPlace':
        document.dispatchEvent(new MouseEvent(pressed ? 'mousedown' : 'mouseup', { button: 2 }))
        break
      case 'general.zoom':
        gameAdditionalState.isZooming = pressed
        break
      case 'general.rotateCameraLeft':
      case 'general.rotateCameraRight':
      case 'general.rotateCameraUp':
      case 'general.rotateCameraDown':
        cameraRotationControls.handleCommand(command, pressed)
        break
    }
  }
}

// im still not sure, maybe need to refactor to handle in inventory instead
const alwaysPressedHandledCommand = (command: Command) => {
  inModalCommand(command, true)
  // triggered even outside of the game
  if (command === 'general.inventory') {
    if (activeModalStack.at(-1)?.reactType?.startsWith?.('player_win:')) { // todo?
      hideCurrentModal()
    }
  }
  if (command === 'advanced.lockUrl') {
    lockUrl()
  }
}

export function lockUrl () {
  let newQs = ''
  if (fsState.saveLoaded) {
    const save = localServer!.options.worldFolder.split('/').at(-1)
    newQs = `loadSave=${save}`
  } else if (process.env.NODE_ENV === 'development') {
    newQs = `reconnect=1`
  } else if (lastConnectOptions.value?.server) {
    const qs = new URLSearchParams()
    const { server, botVersion, proxy, username } = lastConnectOptions.value
    qs.set('ip', server)
    if (botVersion) qs.set('version', botVersion)
    if (proxy) qs.set('proxy', proxy)
    if (username) qs.set('username', username)
    newQs = String(qs.toString())
  }

  if (newQs) {
    window.history.replaceState({}, '', `${window.location.pathname}?${newQs}`)
  }
}

function cycleHotbarSlot (dir: 1 | -1) {
  const newHotbarSlot = (bot.quickBarSlot + dir + 9) % 9
  bot.setQuickBarSlot(newHotbarSlot)
}

// custom commands handler
const customCommandsHandler = ({ command }) => {
  const [section, name] = command.split('.')
  if (!isGameActive(true) || section !== 'custom') return

  if (contro.userConfig?.custom) {
    customCommandsConfig[(contro.userConfig.custom[name] as CustomCommand).type].handler((contro.userConfig.custom[name] as CustomCommand).inputs)
  }
}
contro.on('trigger', customCommandsHandler)

contro.on('trigger', ({ command }) => {
  const willContinue = !isGameActive(true)
  alwaysPressedHandledCommand(command)
  if (willContinue) return

  const secondActionCommand = secondActionCommands[command]
  if (secondActionCommand) {
    if (command === lastCommandTrigger?.command && Date.now() - lastCommandTrigger.time < secondActionActivationTimeout) {
      const commandToTrigger = secondActionCommands[lastCommandTrigger.command]
      commandToTrigger()
      lastCommandTrigger = null
    } else {
      lastCommandTrigger = {
        command,
        time: Date.now(),
      }
    }
  }

  onTriggerOrReleased(command, true)

  if (stringStartsWith(command, 'general')) {
    switch (command) {
      case 'general.jump':
      case 'general.sneak':
      case 'general.toggleSneakOrDown':
      case 'general.sprint':
      case 'general.attackDestroy':
      case 'general.rotateCameraLeft':
      case 'general.rotateCameraRight':
      case 'general.rotateCameraUp':
      case 'general.rotateCameraDown':
        // no-op
        break
      case 'general.swapHands': {
        if (viewer.world.cameraEntity !== undefined) break
        bot._client.write('block_dig', {
          'status': 6,
          'location': {
            'x': 0,
            'z': 0,
            'y': 0
          },
          'face': 0,
        })
        break
      }
      case 'general.interactPlace':
        // handled in onTriggerOrReleased
        break
      case 'general.inventory':
        if (viewer.world.cameraEntity !== undefined) break
        document.exitPointerLock?.()
        openPlayerInventory()
        break
      case 'general.drop': {
        if (viewer.world.cameraEntity !== undefined) break
        // if (bot.heldItem/* && ctrl */) bot.tossStack(bot.heldItem)
        bot._client.write('block_dig', {
          'status': 4,
          'location': {
            'x': 0,
            'z': 0,
            'y': 0
          },
          'face': 0,
          sequence: 0
        })
        const slot = bot.inventory.hotbarStart + bot.quickBarSlot
        const item = bot.inventory.slots[slot]
        if (item) {
          item.count--
          bot.inventory.updateSlot(slot, item.count > 0 ? item : null!)
        }
        break
      }
      case 'general.chat':
        showModal({ reactType: 'chat' })
        break
      case 'general.command':
        chatInputValueGlobal.value = '/'
        showModal({ reactType: 'chat' })
        break
      case 'general.selectItem':
        if (viewer.world.cameraEntity !== undefined) break
        void selectItem()
        break
      case 'general.nextHotbarSlot':
        if (viewer.world.cameraEntity !== undefined) break
        cycleHotbarSlot(1)
        break
      case 'general.prevHotbarSlot':
        if (viewer.world.cameraEntity !== undefined) break
        cycleHotbarSlot(-1)
        break
      case 'general.zoom':
        break
      case 'general.viewerConsole':
        if (lastConnectOptions.value?.viewerWsConnect) {
          showModal({ reactType: 'console' })
        }
        break
    }
  }

  if (command === 'ui.pauseMenu') {
    showModal({ reactType: 'pause-screen' })
  }

  if (command === 'ui.toggleFullscreen') {
    void goFullscreen(true)
  }
})

// show-hide Fullmap
contro.on('trigger', ({ command }) => {
  if (command !== 'ui.toggleMap') return
  const isActive = isGameActive(true)
  if (activeModalStack.at(-1)?.reactType === 'full-map') {
    miscUiState.displayFullmap = false
    hideModal({ reactType: 'full-map' })
  } else if (isActive && !activeModalStack.length) {
    miscUiState.displayFullmap = true
    showModal({ reactType: 'full-map' })
  }
})

contro.on('release', ({ command }) => {
  inModalCommand(command, false)
  onTriggerOrReleased(command, false)
})

// hard-coded keybindings

export const f3Keybinds: Array<{
  key?: string,
  action: () => void,
  mobileTitle: string
  enabled?: () => boolean
}> = [
  {
    key: 'KeyA',
    action () {
      //@ts-expect-error
      const loadedChunks = Object.entries(worldView.loadedChunks).filter(([, v]) => v).map(([key]) => key.split(',').map(Number))
      for (const [x, z] of loadedChunks) {
        worldView!.unloadChunk({ x, z })
      }
      for (const child of viewer.scene.children) {
        if (child.name === 'chunk') { // should not happen
          viewer.scene.remove(child)
          console.warn('forcefully removed chunk from scene')
        }
      }
      if (localServer) {
        //@ts-expect-error not sure why it is private... maybe revisit api?
        localServer.players[0].world.columns = {}
      }
      void reloadChunks()
    },
    mobileTitle: 'Reload chunks',
  },
  {
    key: 'KeyG',
    action () {
      options.showChunkBorders = !options.showChunkBorders
      viewer.world.updateShowChunksBorder(options.showChunkBorders)
    },
    mobileTitle: 'Toggle chunk borders',
  },
  {
    key: 'KeyY',
    async action () {
      // waypoints
      const widgetNames = widgets.map(widget => widget.name)
      const widget = await showOptionsModal('Open Widget', widgetNames)
      if (!widget) return
      showModal({ reactType: `widget-${widget}` })
    },
    mobileTitle: 'Open Widget'
  },
  {
    key: 'KeyT',
    async action () {
      // TODO!
      if (resourcePackState.resourcePackInstalled || gameAdditionalState.usingServerResourcePack) {
        showNotification('Reloading textures...')
        await completeResourcepackPackInstall('default', 'default', gameAdditionalState.usingServerResourcePack, createNotificationProgressReporter())
      }
    },
    mobileTitle: 'Reload Textures'
  },
  {
    key: 'F4',
    async action () {
      switch (bot.game.gameMode) {
        case 'creative': {
          bot.chat('/gamemode survival')

          break
        }
        case 'survival': {
          bot.chat('/gamemode adventure')

          break
        }
        case 'adventure': {
          bot.chat('/gamemode spectator')

          break
        }
        case 'spectator': {
          bot.chat('/gamemode creative')

          break
        }
      // No default
      }
    },
    mobileTitle: 'Cycle Game Mode'
  },
  {
    key: 'KeyP',
    async action () {
      const { uuid, ping: playerPing, username } = bot.player
      const proxyPing = await bot['pingProxy']()
      void showOptionsModal(`${username}: last known total latency (ping): ${playerPing}. Connected to ${lastConnectOptions.value?.proxy} with current ping ${proxyPing}. Player UUID: ${uuid}`, [])
    },
    mobileTitle: 'Show Player & Ping Details',
    enabled: () => !lastConnectOptions.value?.singleplayer && !!bot.player
  },
  {
    action () {
      void copyServerResourcePackToRegular()
    },
    mobileTitle: 'Copy Server Resource Pack',
    enabled: () => !!gameAdditionalState.usingServerResourcePack
  }
]

const hardcodedPressedKeys = new Set<string>()
document.addEventListener('keydown', (e) => {
  if (!isGameActive(false)) return
  if (hardcodedPressedKeys.has('F3')) {
    const keybind = f3Keybinds.find((v) => v.key === e.code)
    if (keybind && (keybind.enabled?.() ?? true)) {
      keybind.action()
      e.stopPropagation()
    }
    return
  }

  hardcodedPressedKeys.add(e.code)
}, {
  capture: true,
})
document.addEventListener('keyup', (e) => {
  hardcodedPressedKeys.delete(e.code)
})
document.addEventListener('visibilitychange', (e) => {
  if (document.visibilityState === 'hidden') {
    hardcodedPressedKeys.clear()
  }
})

// #region creative fly
// these controls are more like for gamemode 3

const makeInterval = (fn, interval) => {
  const intervalId = setInterval(fn, interval)

  const cleanup = () => {
    clearInterval(intervalId)
    cleanup.active = false
  }
  cleanup.active = true
  return cleanup
}

const isFlying = () => bot.physics.gravity === 0
let endFlyLoop: ReturnType<typeof makeInterval> | undefined

const currentFlyVector = new Vec3(0, 0, 0)
window.currentFlyVector = currentFlyVector

// todo cleanup
const flyingPressedKeys = {
  down: false,
  up: false
}

const startFlyLoop = () => {
  if (!isFlying()) return
  endFlyLoop?.()

  endFlyLoop = makeInterval(() => {
    if (!bot) {
      endFlyLoop?.()
      return
    }

    bot.entity.position.add(currentFlyVector.clone().multiply(new Vec3(0, 0.5, 0)))
  }, 50)
}

// todo we will get rid of patching it when refactor controls
let originalSetControlState
const patchedSetControlState = (action, state) => {
  if (!isFlying()) {
    return originalSetControlState(action, state)
  }

  const actionPerFlyVector = {
    jump: new Vec3(0, 1, 0),
    sneak: new Vec3(0, -1, 0),
  }

  const changeVec = actionPerFlyVector[action]
  if (!changeVec) {
    return originalSetControlState(action, state)
  }
  if (flyingPressedKeys[state === 'jump' ? 'up' : 'down'] === state) return
  const toAddVec = changeVec.scaled(state ? 1 : -1)
  for (const coord of ['x', 'y', 'z']) {
    if (toAddVec[coord] === 0) continue
    if (currentFlyVector[coord] === toAddVec[coord]) return
  }
  currentFlyVector.add(toAddVec)
  flyingPressedKeys[state === 'jump' ? 'up' : 'down'] = state
}

const startFlying = (sendAbilities = true) => {
  bot.entity['creativeFly'] = true
  if (sendAbilities) {
    bot._client.write('abilities', {
      flags: 2,
    })
  }
  // window.flyingSpeed will be removed
  bot.physics['airborneAcceleration'] = window.flyingSpeed ?? 0.1 // todo use abilities
  bot.entity.velocity = new Vec3(0, 0, 0)
  bot.creative.startFlying()
  startFlyLoop()
}

const endFlying = (sendAbilities = true) => {
  bot.entity['creativeFly'] = false
  if (bot.physics.gravity !== 0) return
  if (sendAbilities) {
    bot._client.write('abilities', {
      flags: 0,
    })
  }
  Object.assign(flyingPressedKeys, {
    up: false,
    down: false
  })
  currentFlyVector.set(0, 0, 0)
  bot.physics['airborneAcceleration'] = standardAirborneAcceleration
  bot.creative.stopFlying()
  endFlyLoop?.()
}

let allowFlying = false

export const onBotCreate = () => {
  let wasSpectatorFlying = false
  bot._client.on('abilities', ({ flags }) => {
    if (flags & 2) { // flying
      toggleFly(true, false)
    } else {
      toggleFly(false, false)
    }
    allowFlying = !!(flags & 4)
  })
  const gamemodeCheck = () => {
    if (bot.game.gameMode === 'spectator') {
      toggleFly(true, false)
      wasSpectatorFlying = true
    } else if (wasSpectatorFlying) {
      toggleFly(false, false)
      wasSpectatorFlying = false
    }
  }
  bot.on('game', () => {
    gamemodeCheck()
  })
  bot.on('login', () => {
    gamemodeCheck()
  })
}

const standardAirborneAcceleration = 0.02
const toggleFly = (newState = !isFlying(), sendAbilities?: boolean) => {
  // if (bot.game.gameMode !== 'creative' && bot.game.gameMode !== 'spectator') return
  if (!allowFlying) return
  if (bot.setControlState !== patchedSetControlState) {
    originalSetControlState = bot.setControlState
    bot.setControlState = patchedSetControlState
  }

  if (newState) {
    startFlying(sendAbilities)
  } else {
    endFlying(sendAbilities)
  }
  gameAdditionalState.isFlying = isFlying()
}
// #endregion

const selectItem = async () => {
  const block = bot.blockAtCursor(5)
  if (!block) return
  const itemId = getItemFromBlock(block)?.id
  if (!itemId) return
  const Item = require('prismarine-item')(bot.version)
  const item = new Item(itemId, 1, 0)
  await bot.creative.setInventorySlot(bot.inventory.hotbarStart + bot.quickBarSlot, item)
  bot.updateHeldItem()
}

addEventListener('mousedown', async (e) => {
  if ((e.target as HTMLElement).matches?.('#VRButton')) return
  if (!isInRealGameSession() && !(e.target as HTMLElement).id.includes('ui-root')) return
  void pointerLock.requestPointerLock()
  if (!bot) return
  // wheel click
  // todo support ctrl+wheel (+nbt)
  if (e.button === 1) {
    await selectItem()
  }
})

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return
  if (activeModalStack.length) {
    const hideAll = e.ctrlKey || e.metaKey
    if (hideAll) {
      hideAllModals()
    } else {
      hideCurrentModal()
    }
    if (activeModalStack.length === 0) {
      pointerLock.justHitEscape = true
    }
  } else if (pointerLock.hasPointerLock) {
    document.exitPointerLock?.()
    if (options.autoExitFullscreen) {
      void document.exitFullscreen()
    }
  } else {
    document.dispatchEvent(new Event('pointerlockchange'))
  }
})

window.addEventListener('keydown', (e) => {
  if (e.code !== 'F2' || e.repeat || !isGameActive(true)) return
  e.preventDefault()
  const canvas = document.getElementById('viewer-canvas') as HTMLCanvasElement
  if (!canvas) return
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  const date = new Date()
  link.download = `screenshot ${date.toLocaleString().replaceAll('.', '-').replace(',', '')}.png`
  link.click()
})

window.addEventListener('keydown', (e) => {
  if (e.code !== 'F1' || e.repeat || !isGameActive(true)) return
  e.preventDefault()
  miscUiState.showUI = !miscUiState.showUI
})

// #region experimental debug things
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyL' && e.altKey) {
    console.clear()
  }
})
// #endregion

export function updateBinds (commands: any) {
  contro.inputSchema.commands.custom = Object.fromEntries(Object.entries(commands?.custom ?? {}).map(([key, value]) => {
    return [key, {
      keys: [],
      gamepad: [],
      type: '',
      inputs: []
    }]
  }))

  for (const [group, actions] of Object.entries(commands)) {
    contro.userConfig![group] = Object.fromEntries(Object.entries(actions).map(([key, value]) => {
      const newValue = {
        keys: value?.keys ?? undefined,
        gamepad: value?.gamepad ?? undefined,
      }

      if (group === 'custom') {
        newValue['type'] = (value).type
        newValue['inputs'] = (value).inputs
      }

      return [key, newValue]
    }))
  }
}
