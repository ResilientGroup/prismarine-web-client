import { viewerConnector } from 'mcraft-fun-mineflayer'
import { PACKETS_REPLAY_FILE_EXTENSION, WORLD_STATE_FILE_EXTENSION } from 'mcraft-fun-mineflayer/build/worldState'
import { Bot } from 'mineflayer'

export const localRelayServerPlugin = (bot: Bot) => {
  bot.loadPlugin(
    viewerConnector({
      tcpEnabled: false,
      websocketEnabled: false,
    })
  )

  bot.downloadCurrentWorldState = () => {
    const worldState = bot.webViewer._unstable.createStateCaptureFile()
    const a = document.createElement('a')
    const textContents = worldState.contents
    const blob = new Blob([textContents], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    a.href = url
    // add readable timestamp to filename
    const timestamp = new Date().toISOString().replaceAll(/[-:Z]/g, '')
    a.download = `${bot.username}-world-state-${timestamp}.${WORLD_STATE_FILE_EXTENSION}`
    a.click()
    URL.revokeObjectURL(url)
  }
}

declare module 'mineflayer' {
  interface Bot {
    downloadCurrentWorldState: () => void
  }
}
