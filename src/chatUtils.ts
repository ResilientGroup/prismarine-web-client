// this should actually be moved to mineflayer / prismarine-viewer

import { fromFormattedString, TextComponent } from '@xmcl/text-component'
import type { IndexedData } from 'minecraft-data'
import { versionToNumber } from 'prismarine-viewer/viewer/prepare/utils'

export type MessageFormatPart = Pick<TextComponent, 'hoverEvent' | 'clickEvent'> & {
  text: string
  color?: string
  bold?: boolean
  italic?: boolean
  underlined?: boolean
  strikethrough?: boolean
  obfuscated?: boolean
  extra?: MessageFormatPart[]
}

type MessageInput = {
  text?: string
  translate?: string
  with?: Array<MessageInput | string>
  color?: string
  bold?: boolean
  italic?: boolean
  underlined?: boolean
  strikethrough?: boolean
  obfuscated?: boolean
  extra?: MessageInput[]
  json?: any
}

const global = globalThis as any

// todo move to sign-renderer, replace with prismarine-chat, fix mcData issue!
export const formatMessage = (message: MessageInput, mcData: IndexedData = global.loadedData) => {
  let msglist: MessageFormatPart[] = []

  const readMsg = (msg: MessageInput) => {
    const styles = {
      color: msg.color,
      bold: !!msg.bold,
      italic: !!msg.italic,
      underlined: !!msg.underlined,
      strikethrough: !!msg.strikethrough,
      obfuscated: !!msg.obfuscated
    }

    let messagePart
    if (msg.text) {
      messagePart = {
        ...msg,
        text: msg.text,
        ...styles,
        extra: []
      }
    } else if (msg.translate) {
      const tText = mcData?.language[msg.translate] ?? msg.translate

      if (msg.with) {
        const splitted = tText.split(/%s|%\d+\$s/g)

        let i = 0
        for (const [j, part] of splitted.entries()) {
          messagePart = { text: part, ...styles, extra: [] }

          if (j + 1 < splitted.length) {
            if (msg.with[i]) {
              const msgWith = msg.with[i]
              if (typeof msgWith === 'string') {
                formatMessage({
                  ...styles,
                  text: msgWith
                }).forEach((msg) => {messagePart.extra.push(msg)})
              } else {
                formatMessage({
                  ...styles,
                  ...msgWith
                }).forEach((msg) => {messagePart.extra.push(msg)})
              }
            }
            i++
          }
        }
      } else {
        messagePart = {
          ...msg,
          text: tText,
          ...styles,
          extra: []
        }
      }
    }

    if (msg.extra) {
      for (const ex of msg.extra) {
        formatMessage({ ...styles, ...ex }).forEach((msg) => { messagePart.extra?.push(msg) })
      }
    }

    msglist.push(messagePart)
  }

  readMsg(message)

  const flat = (msg) => {
    return [msg, msg.extra?.flatMap(flat) ?? []]
  }

  msglist = msglist.map(msg => {
    // normalize §
    if (!msg.text.includes?.('§')) return msg
    const newMsg = fromFormattedString(msg.text)
    return flat(newMsg)
  }).flat(Infinity)

  return msglist
}

const blockToItemRemaps = {
  water: 'water_bucket',
  lava: 'lava_bucket',
  redstone_wire: 'redstone',
  tripwire: 'tripwire_hook'
}

export const getItemFromBlock = (block: import('prismarine-block').Block) => {
  const item = global.loadedData.itemsByName[blockToItemRemaps[block.name] ?? block.name]
  return item
}
