import { useCallback, useEffect, useState } from 'react'

import { checkTugaHealth } from './healthService'

export type SystemHealthState = 'checking' | 'available' | 'unavailable'

export function useSystemHealth() {
  const [state, setState] = useState<SystemHealthState>('checking')

  const check = useCallback(async () => {
    setState('checking')
    const result = await checkTugaHealth()
    setState(result.connection)
  }, [])

  useEffect(() => {
    let isCurrent = true
    void checkTugaHealth().then((result) => {
      if (isCurrent) setState(result.connection)
    })
    return () => { isCurrent = false }
  }, [])

  return { state, check }
}
