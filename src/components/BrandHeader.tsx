import { Link } from 'react-router-dom'

export function BrandHeader() {
  return (
    <header className="brand-header">
      <Link
        className="brand-wordmark tuga-heading"
        to="/hoy"
        aria-label="TUGA, ir a Hoy"
      >
        TUGA
      </Link>
    </header>
  )
}
