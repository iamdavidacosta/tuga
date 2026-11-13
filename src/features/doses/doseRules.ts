import type { DailyProgress, DoseOccurrence } from './types'

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

function dateFromIso(value: string): Date {
  if (!isoDatePattern.test(value)) throw new Error('Fecha no válida.')
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) throw new Error('Fecha no válida.')
  return date
}

export function addCalendarDays(value: string, amount: number): string {
  const date = dateFromIso(value)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function getLocalIsoDate(date = new Date(), timezone = 'America/Bogota'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function getMonthRange(monthDate: string): { from: string; to: string } {
  const date = dateFromIso(monthDate)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const from = new Date(Date.UTC(year, month, 1, 12))
  const to = new Date(Date.UTC(year, month + 1, 0, 12))
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export function moveMonth(monthDate: string, amount: number): string {
  const date = dateFromIso(monthDate)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1, 12))
    .toISOString()
    .slice(0, 10)
}

export function getMonthDays(monthDate: string): string[] {
  const { from, to } = getMonthRange(monthDate)
  const values: string[] = []
  for (let current = from; current <= to; current = addCalendarDays(current, 1)) {
    values.push(current)
  }
  return values
}

export function calculateDailyProgress(occurrences: DoseOccurrence[]): DailyProgress {
  const total = occurrences.length
  const completed = occurrences.filter(({ status }) => status === 'taken').length
  return {
    total,
    completed,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

export function findNextPending(
  occurrences: DoseOccurrence[],
  now = new Date(),
): DoseOccurrence | null {
  const pending = occurrences.filter(({ status }) => status === 'pending')
  return pending.find(({ scheduledAt }) => new Date(scheduledAt) >= now) ?? pending[0] ?? null
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateFromIso(value))
}

export function formatMonth(value: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dateFromIso(value))
}

export function formatDoseAmount(value: number): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(value)
}
