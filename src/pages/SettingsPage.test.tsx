import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  test: vi.fn(),
  healthCheck: vi.fn(),
}))

vi.mock('../features/auth/authContext', () => ({
  useAuth: () => ({
    user: {
      email: 'marta@example.com',
      user_metadata: { full_name: 'Marta Gómez' },
    },
    signOut: mocks.signOut,
    isBusy: false,
    errorMessage: null,
  }),
}))

vi.mock('../features/notifications/usePushNotifications', () => ({
  usePushNotifications: () => ({
    state: {
      currentDeviceActive: false,
      activeDevices: 0,
      support: { availability: 'available', message: 'Puedes activar los recordatorios.' },
    },
    isBusy: false,
    message: '',
    errorMessage: null,
    enable: mocks.enable,
    disable: mocks.disable,
    test: mocks.test,
  }),
}))

vi.mock('../features/health/useSystemHealth', () => ({
  useSystemHealth: () => ({ state: 'available', check: mocks.healthCheck }),
}))

import { SettingsPage } from './SettingsPage'

describe('pantalla Más opciones', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra cuatro opciones sencillas y conserva sus apartados', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Más opciones' })).toBeVisible()
    expect(screen.getByRole('link', { name: /Mi perfil/ })).toHaveAttribute('href', '#perfil')
    expect(screen.getByRole('link', { name: /Recordatorios/ })).toHaveAttribute('href', '#recordatorios')
    expect(screen.getByRole('link', { name: /Mis preferencias/ })).toHaveAttribute('href', '#preferencias')
    expect(screen.getByRole('link', { name: /Ayuda/ })).toHaveAttribute('href', '/acerca-de-tuga')
    expect(screen.getByRole('heading', { name: 'Marta Gómez' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Recordatorios' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Mis preferencias' })).toBeVisible()
  })

  it('pide confirmación antes de cerrar sesión', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(screen.getByText('¿Quieres cerrar tu sesión en este dispositivo?')).toBeVisible()
    expect(mocks.signOut).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('¿Quieres cerrar tu sesión en este dispositivo?')).not.toBeInTheDocument()
  })
})
