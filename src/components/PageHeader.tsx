import { Link } from 'react-router-dom'

import type { TugaIconName } from '../assets/tugaAssets'
import { TugaIcon } from './TugaIcon'

interface PageHeaderProps {
  title: string
  eyebrow?: string
  backTo?: string
  backLabel?: string
  icon?: TugaIconName
}

export function PageHeader({
  title,
  eyebrow,
  backTo,
  backLabel = 'Regresar',
  icon,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      {backTo ? (
        <Link aria-label={backLabel} className="back-link" to={backTo}>
          <span aria-hidden="true">←</span>
          <span className="visually-hidden">{backLabel}</span>
        </Link>
      ) : null}
      <div className="page-header__copy">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <h1 className="tuga-heading">
          {icon ? <TugaIcon name={icon} /> : null}
          <span>{title}</span>
        </h1>
      </div>
    </header>
  )
}
