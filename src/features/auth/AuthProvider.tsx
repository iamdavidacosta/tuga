import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { AuthContext, type AuthContextValue } from './authContext'
import { getAuthErrorMessage } from './authErrors'
import {
  signInWithGoogle,
  signOutCurrentDevice,
  subscribeToAuthState,
} from './authService'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    try {
      const unsubscribe = subscribeToAuthState((_event, nextSession) => {
        if (isActive) {
          setSession(nextSession)
          setIsLoading(false)
        }
      })

      return () => {
        isActive = false
        unsubscribe()
      }
    } catch (error) {
      queueMicrotask(() => {
        if (isActive) {
          setErrorMessage(getAuthErrorMessage(error))
          setIsLoading(false)
        }
      })

      return () => {
        isActive = false
      }
    }
  }, [])

  const clearError = useCallback(() => setErrorMessage(null), [])

  const signIn = useCallback(async () => {
    setIsBusy(true)
    setErrorMessage(null)

    try {
      await signInWithGoogle()
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
      setIsBusy(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setIsBusy(true)
    setErrorMessage(null)

    try {
      await signOutCurrentDevice()
      setSession(null)
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error))
    } finally {
      setIsBusy(false)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isBusy,
      errorMessage,
      clearError,
      signIn,
      signOut,
    }),
    [clearError, errorMessage, isBusy, isLoading, session, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
