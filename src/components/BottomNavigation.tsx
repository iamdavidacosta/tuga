import { NavLink } from 'react-router-dom'

import type { TugaIconName } from '../assets/tugaAssets'
import { TugaIcon } from './TugaIcon'

interface NavigationItem {
  label: string
  to: string
  icon: TugaIconName
}

const navigationItems: NavigationItem[] = [
  { label: 'Hoy', to: '/hoy', icon: 'reminder' },
  { label: 'Medicamentos', to: '/medicamentos', icon: 'medication' },
  { label: 'Calendario', to: '/calendario', icon: 'calendar' },
  { label: 'Más', to: '/configuracion', icon: 'settings' },
]

export function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="Navegación principal">
      {navigationItems.map(({ label, to, icon }) => (
        <NavLink
          className={({ isActive }) =>
            `bottom-navigation__item${isActive ? ' is-active' : ''}`
          }
          key={to}
          to={to}
        >
          <TugaIcon name={icon} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
