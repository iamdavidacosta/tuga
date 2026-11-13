import type { IntakeStatus } from '../types/medication'
import type { DoseStatus } from '../features/doses/types'
import { TugaIcon } from './TugaIcon'

const statusLabels: Record<IntakeStatus, string> = {
  pendiente: 'Pendiente',
  realizada: 'Tomado',
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
      {displayStatus === 'omitida' ? <span className="status-badge__mark" aria-hidden="true">×</span> : null}
      <span>{statusLabels[displayStatus]}</span>
    </span>
  )
}
