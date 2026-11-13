import type {
  DurationConfig,
  Medication,
  MedicationDraft,
  MedicationViewStatus,
  TreatmentDurationDraft,
  ValidatedMedicationInput,
} from './types'

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/
const dosagePattern = /^\d{1,9}(?:[.,]\d{1,3})?$/

const durationMaximums = {
  days: 36_500,
  weeks: 5_200,
  months: 1_200,
} as const

const maximumFrequencyIntervalDays = 3_650

export class MedicationValidationError extends Error {}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = isoDatePattern.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

function toIsoDate(year: number, month: number, day: number): string {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

function addDays(dateValue: string, days: number): string {
  const parsed = parseIsoDate(dateValue)
  if (!parsed) throw new MedicationValidationError('La fecha inicial no es válida.')

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  date.setUTCDate(date.getUTCDate() + days)

  return toIsoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  )
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function calendarMonthEndDate(startDate: string, months: number): string {
  const parsed = parseIsoDate(startDate)
  if (!parsed) throw new MedicationValidationError('La fecha inicial no es válida.')

  const targetMonthIndex = parsed.month - 1 + months
  const targetYear = parsed.year + Math.floor(targetMonthIndex / 12)
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12 + 1
  const targetMonthDays = daysInMonth(targetYear, targetMonth)

  if (parsed.day > targetMonthDays) {
    return toIsoDate(targetYear, targetMonth, targetMonthDays)
  }

  return addDays(toIsoDate(targetYear, targetMonth, parsed.day), -1)
}

function parseDurationAmount(duration: TreatmentDurationDraft): number | null {
  if (duration.kind === 'indefinite' || duration.kind === 'end_date') return null

  const amount = Number(duration.amount)
  const maximum = durationMaximums[duration.kind]

  return Number.isInteger(amount) && amount >= 1 && amount <= maximum
    ? amount
    : null
}

export function calculateEndDate(
  startDate: string,
  duration: TreatmentDurationDraft,
): string | null {
  if (!parseIsoDate(startDate)) {
    throw new MedicationValidationError('La fecha inicial no es válida.')
  }

  if (duration.kind === 'indefinite') return null

  if (duration.kind === 'end_date') {
    if (!parseIsoDate(duration.endDate) || duration.endDate < startDate) {
      throw new MedicationValidationError('La fecha final debe ser igual o posterior a la fecha inicial.')
    }
    return duration.endDate
  }

  const amount = parseDurationAmount(duration)
  if (!amount) throw new MedicationValidationError('La duración no es válida.')

  if (duration.kind === 'days') return addDays(startDate, amount - 1)
  if (duration.kind === 'weeks') return addDays(startDate, amount * 7 - 1)

  return calendarMonthEndDate(startDate, amount)
}

export function getFrequencyIntervalDays(draft: MedicationDraft): number | null {
  if (draft.frequency.kind === 'daily') return 1
  if (draft.frequency.kind === 'every_two_days') return 2
  if (draft.frequency.kind === 'weekly') return 7

  const intervalDays = Number(draft.frequency.intervalDays)
  return Number.isInteger(intervalDays) && intervalDays >= 1 && intervalDays <= maximumFrequencyIntervalDays
    ? intervalDays
    : null
}

export function buildIntervalTimes(
  firstTime: string,
  intervalHours: number,
): string[] {
  const match = timePattern.exec(firstTime)
  if (!match || !Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 23) {
    throw new MedicationValidationError('El intervalo y la primera hora no son válidos.')
  }

  const firstMinutes = Number(match[1]) * 60 + Number(match[2])
  const intervalMinutes = intervalHours * 60
  const values = new Set<number>()
  let current = firstMinutes

  while (!values.has(current)) {
    values.add(current)
    current = (current + intervalMinutes) % (24 * 60)
  }

  return [...values]
    .sort((left, right) => left - right)
    .map((minutes) => {
      const hours = Math.floor(minutes / 60)
      const remainder = minutes % 60
      return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    })
}

export function validateMedicationStep(
  draft: MedicationDraft,
  step: number,
): string | null {
  if (step === 0) {
    const name = draft.name.trim()
    if (!name) return 'Escribe el nombre como aparece en la prescripción.'
    if (name.length > 160) return 'El nombre debe tener máximo 160 caracteres.'
  }

  if (step === 1) {
    const dosage = draft.dosageAmount.trim()
    if (!dosagePattern.test(dosage) || Number(dosage.replace(',', '.')) <= 0) {
      return 'Escribe una cantidad mayor que cero, con máximo tres decimales.'
    }

    const unit = draft.dosageUnit.trim()
    if (!unit) return 'Selecciona o escribe la presentación indicada.'
    if (unit.length > 50) return 'La presentación debe tener máximo 50 caracteres.'
  }

  if (step === 2 && getFrequencyIntervalDays(draft) === null) {
    return 'Escribe cada cuántos días debes tomarlo.'
  }

  if (step === 3) {
    if (draft.schedule.kind === 'fixed') {
      if (draft.schedule.times.length === 0 || draft.schedule.times.some((time) => !timePattern.test(time))) {
        return 'Completa todas las horas indicadas.'
      }

      if (new Set(draft.schedule.times).size !== draft.schedule.times.length) {
        return 'No repitas la misma hora.'
      }
    } else {
      const intervalHours = Number(draft.schedule.intervalHours)
      if (!timePattern.test(draft.schedule.firstTime)) {
        return 'Escribe la hora inicial indicada.'
      }
      if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 23) {
        return 'El intervalo debe ser un número entero entre 1 y 23 horas.'
      }
    }
  }

  if (step === 4 && !parseIsoDate(draft.startDate)) {
    return 'Selecciona una fecha inicial válida.'
  }

  if (step === 5) {
    if (draft.duration.kind === 'end_date') {
      if (!parseIsoDate(draft.startDate)) return 'Selecciona primero una fecha inicial válida.'
      if (!parseIsoDate(draft.duration.endDate) || draft.duration.endDate < draft.startDate) {
        return 'La fecha final debe ser igual o posterior a la fecha inicial.'
      }
    } else if (draft.duration.kind !== 'indefinite' && !parseDurationAmount(draft.duration)) {
      return 'Escribe una duración válida mayor que cero.'
    }
  }

  return null
}

export function validateMedicationDraft(draft: MedicationDraft): string | null {
  for (let step = 0; step < 6; step += 1) {
    const error = validateMedicationStep(draft, step)
    if (error) return error
  }

  return null
}

export function normalizeMedicationDraft(
  draft: MedicationDraft,
): ValidatedMedicationInput {
  const validationError = validateMedicationDraft(draft)
  if (validationError) throw new MedicationValidationError(validationError)

  const durationAmount = parseDurationAmount(draft.duration)
  const durationConfig: DurationConfig = draft.duration.kind === 'indefinite'
    ? { kind: 'indefinite', boundary: 'inclusive' }
    : draft.duration.kind === 'end_date'
      ? { kind: 'end_date', endDate: draft.duration.endDate, boundary: 'inclusive' }
      : {
          kind: draft.duration.kind,
          amount: durationAmount ?? undefined,
          boundary: 'inclusive',
        }
  const intervalDays = getFrequencyIntervalDays(draft)
  if (!intervalDays) throw new MedicationValidationError('La frecuencia no es válida.')
  const frequencyConfig = {
    frequencyKind: draft.frequency.kind,
    intervalDays,
  }

  if (draft.schedule.kind === 'fixed') {
    return {
      name: draft.name.trim(),
      dosageAmount: Number(draft.dosageAmount.replace(',', '.')),
      dosageUnit: draft.dosageUnit.trim(),
      scheduleType: 'daily',
      localTimes: [...draft.schedule.times].sort(),
      recurrenceConfig: { mode: 'fixed', ...frequencyConfig },
      startDate: draft.startDate,
      endDate: calculateEndDate(draft.startDate, draft.duration),
      durationConfig,
    }
  }

  const intervalHours = Number(draft.schedule.intervalHours)
  return {
    name: draft.name.trim(),
    dosageAmount: Number(draft.dosageAmount.replace(',', '.')),
    dosageUnit: draft.dosageUnit.trim(),
    scheduleType: 'interval',
    localTimes: buildIntervalTimes(draft.schedule.firstTime, intervalHours),
    recurrenceConfig: {
      mode: 'interval',
      firstTime: draft.schedule.firstTime,
      intervalHours,
      ...frequencyConfig,
    },
    startDate: draft.startDate,
    endDate: calculateEndDate(draft.startDate, draft.duration),
    durationConfig,
  }
}

export function getTodayDate(): string {
  const today = new Date()
  return toIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
}

export function getMedicationViewStatus(
  medication: Pick<Medication, 'status' | 'endDate'>,
  today = getTodayDate(),
): MedicationViewStatus {
  if (medication.status === 'paused') return 'suspended'
  if (medication.status === 'completed') return 'finished'
  if (medication.endDate && medication.endDate < today) return 'finished'
  return 'active'
}

export function medicationToDraft(medication: Medication): MedicationDraft {
  const duration = medication.durationConfig.kind === 'indefinite'
    ? { kind: 'indefinite' as const, amount: '', endDate: '' }
    : medication.durationConfig.kind === 'end_date'
      ? {
          kind: 'end_date' as const,
          amount: '',
          endDate: medication.durationConfig.endDate ?? medication.endDate ?? '',
        }
      : {
          kind: medication.durationConfig.kind,
          amount: String(medication.durationConfig.amount ?? ''),
          endDate: '',
        }

  const schedule = medication.schedule?.type === 'interval'
    ? {
        kind: 'interval' as const,
        firstTime: medication.schedule.firstTime ?? '',
        intervalHours: String(medication.schedule.intervalHours ?? ''),
      }
    : {
        kind: 'fixed' as const,
        times: medication.schedule?.localTimes.length
          ? medication.schedule.localTimes
          : [''],
      }

  return {
    name: medication.name,
    dosageAmount: String(medication.dosageAmount),
    dosageUnit: medication.dosageUnit,
    frequency: {
      kind: medication.schedule?.frequencyKind ?? 'daily',
      intervalDays: String(medication.schedule?.intervalDays ?? 1),
    },
    schedule,
    startDate: medication.startDate,
    duration,
  }
}
