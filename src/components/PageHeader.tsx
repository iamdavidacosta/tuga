import { Link } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  eyebrow?: string
  backTo?: string
  backLabel?: string
}

export function PageHeader({
  title,
  eyebrow,
  backTo,
  backLabel = 'Regresar',
}: PageHeaderProps) {
  return (
    <header className="page-header">
      {backTo ? (
        <Link className="back-link" to={backTo}>
          <span aria-hidden="true">←</span>
          {backLabel}
        </Link>
      ) : null}
      {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
      <h1 className="tuga-heading">{title}</h1>
    </header>
  )
}
