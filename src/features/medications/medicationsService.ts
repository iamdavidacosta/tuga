import type { PostgrestError } from '@supabase/supabase-js'

import { getSupabaseClient } from '../../services/supabase/client'
import type { Json } from '../../types/database'
import { normalizeMedicationDraft } from './medicationRules'
import type {
  DurationConfig,
  Medication,
  MedicationDraft,
  MedicationSchedule,
  MedicationStatus,
  ScheduleType,
} from './types'

const medicationFields = 'id,name,dosage_amount,dosage_unit,instructions,notes,start_date,end_date,duration_config,status,created_at,updated_at'

const scheduleFields = 'id,medication_id,schedule_type,local_times,timezone,recurrence_config'

export class MedicationServiceError extends Error {}

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseDurationConfig(value: Json, endDate: string | null): DurationConfig {
  if (isRecord(value)) {
    const kind = value.kind
    const amount = value.amount
    const configuredEndDate = value.endDate

    if (kind === 'indefinite') {
      return { kind, boundary: 'inclusive' }
    }

    if (kind === 'end_date' && typeof configuredEndDate === 'string') {
      return { kind, endDate: configuredEndDate, boundary: 'inclusive' }
    }

    if (
      (kind === 'days' || kind === 'weeks' || kind === 'months') &&
      typeof amount === 'number' &&
      Number.isInteger(amount) &&
      amount > 0
    ) {
      return { kind, amount, boundary: 'inclusive' }
    }
  }

  return endDate
    ? { kind: 'days', amount: 1, boundary: 'inclusive' }
    : { kind: 'indefinite', boundary: 'inclusive' }
}

function normalizeTime(value: string): string {
  return value.slice(0, 5)
}

function mapSchedule(row: {
  id: string
  schedule_type: string
  local_times: string[]
  timezone: string
  recurrence_config: Json
}): MedicationSchedule {
  const recurrence = isRecord(row.recurrence_config)
    ? row.recurrence_config
    : {}
  const intervalHours = recurrence.intervalHours
  const firstTime = recurrence.firstTime
  const frequencyKind = recurrence.frequencyKind
  const intervalDays = recurrence.intervalDays

  return {
    id: row.id,
    type: row.schedule_type === 'interval' ? 'interval' : 'daily',
    localTimes: row.local_times.map(normalizeTime).sort(),
    timezone: row.timezone,
    intervalHours: typeof intervalHours === 'number' ? intervalHours : null,
    firstTime: typeof firstTime === 'string' ? normalizeTime(firstTime) : null,
    frequencyKind: frequencyKind === 'every_two_days' || frequencyKind === 'weekly' || frequencyKind === 'custom'
      ? frequencyKind
      : 'daily',
    intervalDays: typeof intervalDays === 'number' && Number.isInteger(intervalDays) && intervalDays > 0
      ? intervalDays
      : 1,
  }
}

function mapMedication(
  row: {
    id: string
    name: string
    dosage_amount: number
    dosage_unit: string
    instructions: string | null
    notes: string | null
    start_date: string
    end_date: string | null
    duration_config: Json
    status: string
    created_at: string
    updated_at: string
  },
  schedule: MedicationSchedule | null,
): Medication {
  return {
    id: row.id,
    name: row.name,
    dosageAmount: Number(row.dosage_amount),
    dosageUnit: row.dosage_unit,
    instructions: row.instructions,
    notes: row.notes,
    startDate: row.start_date,
    endDate: row.end_date,
    durationConfig: parseDurationConfig(row.duration_config, row.end_date),
    status: (['active', 'paused', 'completed'].includes(row.status)
      ? row.status
      : 'active') as MedicationStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schedule,
  }
}

function toServiceError(error: PostgrestError | Error | unknown): MedicationServiceError {
  const code = error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : ''
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (code === '42501') {
    return new MedicationServiceError('Tu sesión no permite realizar esta acción. Vuelve a iniciar sesión.')
  }
  if (code === 'P0002' || code === 'PGRST116') {
    return new MedicationServiceError('No encontramos este medicamento o ya no está disponible.')
  }
  if (message.includes('fetch') || message.includes('network')) {
    return new MedicationServiceError('No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.')
  }

  return new MedicationServiceError('No pudimos completar la acción. Inténtalo nuevamente.')
}

async function loadSchedules(medicationIds: string[]): Promise<Map<string, MedicationSchedule>> {
  if (medicationIds.length === 0) return new Map()

  const { data, error } = await getSupabaseClient()
    .from('medication_schedules')
    .select(scheduleFields)
    .in('medication_id', medicationIds)
    .is('retired_at', null)
    .order('created_at', { ascending: false })

  if (error) throw toServiceError(error)

  const schedules = new Map<string, MedicationSchedule>()
  for (const row of data) {
    if (!schedules.has(row.medication_id)) {
      schedules.set(row.medication_id, mapSchedule(row))
    }
  }

  return schedules
}

export async function listMedications(): Promise<Medication[]> {
  const { data, error } = await getSupabaseClient()
    .from('medications')
    .select(medicationFields)
    .order('created_at', { ascending: false })

  if (error) throw toServiceError(error)

  const schedules = await loadSchedules(data.map(({ id }) => id))
  return data.map((row) => mapMedication(row, schedules.get(row.id) ?? null))
}

export async function getMedication(medicationId: string): Promise<Medication> {
  const { data, error } = await getSupabaseClient()
    .from('medications')
    .select(medicationFields)
    .eq('id', medicationId)
    .maybeSingle()

  if (error) throw toServiceError(error)
  if (!data) throw new MedicationServiceError('No encontramos este medicamento o ya no está disponible.')

  const schedules = await loadSchedules([medicationId])
  return mapMedication(data, schedules.get(medicationId) ?? null)
}

function resolveTimezone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return /^[A-Za-z0-9_+./-]{1,100}$/.test(timezone)
      ? timezone
      : 'America/Bogota'
  } catch {
    return 'America/Bogota'
  }
}

function buildMutationArguments(
  medicationId: string,
  draft: MedicationDraft,
) {
  const input = normalizeMedicationDraft(draft)

  return {
    p_medication_id: medicationId,
    p_name: input.name,
    p_dosage_amount: input.dosageAmount,
    p_dosage_unit: input.dosageUnit,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_duration_config: { ...input.durationConfig } as Json,
    p_schedule_type: input.scheduleType satisfies ScheduleType,
    p_local_times: input.localTimes,
    p_timezone: resolveTimezone(),
    p_recurrence_config: input.recurrenceConfig,
  }
}

export async function createMedication(
  medicationId: string,
  draft: MedicationDraft,
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc(
    'create_medication_with_schedule',
    buildMutationArguments(medicationId, draft),
  )

  if (error) throw toServiceError(error)
  return data
}

export async function updateMedication(
  medicationId: string,
  draft: MedicationDraft,
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc(
    'update_medication_with_schedule',
    buildMutationArguments(medicationId, draft),
  )

  if (error) throw toServiceError(error)
  return data
}

export async function suspendMedication(medicationId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('suspend_medication', {
    p_medication_id: medicationId,
  })

  if (error) throw toServiceError(error)
}
