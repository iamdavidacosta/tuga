import type { Medication, MedicationSchedule } from './types'

export function formatMedicationDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))

  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function formatDosage(
  medication: Pick<Medication, 'dosageAmount' | 'dosageUnit'>,
): string {
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(medication.dosageAmount)} ${medication.dosageUnit}`
}

export function formatSchedule(schedule: MedicationSchedule | null): string {
  if (!schedule) return 'Horario no disponible'

  if (schedule.type === 'interval' && schedule.intervalHours) {
    const firstTime = schedule.firstTime ?? schedule.localTimes[0]
    return `Cada ${schedule.intervalHours} horas${firstTime ? ` · Primera hora: ${firstTime}` : ''}`
  }

  return `Horarios fijos: ${schedule.localTimes.join(', ')}`
}

export function formatTreatmentDates(
  medication: Pick<Medication, 'startDate' | 'endDate'>,
): string {
  if (!medication.endDate) {
    return `Desde el ${formatMedicationDate(medication.startDate)} · Sin fecha final`
  }

  return `Del ${formatMedicationDate(medication.startDate)} al ${formatMedicationDate(medication.endDate)}, ambas fechas incluidas`
}
