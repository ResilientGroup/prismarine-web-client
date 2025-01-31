import { useState, useEffect } from 'react'
import BossBar, { BossBarType } from './BossBarOverlay'
import './BossBarOverlay.css'


export default () => {
  const [bossBars, setBossBars] = useState(new Map<string, BossBarType>())
  const addBossBar = (bossBar: BossBarType) => {
    setBossBars(prevBossBars => new Map(prevBossBars.set(bossBar.entityUUID, bossBar)))
  }

  const removeBossBar = (bossBar: BossBarType) => {
    setBossBars(prevBossBars => {
      const newBossBars = new Map(prevBossBars)
      newBossBars.delete(bossBar.entityUUID)
      return newBossBars
    })
  }

  useEffect(() => {
    bot.on('bossBarCreated', (bossBar) => {
      addBossBar(bossBar as BossBarType)
    })
    bot.on('bossBarUpdated', (bossBar) => {
      removeBossBar(bossBar as BossBarType)
      setTimeout(() => addBossBar(bossBar as BossBarType), 1)
    })
    bot.on('bossBarDeleted', (bossBar) => {
      removeBossBar(bossBar as BossBarType)
    })
  }, [])

  return (
    <div className="bossBars" id="bossBars">
      {[...bossBars.values()].map(bar => (
        <BossBar key={bar.entityUUID} bar={bar} />
      ))}
    </div>
  )
}
