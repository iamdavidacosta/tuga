import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DoseOccurrence } from '../features/doses/types'

const occurrences: DoseOccurrence[] = [
  {
    id: 'next-dose',
    medicationId: 'med-1',
    scheduleId: 'schedule-1',
    medicationName: 'Losartán',
    dosageAmount: 1,
    dosageUnit: 'tableta',
    scheduledAt: '2099-01-18T13:00:00Z',
    status: 'pending',
    takenAt: null,
    updatedAt: '2099-01-18T12:00:00Z',
    localDate: '2099-01-18',
    localTime: '08:00',
    displayTimezone: 'America/Bogota',
  },
  {
    id: 'taken-dose',
    medicationId: 'med-2',
    scheduleId: 'schedule-2',
    medicationName: 'Metformina de liberación prolongada',
    dosageAmount: 1,
    dosageUnit: 'tableta',
    scheduledAt: '2099-01-18T19:00:00Z',
    status: 'taken',
    takenAt: '2099-01-18T19:02:00Z',
    updatedAt: '2099-01-18T19:02:00Z',
    localDate: '2099-01-18',
    localTime: '14:00',
    displayTimezone: 'America/Bogota',
  },
  {
    id: 'skipped-dose',
    medicationId: 'med-3',
    scheduleId: 'schedule-3',
    medicationName: 'Atorvastatina',
    dosageAmount: 1,
    dosageUnit: 'tableta',
    scheduledAt: '2099-01-19T01:00:00Z',
    status: 'skipped',
    takenAt: null,
    updatedAt: '2099-01-18T20:00:00Z',
    localDate: '2099-01-18',
    localTime: '20:00',
    displayTimezone: 'America/Bogota',
  },
]

const doseState = vi.hoisted(() => ({ occurrences: [] as unknown[] }))
const notificationService = vi.hoisted(() => ({ postponeDoseReminder: vi.fn() }))

vi.mock('../features/auth/authContext', () => ({
  useAuth: () => ({ user: { user_metadata: { full_name: 'Marta Gómez' } } }),
}))

vi.mock('../features/doses/useDoseContext', () => ({
  useDoseContext: () => ({
    context: { timezone: 'America/Bogota', today: '2099-01-18' },
    errorMessage: null,
    isLoading: false,
  }),
}))

vi.mock('../features/doses/useDoseOccurrences', () => ({
  useDoseOccurrences: () => ({
    occurrences: doseState.occurrences,
    errorMessage: null,
    isLoading: false,
    reload: vi.fn(),
  }),
}))

vi.mock('../features/notifications/notificationService', () => notificationService)

import { TodayPage } from './TodayPage'

describe('vista Hoy', () => {
  beforeEach(() => {
    doseState.occurrences = occurrences
    notificationService.postponeDoseReminder.mockReset()
    notificationService.postponeDoseReminder.mockResolvedValue('2099-01-18T13:15:00Z')
  })

  it('muestra el saludo, la próxima toma, el progreso y las demás tomas', async () => {
    const user = userEvent.setup()

    render(<MemoryRouter><TodayPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Hola, Marta' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Próximo medicamento' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Losartán' })).toBeVisible()
    expect(screen.getByText('8:00 AM')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Tu progreso de hoy' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Otras tomas de hoy' })).toBeVisible()
    expect(screen.getByText('Metformina de liberación prolongada')).toBeVisible()
    expect(screen.getByText(/2:00 PM/)).toBeVisible()
    expect(screen.getByText('Tomado')).toBeVisible()
    expect(screen.getByText('Omitida')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Recordar más tarde' }))
    expect(notificationService.postponeDoseReminder).toHaveBeenCalledWith('next-dose')
    expect(screen.getByText('Te recordaremos nuevamente en 15 minutos. La toma continúa pendiente.')).toBeVisible()
  })

  it('muestra una celebración sin acciones cuando todas las tomas están confirmadas', () => {
    doseState.occurrences = occurrences.map((occurrence) => ({
      ...occurrence,
      status: 'taken' as const,
      takenAt: occurrence.takenAt ?? '2099-01-18T13:02:00Z',
    }))

    render(<MemoryRouter><TodayPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '¡Muy bien! Ya completaste tus medicamentos de hoy' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Tomé mi medicamento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recordar más tarde' })).not.toBeInTheDocument()
  })

  it('ofrece revisar medicamentos cuando no existen tomas para hoy', () => {
    doseState.occurrences = []

    render(<MemoryRouter><TodayPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'No tienes tomas programadas para hoy' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Ver mis medicamentos' })).toHaveAttribute('href', '/medicamentos')
    expect(screen.queryByRole('heading', { name: 'Próximo medicamento' })).not.toBeInTheDocument()
  })
})
