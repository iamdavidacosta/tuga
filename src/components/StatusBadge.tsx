import type { IntakeStatus } from '../types/medication'
import type { DoseStatus } from '../features/doses/types'
import { TugaIcon } from './TugaIcon'

const statusLabels: Record<IntakeStatus, string> = {
  pendiente: 'Pendiente',
  realizada: 'Realizada',
  omitida: 'Omitida',
}

interface StatusBadgeProps {
  status: IntakeStatus | DoseStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const displayStatus: IntakeStatus = status === 'pending'
    ? 'pendiente'
    : status === 'taken'
      ? 'realizada'
      : status === 'skipped'
        ? 'omitida'
        : status

  return (
    <span className={`status-badge status-badge--${displayStatus}`}>
      {displayStatus === 'pendiente' ? <TugaIcon name="pending" /> : null}
      {displayStatus === 'realizada' ? <TugaIcon name="taken" /> : null}
      <span>{statusLabels[displayStatus]}</span>
    </span>
  )
}
