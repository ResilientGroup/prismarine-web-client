import { disabledSettings, options, qsOptions } from './optionsStorage'
import { miscUiState } from './globalState'
import { setLoadingScreenStatus } from './appStatus'

export type AppConfig = {
  // defaultHost?: string
  // defaultHostSave?: string
  defaultProxy?: string
  // defaultProxySave?: string
  // defaultVersion?: string
  peerJsServer?: string
  peerJsServerFallback?: string
  promoteServers?: Array<{ ip, description, version? }>
  mapsProvider?: string

  appParams?: Record<string, any> // query string params

  defaultSettings?: Record<string, any>
  forceSettings?: Record<string, boolean>
  // hideSettings?: Record<string, boolean>
  allowAutoConnect?: boolean
  pauseLinks?: Array<Array<Record<string, any>>>

  skinTexturesProxy?: string
}

export const loadAppConfig = (appConfig: AppConfig) => {
  if (miscUiState.appConfig) {
    Object.assign(miscUiState.appConfig, appConfig)
  } else {
    miscUiState.appConfig = appConfig
  }

  if (appConfig.forceSettings) {
    for (const [key, value] of Object.entries(appConfig.forceSettings)) {
      if (value) {
        disabledSettings.value.add(key)
        // since the setting is forced, we need to set it to that value
        if (appConfig.defaultSettings?.[key] && !qsOptions[key]) {
          options[key] = appConfig.defaultSettings[key]
        }
      } else {
        disabledSettings.value.delete(key)
      }
    }
  }
}

export const isBundledConfigUsed = !!process.env.INLINED_APP_CONFIG

if (isBundledConfigUsed) {
  loadAppConfig(process.env.INLINED_APP_CONFIG as AppConfig ?? {})
} else {
  void window.fetch('config.json').then(async res => res.json()).then(c => c, (error) => {
  // console.warn('Failed to load optional app config.json', error)
  // return {}
    setLoadingScreenStatus('Failed to load app config.json', true)
  }).then((config: AppConfig) => {
    loadAppConfig(config)
  })
}
