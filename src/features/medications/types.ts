export type MedicationStatus = 'active' | 'paused' | 'completed'
export type MedicationViewStatus = 'active' | 'suspended' | 'finished'
export type ScheduleType = 'daily' | 'interval'
export type DurationKind = 'days' | 'weeks' | 'months' | 'indefinite'

export interface FixedScheduleDraft {
  kind: 'fixed'
  times: string[]
}

export interface IntervalScheduleDraft {
  kind: 'interval'
  firstTime: string
  intervalHours: string
}

export type MedicationScheduleDraft =
  | FixedScheduleDraft
  | IntervalScheduleDraft

export interface TreatmentDurationDraft {
  kind: DurationKind
  amount: string
}

export interface MedicationDraft {
  name: string
  dosageAmount: string
  dosageUnit: string
  schedule: MedicationScheduleDraft
  startDate: string
  duration: TreatmentDurationDraft
}

export interface DurationConfig {
  kind: DurationKind
  amount?: number
  boundary: 'inclusive'
}

export interface MedicationSchedule {
  id: string
  type: ScheduleType
  localTimes: string[]
  timezone: string
  intervalHours: number | null
  firstTime: string | null
}

export interface Medication {
  id: string
  name: string
  dosageAmount: number
  dosageUnit: string
  instructions: string | null
  notes: string | null
  startDate: string
  endDate: string | null
  durationConfig: DurationConfig
  status: MedicationStatus
  createdAt: string
  updatedAt: string
  schedule: MedicationSchedule | null
}

export interface ValidatedMedicationInput {
  name: string
  dosageAmount: number
  dosageUnit: string
  scheduleType: ScheduleType
  localTimes: string[]
  recurrenceConfig: Record<string, string | number>
  startDate: string
  endDate: string | null
  durationConfig: DurationConfig
}

export const emptyMedicationDraft: MedicationDraft = {
  name: '',
  dosageAmount: '',
  dosageUnit: '',
  schedule: { kind: 'fixed', times: [''] },
  startDate: '',
  duration: { kind: 'days', amount: '' },
}
