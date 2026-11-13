import type { PostgrestError, RealtimeChannel } from '@supabase/supabase-js'

import { getSupabaseClient } from '../../services/supabase/client'
import type { DoseOccurrence, DoseStatus } from './types'

export class DoseServiceError extends Error {}

function toDoseError(error: PostgrestError | Error | unknown): DoseServiceError {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (code === '42501') return new DoseServiceError('Tu sesión no permite realizar esta acción. Vuelve a iniciar sesión.')
  if (code === 'P0002') return new DoseServiceError('No encontramos esta toma o ya no está disponible.')
  if (code === 'P0001') return new DoseServiceError('Primero corrige el estado actual de esta toma.')
  if (message.includes('fetch') || message.includes('network')) {
    return new DoseServiceError('No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.')
  }
  return new DoseServiceError('No pudimos completar la acción. Inténtalo nuevamente.')
}

function isDoseStatus(value: string): value is DoseStatus {
  return value === 'pending' || value === 'taken' || value === 'skipped'
}

function mapOccurrence(row: {
  id: string
  medication_id: string
  schedule_id: string
  medication_name: string
  dosage_amount: number
  dosage_unit: string
  scheduled_at: string
  status: string
  taken_at: string | null
  updated_at: string
  local_date: string
  local_time: string
  display_timezone: string
}): DoseOccurrence {
  if (!isDoseStatus(row.status)) throw new DoseServiceError('Recibimos un estado de toma no válido.')
  return {
    id: row.id,
    medicationId: row.medication_id,
    scheduleId: row.schedule_id,
    medicationName: row.medication_name,
    dosageAmount: Number(row.dosage_amount),
    dosageUnit: row.dosage_unit,
    scheduledAt: row.scheduled_at,
    status: row.status,
    takenAt: row.taken_at,
    updatedAt: row.updated_at,
    localDate: row.local_date,
    localTime: row.local_time.slice(0, 5),
    displayTimezone: row.display_timezone,
  }
}

export async function listDoseOccurrences(from: string, to: string): Promise<DoseOccurrence[]> {
  const client = getSupabaseClient()
  const ensured = await client.rpc('ensure_dose_occurrences', { p_from: from, p_to: to })
  if (ensured.error) throw toDoseError(ensured.error)

  const { data, error } = await client.rpc('list_dose_occurrences', { p_from: from, p_to: to })
  if (error) throw toDoseError(error)

  return data.map(mapOccurrence)
}

export async function getDoseOccurrence(occurrenceId: string): Promise<DoseOccurrence> {
  const { data, error } = await getSupabaseClient().rpc('get_dose_occurrence', {
    p_occurrence_id: occurrenceId,
  })
  if (error) throw toDoseError(error)
  if (!data[0]) throw new DoseServiceError('No encontramos esta toma o ya no está disponible.')
  return mapOccurrence(data[0])
}

export async function getDoseContext(): Promise<{ timezone: string; today: string }> {
  const { data, error } = await getSupabaseClient().rpc('get_dose_context')
  if (error) throw toDoseError(error)
  if (!data[0]) throw new DoseServiceError('No pudimos determinar tu fecha local.')
  return { timezone: data[0].display_timezone, today: data[0].local_date }
}

async function transition(
  operation: 'confirm_dose_occurrence' | 'skip_dose_occurrence' | 'correct_dose_occurrence',
  occurrenceId: string,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc(operation, { p_occurrence_id: occurrenceId })
  if (error) throw toDoseError(error)
}

export const confirmDoseOccurrence = (occurrenceId: string) => transition('confirm_dose_occurrence', occurrenceId)
export const skipDoseOccurrence = (occurrenceId: string) => transition('skip_dose_occurrence', occurrenceId)
export const correctDoseOccurrence = (occurrenceId: string) => transition('correct_dose_occurrence', occurrenceId)

export function subscribeToDoseChanges(userId: string, onChange: () => void): () => void {
  const client = getSupabaseClient()
  const channel: RealtimeChannel = client
    .channel(`dose-occurrences:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dose_occurrences', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe()

  return () => { void client.removeChannel(channel) }
}
