import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const notifications = vi.hoisted(() => ({
  state: {
    support: { availability: 'available', message: 'Este dispositivo puede recibir recordatorios.' },
    permission: 'granted',
    currentDeviceActive: true,
    activeDevices: 2,
    lastTestAt: null,
    lastTestStatus: null,
  },
  isBusy: false,
  message: '',
  errorMessage: null,
  enable: vi.fn(),
  disable: vi.fn(),
  test: vi.fn(),
}))

const health = vi.hoisted(() => ({
  state: 'available' as const,
  check: vi.fn(),
}))

vi.mock('./usePushNotifications', () => ({ usePushNotifications: () => notifications }))
vi.mock('../health/useSystemHealth', () => ({ useSystemHealth: () => health }))
vi.mock('../auth/authContext', () => ({
  useAuth: () => ({ user: null, signOut: vi.fn(), isBusy: false, errorMessage: null }),
}))

import { SettingsPage } from '../../pages/SettingsPage'

describe('configuración de recordatorios', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra varios dispositivos y permite una prueba explícita', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.getByText(/Dispositivos activos en tu cuenta: 2/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Probar mis recordatorios' }))
    expect(notifications.test).toHaveBeenCalledOnce()
  })

  it('explica que aceptar el envío no garantiza entrega', () => {
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)
    expect(screen.getByText(/sin garantizar que llegue al dispositivo/)).toBeVisible()
  })

  it('muestra el estado sencillo y permite comprobarlo', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><SettingsPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Estado de TUGA' })).toBeVisible()
    expect(screen.getByText('Conexión disponible.')).toBeVisible()
    expect(screen.getByText('Notificaciones activadas.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Comprobar' }))
    expect(health.check).toHaveBeenCalledOnce()
  })
})
