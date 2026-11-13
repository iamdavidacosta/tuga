import { describe, expect, it } from 'vitest'

import {
  calculateDailyProgress,
  findNextPending,
  getLocalIsoDate,
  getMonthDays,
  getMonthRange,
  moveMonth,
} from './doseRules'
import type { DoseOccurrence } from './types'

const occurrence = (overrides: Partial<DoseOccurrence> = {}): DoseOccurrence => ({
  id: 'dose-1',
  medicationId: 'med-1',
  scheduleId: 'schedule-1',
  medicationName: 'Medicamento de prueba',
  dosageAmount: 1,
  dosageUnit: 'tableta',
  scheduledAt: '2026-11-12T13:00:00Z',
  status: 'pending',
  takenAt: null,
  updatedAt: '2026-11-12T12:00:00Z',
  localDate: '2026-11-12',
  localTime: '08:00',
  displayTimezone: 'America/Bogota',
  ...overrides,
})

describe('reglas de calendario y progreso', () => {
  it('calcula meses completos y cruza correctamente el cambio de año', () => {
    expect(getMonthRange('2026-12-15')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(moveMonth('2026-12-15', 1)).toBe('2027-01-01')
    expect(moveMonth('2027-01-15', -1)).toBe('2026-12-01')
    expect(getMonthDays('2028-02-10')).toHaveLength(29)
  })

  it('obtiene la fecha en la zona configurada incluso al cruzar medianoche', () => {
    const instant = new Date('2026-11-13T04:30:00Z')
    expect(getLocalIsoDate(instant, 'America/Bogota')).toBe('2026-11-12')
    expect(getLocalIsoDate(instant, 'Europe/Madrid')).toBe('2026-11-13')
  })

  it('calcula progreso solo con tomas confirmadas', () => {
    const doses = [
      occurrence({ id: 'one', status: 'taken' }),
      occurrence({ id: 'two', status: 'pending' }),
      occurrence({ id: 'three', status: 'skipped' }),
    ]
    expect(calculateDailyProgress(doses)).toEqual({ completed: 1, total: 3, percentage: 33 })
  })

  it('destaca la próxima pendiente y nunca una omitida o realizada', () => {
    const doses = [
      occurrence({ id: 'past', scheduledAt: '2026-11-12T12:00:00Z' }),
      occurrence({ id: 'taken', scheduledAt: '2026-11-12T13:00:00Z', status: 'taken' }),
      occurrence({ id: 'next', scheduledAt: '2026-11-12T14:00:00Z' }),
    ]
    expect(findNextPending(doses, new Date('2026-11-12T13:30:00Z'))?.id).toBe('next')
  })
})
