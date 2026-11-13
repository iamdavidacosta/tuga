export type IntakeStatus = 'pendiente' | 'realizada' | 'omitida'

export interface DemoMedication {
  id: string
  name: string
  dose: string
  schedule: string
  status: 'activo' | 'finalizado'
}

export interface DemoIntake {
  id: string
  medicationName: string
  dose: string
  time: string
  status: IntakeStatus
  statusDetail: string
}

export interface DemoCalendarDay {
  date: string
  weekday: string
  dayNumber: number
  intakeIds: string[]
}
