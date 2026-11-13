export type DoseStatus = 'pending' | 'taken' | 'skipped'

export interface DoseOccurrence {
  id: string
  medicationId: string
  scheduleId: string
  medicationName: string
  dosageAmount: number
  dosageUnit: string
  scheduledAt: string
  status: DoseStatus
  takenAt: string | null
  updatedAt: string
  localDate: string
  localTime: string
  displayTimezone: string
}

export interface DailyProgress {
  completed: number
  total: number
  percentage: number
}
