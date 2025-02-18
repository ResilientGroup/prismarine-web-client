export default () => {
  let i = 0
  bot.pingProxy = async () => {
    const curI = ++i
    return new Promise(resolve => {
      //@ts-expect-error
      bot._client.socket._ws.send(`ping:${curI}`)
      const date = Date.now()
      const onPong = (received) => {
        if (received !== curI.toString()) return
        bot._client.socket.off('pong' as any, onPong)
        resolve(Date.now() - date)
      }
      bot._client.socket.on('pong' as any, onPong)
    })
  }

  let pingPending = false
  bot.pingServer = async () => {
    if (pingPending) return
    pingPending = true
    return new Promise<number>((resolve) => {
      bot._client.write('ping' as any, { time: [0, 0] })
      const date = Date.now()
      const onPong = () => {
        bot._client.off('ping' as any, onPong)
        resolve(Date.now() - date)
        pingPending = false
      }
      bot._client.on('ping' as any, onPong)
    })
  }
}

declare module 'mineflayer' {
  interface Bot {
    pingProxy: () => Promise<number>
    pingServer: () => Promise<number | undefined>
  }
}
