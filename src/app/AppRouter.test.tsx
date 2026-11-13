import type { Session, User } from '@supabase/supabase-js'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthContext, type AuthContextValue } from '../features/auth/authContext'
import { appRoutes } from './routes'

const authenticatedUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'marta@example.com',
  app_metadata: { provider: 'google' },
  user_metadata: { full_name: 'Marta Gómez' },
  aud: 'authenticated',
  created_at: '2026-11-12T12:00:00.000Z',
} as User

const authenticatedSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: authenticatedUser,
} as Session

function createAuthValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    session: null,
    user: null,
    isLoading: false,
    isBusy: false,
    errorMessage: null,
    clearError: vi.fn(),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function renderRoute(path: string, authValue: AuthContextValue) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })

  render(
    <AuthContext.Provider value={authValue}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )

  return router
}

describe('rutas y autenticación', () => {
  it('ofrece el acceso con Google en la ruta pública', async () => {
    const user = userEvent.setup()
    const authValue = createAuthValue()

    renderRoute('/', authValue)

    await user.click(
      screen.getByRole('button', { name: 'Entrar con Google' }),
    )

    expect(authValue.signIn).toHaveBeenCalledOnce()
  })

  it('devuelve al inicio cuando una persona no autenticada abre una ruta privada', async () => {
    const router = renderRoute('/hoy', createAuthValue())

    expect(
      await screen.findByRole('heading', { name: 'Bienvenido a TUGA' }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/')
  })

  it('envía a Hoy cuando una persona autenticada abre la bienvenida', async () => {
    const router = renderRoute(
      '/',
      createAuthValue({
        session: authenticatedSession,
        user: authenticatedUser,
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Medicamentos de hoy' }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/hoy')
  })

  it('muestra solo el perfil autenticado y permite cerrar la sesión local', async () => {
    const user = userEvent.setup()
    const signOut = vi.fn().mockResolvedValue(undefined)

    renderRoute(
      '/configuracion',
      createAuthValue({
        session: authenticatedSession,
        user: authenticatedUser,
        signOut,
      }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Marta Gómez' }),
    ).toBeVisible()
    expect(screen.getByText('marta@example.com')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(signOut).toHaveBeenCalledOnce()
  })
})
