import { useEffect, useState } from 'react'
import { lastConnectOptions } from './AppStatusProvider'
import PixelartIcon, { pixelartIcons } from './PixelartIcon'
import styles from './NetworkStatus.module.css'

export default () => {
  const [proxyPing, setProxyPing] = useState<number | null>(null)
  const [serverPing, setServerPing] = useState<number | null>(null)

  useEffect(() => {
    if (!lastConnectOptions.value?.proxy) return

    let update = 0

    const updatePing = async () => {
      const currentUpdate = ++update

      const updateServerPing = async () => {
        const ping = await bot.pingServer()
        if (ping) setServerPing(ping)
      }

      const updateProxyPing = async () => {
        const ping = await bot.pingProxy()
        setProxyPing(ping)
      }

      try {
        await Promise.all([updateServerPing(), updateProxyPing()])
      } catch (err) {
        console.error('Failed to ping:', err)
      }
    }

    void updatePing()
    const interval = setInterval(updatePing, 1000)
    return () => clearInterval(interval)
  }, [])

  // if (!lastConnectOptions.value?.proxy) return null

  const { username } = bot.player
  const { proxy: proxyUrl, server: serverIp } = lastConnectOptions.value!
  const pingTotal = serverPing

  const ICON_SIZE = 18
  return (
    <div className={styles.container}>
      <PixelartIcon className={styles.iconRow} iconName={pixelartIcons.monitor} width={ICON_SIZE} />
      <PixelartIcon className={`${styles.iconRow} ${styles.arrowRow}`} iconName={pixelartIcons['arrow-right']} width={16} />
      <PixelartIcon className={styles.iconRow} iconName={pixelartIcons.server} width={ICON_SIZE} />
      <PixelartIcon className={`${styles.iconRow} ${styles.arrowRow}`} iconName={pixelartIcons['arrow-right']} width={16} />
      <PixelartIcon className={styles.iconRow} iconName={pixelartIcons['list-box']} width={ICON_SIZE} />

      <span className={styles.dataRow}>{username}</span>
      <span className={`${styles.dataRow} ${styles.ping}`}>{proxyPing}ms</span>
      <span className={styles.dataRow}>{proxyUrl}</span>
      <span className={`${styles.dataRow} ${styles.ping}`}>{pingTotal ? pingTotal - (proxyPing ?? 0) : '...'}ms</span>
      <span className={styles.dataRow}>{serverIp}</span>

      <span className={styles.totalRow}>Ping: {pingTotal}ms</span>
    </div>
  )
}
