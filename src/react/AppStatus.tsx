import { useEffect, useState } from 'react'
import { appQueryParams } from '../appParams'
import styles from './appStatus.module.css'
import Button from './Button'
import Screen from './Screen'
import LoadingChunks from './LoadingChunks'

export default ({
  status,
  isError,
  hideDots = false,
  lastStatus = '',
  backAction = undefined as undefined | (() => void),
  description = '' as string | JSX.Element,
  actionsSlot = null as React.ReactNode | null,
  showReconnect = false,
  onReconnect = undefined as undefined | (() => void),
  children
}) => {
  const [loadingDotIndex, setLoadingDotIndex] = useState(0)
  const lockConnect = appQueryParams.lockConnect === 'true'

  useEffect(() => {
    const statusRunner = async () => {
      const timer = async (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

      const load = async () => {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          setLoadingDotIndex(i => (i + 1) % 4)
          await timer(500) // eslint-disable-line no-await-in-loop
        }
      }

      void load()
    }

    void statusRunner()
  }, [])


  return (
    <Screen
      className='small-content'
      titleSelectable={isError}
      title={
        <>
          <span style={{
            wordBreak: 'break-word',
          }}
          >
            {status}
          </span>
          <div style={{ display: 'inline-flex', gap: '1px', }} hidden={hideDots || isError}>
            {
              [...'...'].map((dot, i) => {
                return <span
                  key={i} style={{
                    visibility: loadingDotIndex <= i ? 'hidden' : 'visible',
                  }}>{dot}</span>
              })
            }
          </div>
          <p className={styles.description}>{description}</p>
          <p className={styles['last-status']}>{lastStatus ? `Last status: ${lastStatus}` : lastStatus}</p>
        </>
      }
      backdrop='dirt'
    >
      {isError && (
        <>
          {showReconnect && onReconnect && <Button label="Reconnect" onClick={onReconnect} />}
          {actionsSlot}
          <Button
            onClick={() => {
              if (location.search) {
                location.search = ''
              } else {
                window.location.reload()
              }
            }}
            label="Reset App (recommended)"
          />
          {!lockConnect && backAction && <Button label="Back" onClick={backAction} />}
        </>
      )}
      {children}
    </Screen>
  )
}
