import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabase = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('../../services/supabase/client', () => ({
  getSupabaseClient: () => supabase,
}))

import {
  createMedication,
  suspendMedication,
  updateMedication,
} from './medicationsService'
import type { MedicationDraft } from './types'

const draft: MedicationDraft = {
  name: 'Medicamento prescrito',
  dosageAmount: '1',
  dosageUnit: 'tableta',
  frequency: { kind: 'every_two_days', intervalDays: '2' },
  schedule: { kind: 'fixed', times: ['08:00', '20:00'] },
  startDate: '2026-11-12',
  duration: { kind: 'days', amount: '10', endDate: '' },
}

describe('servicio de medicamentos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.rpc.mockResolvedValue({ data: 'medication-id', error: null })
  })

  it('crea mediante la operación atómica sin enviar user_id', async () => {
    await createMedication('medication-id', draft)

    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_medication_with_schedule',
      expect.objectContaining({
        p_medication_id: 'medication-id',
        p_name: 'Medicamento prescrito',
        p_end_date: '2026-11-21',
        p_local_times: ['08:00', '20:00'],
        p_recurrence_config: expect.objectContaining({
          frequencyKind: 'every_two_days',
          intervalDays: 2,
        }),
      }),
    )
    expect(supabase.rpc.mock.calls[0]?.[1]).not.toHaveProperty('user_id')
  })

  it('edita mediante la operación que conserva versiones', async () => {
    await updateMedication('medication-id', draft)

    expect(supabase.rpc).toHaveBeenCalledWith(
      'update_medication_with_schedule',
      expect.objectContaining({ p_medication_id: 'medication-id' }),
    )
  })

  it('suspende solamente el medicamento indicado', async () => {
    await suspendMedication('medication-id')

    expect(supabase.rpc).toHaveBeenCalledWith('suspend_medication', {
      p_medication_id: 'medication-id',
    })
  })
})
