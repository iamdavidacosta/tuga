import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const doseService = vi.hoisted(() => ({
  confirmDoseOccurrence: vi.fn(),
  correctDoseOccurrence: vi.fn(),
  getDoseOccurrence: vi.fn(),
  skipDoseOccurrence: vi.fn(),
  subscribeToDoseChanges: vi.fn(() => () => undefined),
}))
const notificationService = vi.hoisted(() => ({ postponeDoseReminder: vi.fn() }))

vi.mock('./doseService', () => doseService)
vi.mock('../notifications/notificationService', () => notificationService)
vi.mock('../auth/authContext', () => ({
  useAuth: () => ({ user: { id: 'user-id' } }),
}))

import { ConfirmIntakePage } from '../../pages/ConfirmIntakePage'
import type { DoseOccurrence } from './types'

const pendingOccurrence: DoseOccurrence = {
  id: 'dose-id',
  medicationId: 'med-id',
  scheduleId: 'schedule-id',
  medicationName: 'Medicamento prescrito',
  dosageAmount: 1,
  dosageUnit: 'tableta',
  scheduledAt: '2026-11-12T13:00:00Z',
  status: 'pending',
  takenAt: null,
  updatedAt: '2026-11-12T12:00:00Z',
  localDate: '2026-11-12',
  localTime: '08:00',
  displayTimezone: 'America/Bogota',
}

function renderConfirmation() {
  return render(
    <MemoryRouter initialEntries={['/tomas/dose-id/confirmar']}>
      <Routes>
        <Route path="/tomas/:intakeId/confirmar" element={<ConfirmIntakePage />} />
        <Route path="/hoy" element={<p>Página Hoy</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('control de tomas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    doseService.getDoseOccurrence.mockResolvedValue(pendingOccurrence)
    doseService.confirmDoseOccurrence.mockResolvedValue(undefined)
    doseService.skipDoseOccurrence.mockResolvedValue(undefined)
    doseService.correctDoseOccurrence.mockResolvedValue(undefined)
    doseService.subscribeToDoseChanges.mockReturnValue(() => undefined)
    notificationService.postponeDoseReminder.mockResolvedValue('2026-11-12T13:15:00Z')
  })

  it('“Todavía no” vuelve a Hoy sin escribir un estado', async () => {
    const user = userEvent.setup()
    renderConfirmation()
    await user.click(await screen.findByRole('link', { name: 'Todavía no' }))
    expect(screen.getByText('Página Hoy')).toBeVisible()
    expect(doseService.confirmDoseOccurrence).not.toHaveBeenCalled()
    expect(doseService.skipDoseOccurrence).not.toHaveBeenCalled()
  })

  it('confirma una sola toma mediante la operación atómica', async () => {
    const user = userEvent.setup()
    renderConfirmation()
    await user.click(await screen.findByRole('button', { name: 'Sí, ya lo tomé' }))
    expect(doseService.confirmDoseOccurrence).toHaveBeenCalledOnce()
    expect(doseService.confirmDoseOccurrence).toHaveBeenCalledWith('dose-id')
    expect(await screen.findByRole('status')).toHaveTextContent('Toma confirmada')
  })

  it('exige una confirmación adicional para marcar como omitida', async () => {
    const user = userEvent.setup()
    renderConfirmation()
    await user.click(await screen.findByRole('button', { name: 'Marcar como omitida' }))
    expect(doseService.skipDoseOccurrence).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Sí, marcar como omitida' }))
    expect(doseService.skipDoseOccurrence).toHaveBeenCalledWith('dose-id')
  })

  it('pospone 15 minutos sin confirmar ni omitir la toma', async () => {
    const user = userEvent.setup()
    renderConfirmation()
    await user.click(await screen.findByRole('button', { name: /Recordarme en 15 minutos/ }))
    expect(notificationService.postponeDoseReminder).toHaveBeenCalledWith('dose-id')
    expect(doseService.confirmDoseOccurrence).not.toHaveBeenCalled()
    expect(doseService.skipDoseOccurrence).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('continúa pendiente')
  })
})
