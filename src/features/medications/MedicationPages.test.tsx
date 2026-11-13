import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const medicationService = vi.hoisted(() => ({
  getMedication: vi.fn(),
  listMedications: vi.fn(),
  suspendMedication: vi.fn(),
}))

vi.mock('./medicationsService', () => medicationService)

import { MedicationDetailPage } from '../../pages/MedicationDetailPage'
import { MedicationsPage } from '../../pages/MedicationsPage'
import type { Medication } from './types'

const activeMedication: Medication = {
  id: 'active-id',
  name: 'Medicamento activo de prueba',
  dosageAmount: 1,
  dosageUnit: 'tableta',
  instructions: null,
  notes: null,
  startDate: '2026-11-12',
  endDate: null,
  durationConfig: { kind: 'indefinite', boundary: 'inclusive' },
  status: 'active',
  createdAt: '2026-11-12T12:00:00Z',
  updatedAt: '2026-11-12T12:00:00Z',
  schedule: {
    id: 'schedule-active',
    type: 'daily',
    localTimes: ['08:00'],
    timezone: 'America/Bogota',
    intervalHours: null,
    firstTime: null,
  },
}

const suspendedMedication: Medication = {
  ...activeMedication,
  id: 'suspended-id',
  name: 'Medicamento suspendido de prueba',
  status: 'paused',
}

describe('páginas de medicamentos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    medicationService.listMedications.mockResolvedValue([
      activeMedication,
      suspendedMedication,
    ])
    medicationService.getMedication.mockResolvedValue(activeMedication)
    medicationService.suspendMedication.mockResolvedValue(undefined)
  })

  it('separa tratamientos activos y finalizados', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <MedicationsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Medicamento activo de prueba')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tratamientos activos (1)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Finalizados (1)' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('link', { name: 'Añadir medicamento' })).toHaveAttribute('href', '/medicamentos/agregar')
    expect(screen.queryByText('Medicamento suspendido de prueba')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Finalizados (1)' }))

    expect(screen.getByText('Medicamento suspendido de prueba')).toBeVisible()
    expect(screen.queryByText('Medicamento activo de prueba')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Finalizados (1)' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('exige confirmación antes de suspender y conserva el historial', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/medicamentos/active-id']}>
        <Routes>
          <Route path="/medicamentos/:medicationId" element={<MedicationDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Suspender tratamiento' }),
    )
    expect(
      screen.getByRole('heading', { name: '¿Suspender este tratamiento?' }),
    ).toBeVisible()
    expect(medicationService.suspendMedication).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Sí, suspender' }))

    expect(medicationService.suspendMedication).toHaveBeenCalledWith('active-id')
    expect(await screen.findByRole('status')).toHaveTextContent(
      'No se eliminó su historial.',
    )
  })
})
