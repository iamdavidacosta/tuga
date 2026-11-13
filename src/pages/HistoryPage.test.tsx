import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DoseOccurrence } from '../features/doses/types'

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

import { HistoryPage } from './HistoryPage'

const occurrences: DoseOccurrence[] = [
  {
    id: 'dose-taken-today',
    medicationId: 'medication-losartan',
    scheduleId: 'schedule-losartan',
    medicationName: 'Losartán',
    dosageAmount: 1,
    dosageUnit: 'tableta',
    scheduledAt: '2026-01-18T13:00:00Z',
    status: 'taken',
    takenAt: '2026-01-18T13:07:00Z',
    updatedAt: '2026-01-18T13:07:00Z',
    localDate: '2026-01-18',
    localTime: '08:00:00',
    displayTimezone: 'America/Bogota',
  },
  {
    id: 'dose-pending-today',
    medicationId: 'medication-metformin',
    scheduleId: 'schedule-metformin',
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
    id: 'dose-skipped-yesterday',
    medicationId: 'medication-metformin',
    scheduleId: 'schedule-metformin',
    medicationName: 'Metformina',
    dosageAmount: 1,
    dosageUnit: 'tableta',
    scheduledAt: '2026-01-17T19:00:00Z',
    status: 'skipped',
    takenAt: null,
    updatedAt: '2026-01-17T20:00:00Z',
    localDate: '2026-01-17',
    localTime: '14:00:00',
    displayTimezone: 'America/Bogota',
  },
]

describe('pantalla Historial de tomas', () => {
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

  it('muestra el resumen real, agrupa por fecha y conserva la confirmación real', () => {
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Historial de tomas' })).toBeVisible()
    expect(screen.getByLabelText('Período')).toHaveValue('month')
    expect(screen.getByText('Domingo, 18 de enero de 2026')).toBeVisible()
    expect(screen.getByText('Sábado, 17 de enero de 2026')).toBeVisible()
    expect(screen.getByText('Confirmada a las 8:07 a. m.')).toBeVisible()
    expect(screen.getByText('Tomadas').previousElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Pendientes').previousElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Omitidas').previousElementSibling).toHaveTextContent('1')
  })

  it('filtra por período y medicamento usando las ocurrencias consultadas', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    )

    await user.selectOptions(screen.getByLabelText('Período'), 'today')
    expect(screen.queryByText('Sábado, 17 de enero de 2026')).not.toBeInTheDocument()
    expect(screen.getByText('Omitidas').previousElementSibling).toHaveTextContent('0')

    await user.selectOptions(screen.getByLabelText('Medicamento'), 'medication-metformin')
    expect(screen.queryByRole('link', { name: /Ver toma de Losartán/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ver toma de Metformina/i })).toBeVisible()
    expect(screen.getByText('Tomadas').previousElementSibling).toHaveTextContent('0')
    expect(screen.getByText('Pendientes').previousElementSibling).toHaveTextContent('1')
  })
})
