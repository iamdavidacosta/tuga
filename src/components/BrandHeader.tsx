import { Link } from 'react-router-dom'

import { tugaAssets } from '../assets/tugaAssets'

export function BrandHeader() {
  return (
    <header className="brand-header">
      <Link
        className="brand-wordmark"
        to="/hoy"
        aria-label="TUGA, ir a Hoy"
      >
        <img src={tugaAssets.logos.text} alt="TUGA" />
      </Link>
    </header>
  )
}
