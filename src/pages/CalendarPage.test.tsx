import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const doseHooks = vi.hoisted(() => ({
  useDoseContext: vi.fn(),
  useDoseOccurrences: vi.fn(),
}))

vi.mock('../features/doses/useDoseContext', () => ({
  useDoseContext: doseHooks.useDoseContext,
}))

vi.mock('../features/doses/useDoseOccurrences', () => ({
  useDoseOccurrences: doseHooks.useDoseOccurrences,
}))

import { CalendarPage } from './CalendarPage'

const occurrences = [
  {
    id: 'dose-taken',
    medicationId: 'medication-taken',
    scheduleId: 'schedule-taken',
    medicationName: 'Losartán',
    dosageAmount: 1,
    dosageUnit: 'tableta',
    scheduledAt: '2026-01-18T13:00:00Z',
    status: 'taken',
    takenAt: '2026-01-18T13:02:00Z',
    updatedAt: '2026-01-18T13:02:00Z',
    localDate: '2026-01-18',
    localTime: '08:00:00',
    displayTimezone: 'America/Bogota',
  },
  {
    id: 'dose-pending',
    medicationId: 'medication-pending',
    scheduleId: 'schedule-pending',
    medicationName: 'Metformina',
    dosageAmount: 1,
    dosageUnit: 'tableta',
    scheduledAt: '2026-01-18T19:00:00Z',
    status: 'pending',
    takenAt: null,
    updatedAt: '2026-01-18T12:00:00Z',
    localDate: '2026-01-18',
    localTime: '14:00:00',
    displayTimezone: 'America/Bogota',
  },
  {
    id: 'dose-skipped',
    medicationId: 'medication-skipped',
    scheduleId: 'schedule-skipped',
    medicationName: 'Atorvastatina',
    dosageAmount: 1,
    dosageUnit: 'tableta',
    scheduledAt: '2026-01-19T01:00:00Z',
    status: 'skipped',
    takenAt: null,
    updatedAt: '2026-01-18T20:00:00Z',
    localDate: '2026-01-18',
    localTime: '20:00:00',
    displayTimezone: 'America/Bogota',
  },
] as const

describe('pantalla Calendario', () => {
  beforeEach(() => {
    doseHooks.useDoseContext.mockReturnValue({
      context: { timezone: 'America/Bogota', today: '2026-01-18' },
      errorMessage: null,
      isLoading: false,
    })
    doseHooks.useDoseOccurrences.mockReturnValue({
      occurrences,
      isLoading: false,
      errorMessage: null,
      reload: vi.fn(),
    })
  })

  it('muestra estados reales, detalle del día y navegación mensual', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Calendario de medicamentos' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Enero 2026' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Domingo, 18 de enero' })).toBeVisible()
    expect(screen.getByText('3 medicamentos')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ver toma de Losartán a las 8:00 AM' })).toBeVisible()
    expect(screen.getAllByText('Tomado').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Omitido').length).toBeGreaterThan(1)

    await user.click(screen.getByRole('button', { name: /lunes, 19 de enero de 2026/i }))
    expect(screen.getByRole('heading', { name: 'Lunes, 19 de enero' })).toBeVisible()
    expect(screen.getByText('No hay tomas para este día')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    expect(screen.getByRole('heading', { name: 'Febrero 2026' })).toBeVisible()
  })
})
