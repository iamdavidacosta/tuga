import { useEffect, useState } from 'react'

import { getDoseContext } from './doseService'

export function useDoseContext() {
  const [context, setContext] = useState<{ timezone: string; today: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      void getDoseContext()
        .then(setContext)
        .catch((error: unknown) => {
          setErrorMessage(error instanceof Error ? error.message : 'No pudimos determinar tu fecha local.')
        })
    })
  }, [])

  return { context, errorMessage, isLoading: context === null && errorMessage === null }
}
