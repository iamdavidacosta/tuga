import { beforeEach, describe, expect, it, vi } from 'vitest'

const realtime = vi.hoisted(() => ({ on: vi.fn(), subscribe: vi.fn() }))
const supabase = vi.hoisted(() => ({ rpc: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() }))
vi.mock('../../services/supabase/client', () => ({ getSupabaseClient: () => supabase }))

import {
  confirmDoseOccurrence,
  correctDoseOccurrence,
  getDoseContext,
  listDoseOccurrences,
  skipDoseOccurrence,
  subscribeToDoseChanges,
} from './doseService'

const databaseRow = {
  id: 'dose-id',
  medication_id: 'med-id',
  schedule_id: 'schedule-id',
  medication_name: 'Medicamento prescrito',
  dosage_amount: 1,
  dosage_unit: 'tableta',
  scheduled_at: '2026-11-12T13:00:00Z',
  status: 'pending',
  taken_at: null,
  updated_at: '2026-11-12T12:00:00Z',
  local_date: '2026-11-12',
  local_time: '08:00:00',
  display_timezone: 'America/Bogota',
}

describe('servicio de tomas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.rpc.mockResolvedValue({ data: [], error: null })
    realtime.on.mockReturnValue(realtime)
    realtime.subscribe.mockReturnValue(realtime)
    supabase.channel.mockReturnValue(realtime)
    supabase.removeChannel.mockResolvedValue('ok')
  })

  it('asegura un horizonte acotado antes de consultar y mapea la hora local', async () => {
    supabase.rpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: [databaseRow], error: null })

    const result = await listDoseOccurrences('2026-11-12', '2026-11-12')

    expect(supabase.rpc.mock.calls).toEqual([
      ['ensure_dose_occurrences', { p_from: '2026-11-12', p_to: '2026-11-12' }],
      ['list_dose_occurrences', { p_from: '2026-11-12', p_to: '2026-11-12' }],
    ])
    expect(result[0]).toMatchObject({ status: 'pending', localTime: '08:00' })
  })

  it('usa operaciones protegidas separadas para confirmar, omitir y corregir', async () => {
    await confirmDoseOccurrence('dose-id')
    await skipDoseOccurrence('dose-id')
    await correctDoseOccurrence('dose-id')

    expect(supabase.rpc.mock.calls).toEqual([
      ['confirm_dose_occurrence', { p_occurrence_id: 'dose-id' }],
      ['skip_dose_occurrence', { p_occurrence_id: 'dose-id' }],
      ['correct_dose_occurrence', { p_occurrence_id: 'dose-id' }],
    ])
    expect(supabase.rpc.mock.calls.flat(2)).not.toContain('user_id')
  })

  it('obtiene del servidor la fecha y zona horaria configuradas', async () => {
    supabase.rpc.mockResolvedValueOnce({
      data: [{ display_timezone: 'America/Bogota', local_date: '2026-11-12' }],
      error: null,
    })

    await expect(getDoseContext()).resolves.toEqual({
      timezone: 'America/Bogota',
      today: '2026-11-12',
    })
    expect(supabase.rpc).toHaveBeenCalledWith('get_dose_context')
  })

  it('escucha cambios Realtime del usuario y elimina el canal al salir', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeToDoseChanges('user-id', onChange)

    expect(realtime.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'dose_occurrences', filter: 'user_id=eq.user-id' }),
      onChange,
    )
    unsubscribe()
    expect(supabase.removeChannel).toHaveBeenCalledWith(realtime)
  })
})
