import type {
  DemoCalendarDay,
  DemoIntake,
  DemoMedication,
} from '../../types/medication'

export const demoIntakes: DemoIntake[] = [
  {
    id: 'toma-manana',
    medicationName: 'Medicamento de ejemplo A',
    dose: 'Según la fórmula: 1 tableta',
    time: '8:00 a. m.',
    status: 'pendiente',
    statusDetail: 'Pendiente de confirmación',
  },
  {
    id: 'toma-tarde',
    medicationName: 'Medicamento de ejemplo B',
    dose: 'Según la fórmula: 1 cápsula',
    time: '2:00 p. m.',
    status: 'realizada',
    statusDetail: 'Confirmada a las 2:05 p. m. (ejemplo)',
  },
  {
    id: 'toma-noche',
    medicationName: 'Medicamento de ejemplo C',
    dose: 'Según la fórmula: 5 ml',
    time: '8:00 p. m.',
    status: 'omitida',
    statusDetail: 'Omitida (ejemplo)',
  },
]

export const demoMedications: DemoMedication[] = [
  {
    id: 'medicamento-a',
    name: 'Medicamento de ejemplo A',
    dose: '1 tableta',
    schedule: 'Todos los días · 8:00 a. m.',
    status: 'activo',
  },
  {
    id: 'medicamento-b',
    name: 'Medicamento de ejemplo B',
    dose: '1 cápsula',
    schedule: 'Todos los días · 2:00 p. m.',
    status: 'activo',
  },
]

export const demoCalendarDays: DemoCalendarDay[] = [
  { date: '2026-11-10', weekday: 'Mar', dayNumber: 10, intakeIds: [] },
  { date: '2026-11-11', weekday: 'Mié', dayNumber: 11, intakeIds: [] },
  {
    date: '2026-11-12',
    weekday: 'Jue',
    dayNumber: 12,
    intakeIds: demoIntakes.map(({ id }) => id),
  },
  { date: '2026-11-13', weekday: 'Vie', dayNumber: 13, intakeIds: [] },
  { date: '2026-11-14', weekday: 'Sáb', dayNumber: 14, intakeIds: [] },
  { date: '2026-11-15', weekday: 'Dom', dayNumber: 15, intakeIds: [] },
  { date: '2026-11-16', weekday: 'Lun', dayNumber: 16, intakeIds: [] },
]
