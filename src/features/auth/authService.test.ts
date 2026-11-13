import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseAuth = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../../services/supabase/client', () => ({
  getSupabaseClient: () => ({ auth: supabaseAuth }),
}))

import {
  signInWithGoogle,
  signOutCurrentDevice,
  subscribeToAuthState,
} from './authService'

describe('servicio de autenticación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_AUTH_REDIRECT_URL', '')
    supabaseAuth.signInWithOAuth.mockResolvedValue({ error: null })
    supabaseAuth.signOut.mockResolvedValue({ error: null })
  })

  it('inicia OAuth exclusivamente con Google y el callback permitido', async () => {
    await signInWithGoogle()

    expect(supabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  })

  it('cierra únicamente la sesión del dispositivo actual', async () => {
    await signOutCurrentDevice()

    expect(supabaseAuth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('devuelve una función que cancela la escucha de sesión', () => {
    const unsubscribe = vi.fn()
    supabaseAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    })
    const listener = vi.fn<(event: string, session: Session | null) => void>()

    const stopListening = subscribeToAuthState(listener)
    stopListening()

    expect(supabaseAuth.onAuthStateChange).toHaveBeenCalledWith(listener)
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
