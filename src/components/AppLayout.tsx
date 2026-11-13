import { Outlet } from 'react-router-dom'

import { BottomNavigation } from './BottomNavigation'
import { BrandHeader } from './BrandHeader'

export function AppLayout() {
  return (
    <div className="tuga-app app-shell app-shell--with-navigation">
      <a className="skip-link" href="#contenido-principal">
        Ir al contenido principal
      </a>
      <BrandHeader />
      <main className="app-content" id="contenido-principal">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  )
}
