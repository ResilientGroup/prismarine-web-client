import { useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { openURL } from 'renderer/viewer/lib/simpleUtils'
import { noCase } from 'change-case'
import { gameAdditionalState, miscUiState, openOptionsMenu, showModal } from './globalState'
import { AppOptions, options } from './optionsStorage'
import Button from './react/Button'
import { OptionMeta, OptionSlider } from './react/OptionsItems'
import Slider from './react/Slider'
import { getScreenRefreshRate } from './utils'
import { setLoadingScreenStatus } from './appStatus'
import { openFilePicker, resetLocalStorageWithoutWorld } from './browserfs'
import { completeResourcepackPackInstall, getResourcePackNames, resourcePackState, uninstallResourcePack } from './resourcePack'
import { downloadPacketsReplay, packetsRecordingState } from './packetsReplay/packetsReplayLegacy'
import { showOptionsModal } from './react/SelectOption'
import supportedVersions from './supportedVersions.mjs'
import { getVersionAutoSelect } from './connect'
import { createNotificationProgressReporter } from './core/progressReporter'

export const guiOptionsScheme: {
  [t in OptionsGroupType]: Array<{ [K in keyof AppOptions]?: Partial<OptionMeta<AppOptions[K]>> } & { custom? }>
} = {
  render: [
    {
      custom () {
        const frameLimitValue = useSnapshot(options).frameLimit
        const [frameLimitMax, setFrameLimitMax] = useState(null as number | null)

        return <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Slider
            style={{ width: 130 }}
            label='Frame Limit'
            disabledReason={frameLimitMax ? undefined : 'press lock button first'}
            unit={frameLimitValue ? 'fps' : ''}
            valueDisplay={frameLimitValue || 'VSync'}
            value={frameLimitValue || frameLimitMax! + 1} min={20}
            max={frameLimitMax! + 1} updateValue={(newVal) => {
              options.frameLimit = newVal > frameLimitMax! ? false : newVal
            }}
          />
          <Button
            style={{ width: 20 }} icon='pixelarticons:lock-open' onClick={async () => {
              const rate = await getScreenRefreshRate()
              setFrameLimitMax(rate)
            }}
          />
        </div>
      }
    },
    {
      gpuPreference: {
        text: 'GPU Preference',
        tooltip: 'You will need to reload the page for this to take effect.',
        values: [['default', 'Auto'], ['high-performance', 'Dedicated'], ['low-power', 'Low Power']]
      },
    },
    {
      custom () {
        return <Button label='Guide: Disable VSync' onClick={() => openURL('https://gist.github.com/zardoy/6e5ce377d2b4c1e322e660973da069cd')} inScreen />
      },
    },
    {
      backgroundRendering: {
        text: 'Background FPS limit',
        values: [
          ['full', 'NO'],
          ['5fps', '5 FPS'],
          ['20fps', '20 FPS'],
        ],
      },
    },
    {
      custom () {
        return <Category>Experimental</Category>
      },
      dayCycleAndLighting: {
        text: 'Day Cycle',
      },
      smoothLighting: {},
      newVersionsLighting: {
        text: 'Lighting in Newer Versions',
      },
      lowMemoryMode: {
        text: 'Low Memory Mode',
        enableWarning: 'Enabling it will make chunks load ~4x slower',
        disabledDuringGame: true
      },
      starfieldRendering: {},
      renderEntities: {},
      unknownEntityDisplay: {
        tooltip: 'Show or hide the placeholder box and entity name text for unknown entities',
      },
      keepChunksDistance: {
        max: 5,
        unit: '',
        tooltip: 'Additional distance to keep the chunks loading before unloading them by marking them as too far',
      },
      renderEars: {
        tooltip: 'Enable rendering Deadmau5 ears for all players if their skin contains textures for it',
      },
      renderDebug: {
        values: [
          'advanced',
          'basic',
          'none'
        ],
      },
    },
    {
      custom () {
        return <Category>Resource Packs</Category>
      },
      serverResourcePacks: {
        text: 'Download From Server',
        values: [
          'prompt',
          'always',
          'never'
        ],
      }
    }
  ],
  main: [
    {
      fov: {
        min: 30,
        max: 110,
        unit: '',
      }
    },
    {
      custom () {
        const sp = miscUiState.singleplayer || !miscUiState.gameLoaded
        const id = sp ? 'renderDistance' : 'multiplayerRenderDistance' // cant be changed when settings are open
        return <OptionSlider item={{
          type: 'slider',
          id,
          text: 'Render Distance',
          unit: '',
          max: sp ? 16 : 12,
          min: 1
        }}
        />
      },
    },
    {
      custom () {
        return <Button label='Render...' onClick={() => openOptionsMenu('render')} inScreen />
      },
    },
    {
      custom () {
        return <Button label='Interface...' onClick={() => openOptionsMenu('interface')} inScreen />
      },
    },
    {
      custom () {
        return <Button label='Controls...' onClick={() => openOptionsMenu('controls')} inScreen />
      },
    },
    {
      custom () {
        return <Button label='Sound...' onClick={() => openOptionsMenu('sound')} inScreen />
      },
    },
    {
      custom () {
        const { resourcePackInstalled } = useSnapshot(resourcePackState)
        const { usingServerResourcePack } = useSnapshot(gameAdditionalState)
        const { enabledResourcepack } = useSnapshot(options)
        return <Button
          label={`Resource Pack: ${usingServerResourcePack ? 'SERVER ON' : resourcePackInstalled ? enabledResourcepack ? 'ON' : 'OFF' : 'NO'}`} inScreen onClick={async () => {
            if (resourcePackState.resourcePackInstalled) {
              const names = Object.keys(await getResourcePackNames())
              const name = names[0]
              const choices = [
                options.enabledResourcepack ? 'Disable' : 'Enable',
                'Uninstall',
              ]
              const choice = await showOptionsModal(`Resource Pack ${name} action`, choices)
              if (!choice) return
              if (choice === 'Disable') {
                options.enabledResourcepack = null
                return
              }
              if (choice === 'Enable') {
                options.enabledResourcepack = name
                await completeResourcepackPackInstall(name, name, false, createNotificationProgressReporter())
                return
              }
              if (choice === 'Uninstall') {
              // todo make hidable
                setLoadingScreenStatus('Uninstalling texturepack')
                await uninstallResourcePack()
                setLoadingScreenStatus(undefined)
              }
            } else {
            // if (!fsState.inMemorySave && isGameActive(false)) {
            //   alert('Unable to install resource pack in loaded save for now')
            //   return
            // }
              openFilePicker('resourcepack')
            }
          }}
        />
      },
    },
    {
      custom () {
        return <Button label='Advanced...' onClick={() => openOptionsMenu('advanced')} inScreen />
      },
    },
    {
      custom () {
        return <Button label='VR...' onClick={() => openOptionsMenu('VR')} inScreen />
      },
    }
  ],
  interface: [
    {
      guiScale: {
        max: 4,
        min: 1,
        unit: '',
        delayApply: true,
      },
      custom () {
        return <Category>Chat</Category>
      },
      chatWidth: {
        max: 320,
        unit: 'px',
      },
      chatHeight: {
        max: 180,
        unit: 'px',
      },
      chatOpacity: {
      },
      chatOpacityOpened: {
      },
      chatSelect: {
      },
    },
    {
      custom () {
        return <Category>World</Category>
      },
      highlightBlockColor: {
        text: 'Block Highlight Color',
        values: [
          ['auto', 'Auto'],
          ['blue', 'Blue'],
          ['classic', 'Classic']
        ],
      },
      showHand: {
        text: 'Show Hand',
      },
      viewBobbing: {
        text: 'View Bobbing',
      },
    },
    {
      custom () {
        return <Category>Sign Editor</Category>
      },
      autoSignEditor: {
        text: 'Enable Sign Editor',
      },
      wysiwygSignEditor: {
        text: 'WYSIWG Editor',
        values: [
          'auto',
          'always',
          'never'
        ],
      },
    },
    {
      custom () {
        return <Category>Map</Category>
      },
      showMinimap: {
        text: 'Enable Minimap',
        values: [
          'always',
          'singleplayer',
          'never'
        ],
      },
    },
    {
      custom () {
        return <Category>Experimental</Category>
      },
      displayBossBars: {
        text: 'Boss Bars',
      },
    },
    {
      custom () {
        return <UiToggleButton name='title' addUiText />
      },
    },
    {
      custom () {
        return <UiToggleButton name='chat' addUiText />
      },
    },
    {
      custom () {
        return <UiToggleButton name='scoreboard' addUiText />
      },
    },
    {
      custom () {
        return <UiToggleButton name='effects-indicators' />
      },
    },
    {
      custom () {
        return <UiToggleButton name='hotbar' />
      },
    },
  ],
  controls: [
    {
      custom () {
        return <Category>Keyboard & Mouse</Category>
      },
    },
    {
      custom () {
        return <Button
          inScreen
          onClick={() => {
            showModal({ reactType: 'keybindings' })
          }}
        >Keybindings
        </Button>
      },
      mouseSensX: {},
      mouseSensY: {
        min: -1,
        valueText (value) {
          return value === -1 ? 'Same as X' : `${value}`
        },
      },
      mouseRawInput: {
        tooltip: 'Wether to disable any mouse acceleration (MC does it by default). Most probably it is still supported only by Chrome.',
        // eslint-disable-next-line no-extra-boolean-cast
        disabledReason: Boolean(document.documentElement.requestPointerLock) ? undefined : 'Your browser does not support pointer lock.',
      },
      autoFullScreen: {
        tooltip: 'Auto Fullscreen allows you to use Ctrl+W and Escape having to wait/click on screen again.',
        disabledReason: navigator['keyboard'] ? undefined : 'Your browser doesn\'t support keyboard lock API'
      },
      autoExitFullscreen: {
        tooltip: 'Exit fullscreen on escape (pause menu open). But note you can always do it with F11.',
      },
    },
    {
      custom () {
        return <Category>Touch Controls</Category>
      },
      alwaysShowMobileControls: {
        text: 'Always Mobile Controls',
      },
      touchButtonsSize: {
        min: 40,
        disableIf: [
          'touchMovementType',
          'modern'
        ],
      },
      touchButtonsOpacity: {
        min: 10,
        max: 90,
        disableIf: [
          'touchMovementType',
          'modern'
        ],
      },
      touchButtonsPosition: {
        max: 80,
        disableIf: [
          'touchMovementType',
          'modern'
        ],
      },
      touchMovementType: {
        text: 'Movement Controls',
        values: [['modern', 'Modern'], ['classic', 'Classic']],
      },
      touchInteractionType: {
        text: 'Interaction Controls',
        values: [['classic', 'Classic'], ['buttons', 'Buttons']],
      },
    },
    {
      custom () {
        const { touchInteractionType, touchMovementType } = useSnapshot(options)
        return <Button label='Setup Touch Buttons' onClick={() => showModal({ reactType: 'touch-buttons-setup' })} inScreen disabled={touchInteractionType === 'classic' && touchMovementType === 'classic'} />
      },
    },
    {
      custom () {
        return <Category>Auto Jump</Category>
      },
      autoJump: {
        values: [
          'always',
          'auto',
          'never'
        ],
        disableIf: [
          'autoParkour',
          true
        ],
      },
      autoParkour: {},
    }
  ],
  sound: [
    { volume: {} },
    {
      custom () {
        return <Button label='Sound Muffler' onClick={() => showModal({ reactType: 'sound-muffler' })} inScreen />
      },
    }
    // { ignoreSilentSwitch: {} },
  ],

  VR: [
    {
      custom () {
        return (
          <>
            <span style={{ fontSize: 9, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              VR currently has basic support
            </span>
            <div />
          </>
        )
      },
      vrSupport: {}
    },
  ],
  advanced: [
    {
      custom () {
        return <Button
          inScreen
          onClick={() => {
            if (confirm('Are you sure you want to reset all settings?')) resetLocalStorageWithoutWorld()
          }}
        >Reset all settings</Button>
      },
    },
    {
      custom () {
        return <Button label='Export/Import...' onClick={() => openOptionsMenu('export-import')} inScreen />
      }
    },
    {
      custom () {
        return <Category>Server Connection</Category>
      },
    },
    {
      custom () {
        const { serversAutoVersionSelect } = useSnapshot(options)
        const allVersions = [...supportedVersions, 'latest', 'auto']
        const currentIndex = allVersions.indexOf(serversAutoVersionSelect)

        const getDisplayValue = (version: string) => {
          const versionAutoSelect = getVersionAutoSelect(version)
          if (version === 'latest') return `latest (${versionAutoSelect})`
          if (version === 'auto') return `auto (${versionAutoSelect})`
          return version
        }

        return <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Slider
            style={{ width: 150 }}
            label='Default Version'
            title='First version to try to connect with'
            value={currentIndex}
            min={0}
            max={allVersions.length - 1}
            valueDisplay={getDisplayValue(serversAutoVersionSelect)}
            updateValue={(newVal) => {
              options.serversAutoVersionSelect = allVersions[newVal]
            }}
          />
        </div>
      },
    },
    {
      preventBackgroundTimeoutKick: {}
    },
    {
      custom () {
        return <Category>Developer</Category>
      },
    },
    {
      custom () {
        const { active } = useSnapshot(packetsRecordingState)
        return <Button
          inScreen
          onClick={() => {
            packetsRecordingState.active = !active
          }}
        >{active ? 'Stop' : 'Start'} Packets Replay Logging</Button>
      },
    },
    {
      custom () {
        const { active, hasRecordedPackets } = useSnapshot(packetsRecordingState)
        return <Button
          disabled={!hasRecordedPackets}
          inScreen
          onClick={() => {
            void downloadPacketsReplay()
          }}
        >Download Packets Replay</Button>
      },
    },
    {
      packetsLoggerPreset: {
        text: 'Packets Logger Preset',
        values: [
          ['all', 'All'],
          ['no-buffers', 'No Buffers']
        ],
      },
    },
  ],
}
export type OptionsGroupType = 'main' | 'render' | 'interface' | 'controls' | 'sound' | 'advanced' | 'VR'

const Category = ({ children }) => <div style={{
  fontSize: 9,
  textAlign: 'center',
  gridColumn: 'span 2'
}}>{children}</div>

const UiToggleButton = ({ name, addUiText = false, label = noCase(name) }) => {
  const { disabledUiParts } = useSnapshot(options)

  const currentlyDisabled = disabledUiParts.includes(name)
  if (addUiText) label = `${label} UI`
  return <Button
    inScreen
    onClick={() => {
      const newDisabledUiParts = currentlyDisabled ? disabledUiParts.filter(x => x !== name) : [...disabledUiParts, name]
      options.disabledUiParts = newDisabledUiParts
    }}
  >{currentlyDisabled ? 'Enable' : 'Disable'} {label}</Button>
}

export const tryFindOptionConfig = (option: keyof AppOptions) => {
  for (const group of Object.values(guiOptionsScheme)) {
    for (const optionConfig of group) {
      if (option in optionConfig) {
        return optionConfig[option]
      }
    }
  }

  return null
}
