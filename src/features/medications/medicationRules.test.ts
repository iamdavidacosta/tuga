import { describe, expect, it } from 'vitest'

import {
  buildIntervalTimes,
  calculateEndDate,
  getMedicationViewStatus,
  normalizeMedicationDraft,
  validateMedicationStep,
} from './medicationRules'
import type { MedicationDraft } from './types'

const validDraft: MedicationDraft = {
  name: 'Medicamento indicado',
  dosageAmount: '1,5',
  dosageUnit: 'tabletas',
  schedule: { kind: 'fixed', times: ['20:00', '08:00'] },
  startDate: '2026-01-15',
  duration: { kind: 'months', amount: '1' },
}

describe('reglas de medicamentos', () => {
  it('calcula días y semanas con fechas inicial y final inclusivas', () => {
    expect(calculateEndDate('2026-01-10', { kind: 'days', amount: '1' })).toBe('2026-01-10')
    expect(calculateEndDate('2026-01-10', { kind: 'weeks', amount: '2' })).toBe('2026-01-23')
  })

  it('calcula meses calendario sin convertirlos en 30 días', () => {
    expect(calculateEndDate('2026-01-15', { kind: 'months', amount: '1' })).toBe('2026-02-14')
    expect(calculateEndDate('2026-01-31', { kind: 'months', amount: '1' })).toBe('2026-02-28')
    expect(calculateEndDate('2024-01-31', { kind: 'months', amount: '1' })).toBe('2024-02-29')
  })

  it('representa duración indefinida sin fecha final', () => {
    expect(calculateEndDate('2026-01-10', { kind: 'indefinite', amount: '' })).toBeNull()
  })

  it('genera todos los horarios de un intervalo aunque cruce medianoche', () => {
    expect(buildIntervalTimes('20:00', 8)).toEqual(['04:00', '12:00', '20:00'])
    expect(buildIntervalTimes('06:30', 12)).toEqual(['06:30', '18:30'])
  })

  it('rechaza horarios fijos repetidos', () => {
    expect(validateMedicationStep({
      ...validDraft,
      schedule: { kind: 'fixed', times: ['08:00', '08:00'] },
    }, 2)).toBe('No repitas la misma hora.')
  })

  it('normaliza dosis, horarios y límites del tratamiento', () => {
    expect(normalizeMedicationDraft(validDraft)).toMatchObject({
      dosageAmount: 1.5,
      localTimes: ['08:00', '20:00'],
      startDate: '2026-01-15',
      endDate: '2026-02-14',
      durationConfig: { kind: 'months', amount: 1, boundary: 'inclusive' },
    })
  })

  it('considera activa la fecha final y finaliza al día siguiente', () => {
    expect(getMedicationViewStatus({ status: 'active', endDate: '2026-01-15' }, '2026-01-15')).toBe('active')
    expect(getMedicationViewStatus({ status: 'active', endDate: '2026-01-15' }, '2026-01-16')).toBe('finished')
    expect(getMedicationViewStatus({ status: 'paused', endDate: null }, '2026-01-15')).toBe('suspended')
  })
})
