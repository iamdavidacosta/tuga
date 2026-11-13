import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { getSupabaseClient } from '../../services/supabase/client'
import { resolveAuthRedirectUrl } from './authRedirect'

type AuthStateListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void

export function subscribeToAuthState(listener: AuthStateListener): () => void {
  const { data } = getSupabaseClient().auth.onAuthStateChange(listener)

  return () => data.subscription.unsubscribe()
}

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = resolveAuthRedirectUrl(
    import.meta.env,
    window.location.origin,
  )
  const { error } = await getSupabaseClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })

  if (error) {
    throw error
  }
}

export async function signOutCurrentDevice(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' })

  if (error) {
    throw error
  }
}
