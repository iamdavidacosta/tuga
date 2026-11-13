import { useEffect, useState } from 'react'

import {
  disablePushNotifications,
  enablePushNotifications,
  readPushNotificationState,
  sendPushNotificationTest,
} from './notificationService'
import type { PushNotificationState } from './types'

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setState(await readPushNotificationState())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos consultar tus recordatorios.')
    }
  }

  useEffect(() => { queueMicrotask(() => { void refresh() }) }, [])

  const run = async (operation: () => Promise<void>, successMessage: string) => {
    if (isBusy) return
    setIsBusy(true)
    setMessage('')
    setErrorMessage(null)
    try {
      await operation()
      setMessage(successMessage)
      await refresh()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos completar la acción.')
    } finally {
      setIsBusy(false)
    }
  }

  return {
    state,
    isBusy,
    message,
    errorMessage,
    enable: () => run(enablePushNotifications, 'Recordatorios activados en este dispositivo.'),
    disable: () => run(disablePushNotifications, 'Recordatorios desactivados en este dispositivo.'),
    test: async () => {
      if (isBusy) return
      setIsBusy(true)
      setMessage('')
      setErrorMessage(null)
      try {
        setMessage(await sendPushNotificationTest())
        await refresh()
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'No pudimos realizar la prueba.')
      } finally {
        setIsBusy(false)
      }
    },
  }
}
