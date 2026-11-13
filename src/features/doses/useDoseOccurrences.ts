import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '../auth/authContext'
import { listDoseOccurrences, subscribeToDoseChanges } from './doseService'
import type { DoseOccurrence } from './types'

export function useDoseOccurrences(from: string, to: string, enabled = true) {
  const { user } = useAuth()
  const [occurrences, setOccurrences] = useState<DoseOccurrence[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const requestNumber = useRef(0)

  const reload = useCallback(async () => {
    const currentRequest = ++requestNumber.current
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const next = await listDoseOccurrences(from, to)
      if (currentRequest === requestNumber.current) setOccurrences(next)
    } catch (error) {
      if (currentRequest === requestNumber.current) {
        setErrorMessage(error instanceof Error ? error.message : 'No pudimos cargar las tomas.')
      }
    } finally {
      if (currentRequest === requestNumber.current) setIsLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    if (!enabled) return
    queueMicrotask(() => { void reload() })
  }, [enabled, reload])

  useEffect(() => {
    if (!user || !enabled) return undefined
    return subscribeToDoseChanges(user.id, () => { void reload() })
  }, [enabled, reload, user])

  return { occurrences, isLoading, errorMessage, reload }
}
