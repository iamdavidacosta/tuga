import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authService = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signOutCurrentDevice: vi.fn(),
  subscribeToAuthState: vi.fn(),
}))

vi.mock('./authService', () => authService)

import { AuthProvider } from './AuthProvider'
import { useAuth } from './authContext'

type AuthListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'marta@example.com',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'Marta Gómez' },
  aud: 'authenticated',
  created_at: '2026-11-12T12:00:00.000Z',
} as User

const session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user,
} as Session

function AuthStateHarness() {
  const auth = useAuth()

  return (
    <div>
      <span>{auth.isLoading ? 'cargando' : 'listo'}</span>
      <span>{auth.user?.email ?? 'sin sesión'}</span>
      {auth.errorMessage ? <span role="alert">{auth.errorMessage}</span> : null}
      <button onClick={() => void auth.signIn()} type="button">Entrar</button>
    </div>
  )
}

describe('AuthProvider', () => {
  let listener: AuthListener | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    listener = undefined
    authService.subscribeToAuthState.mockImplementation(
      (nextListener: AuthListener) => {
        listener = nextListener
        return vi.fn()
      },
    )
  })

  it('recupera la sesión persistida mediante INITIAL_SESSION', () => {
    render(
      <AuthProvider>
        <AuthStateHarness />
      </AuthProvider>,
    )

    expect(screen.getByText('cargando')).toBeVisible()

    act(() => {
      listener?.('INITIAL_SESSION', session)
    })

    expect(screen.getByText('listo')).toBeVisible()
    expect(screen.getByText('marta@example.com')).toBeVisible()
  })

  it('presenta un mensaje claro si el acceso falla', async () => {
    authService.signInWithGoogle.mockRejectedValue({
      code: 'over_request_rate_limit',
    })

    render(
      <AuthProvider>
        <AuthStateHarness />
      </AuthProvider>,
    )

    await act(async () => {
      screen.getByRole('button', { name: 'Entrar' }).click()
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Se hicieron demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
    )
  })
})
