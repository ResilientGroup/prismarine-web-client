import { useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
import { formatMessage } from '../chatUtils'
import { getBuiltinCommandsList, tryHandleBuiltinCommand } from '../builtinCommands'
import { gameAdditionalState, hideCurrentModal, miscUiState } from '../globalState'
import { options } from '../optionsStorage'
import { viewerVersionState } from '../viewerConnector'
import Chat, { Message, fadeMessage } from './Chat'
import { useIsModalActive } from './utilsApp'
import { hideNotification, showNotification } from './NotificationProvider'
import { updateLoadedServerData } from './serversStorage'
import { lastConnectOptions } from './AppStatusProvider'

export default () => {
  const [messages, setMessages] = useState([] as Message[])
  const isChatActive = useIsModalActive('chat')
  const { messagesLimit, chatOpacity, chatOpacityOpened } = options
  const lastMessageId = useRef(0)
  const usingTouch = useSnapshot(miscUiState).currentTouch
  const { chatSelect } = useSnapshot(options)
  const isUsingMicrosoftAuth = useMemo(() => !!lastConnectOptions.value?.authenticatedAccount, [])
  const { forwardChat } = useSnapshot(viewerVersionState)
  const { viewerConnection } = useSnapshot(gameAdditionalState)

  useEffect(() => {
    bot.addListener('message', (jsonMsg, position) => {
      if (position === 'game_info') return // ignore action bar messages, they are handled by the TitleProvider
      if (jsonMsg['unsigned']) {
        jsonMsg = jsonMsg['unsigned']
      }
      const parts = formatMessage(jsonMsg)

      setMessages(m => {
        lastMessageId.current++
        const newMessage: Message = {
          parts,
          id: lastMessageId.current,
          faded: false,
        }
        fadeMessage(newMessage, true, () => {
          // eslint-disable-next-line max-nested-callbacks
          setMessages(m => [...m])
        })
        return [...m, newMessage].slice(-messagesLimit)
      })
    })
  }, [])

  return <Chat
    allowSelection={chatSelect}
    usingTouch={!!usingTouch}
    opacity={(isChatActive ? chatOpacityOpened : chatOpacity) / 100}
    messages={messages}
    opened={isChatActive}
    placeholder={forwardChat || !viewerConnection ? undefined : 'Chat forwarding is not enabled in the plugin settings'}
    sendMessage={(message) => {
      const builtinHandled = tryHandleBuiltinCommand(message)
      if (miscUiState.loadedServerIndex && (message.startsWith('/login') || message.startsWith('/register'))) {
        showNotification('Click here to save your password in browser for auto-login', undefined, false, undefined, () => {
          updateLoadedServerData((server) => {
            server.autoLogin ??= {}
            const password = message.split(' ')[1]
            server.autoLogin[bot.player.username] = password
            return server
          })
          hideNotification()
        })
      }
      if (!builtinHandled) {
        bot.chat(message)
      }
    }}
    onClose={() => {
      hideCurrentModal()
    }}
    fetchCompletionItems={async (triggerKind, completeValue) => {
      if ((triggerKind === 'explicit' || options.autoRequestCompletions)) {
        let items = [] as string[]
        try {
          items = await bot.tabComplete(completeValue, true, true)
        } catch (err) { }
        if (typeof items[0] === 'object') {
          // @ts-expect-error
          if (items[0].match) items = items.map(i => i.match)
        }
        if (completeValue === '/') {
          if (!items[0]?.startsWith('/')) {
            // normalize
            items = items.map(item => `/${item}`)
          }
          if (items.length) {
            items = [...items, ...getBuiltinCommandsList()]
          }
        }
        return items
      }
    }}
  />
}
