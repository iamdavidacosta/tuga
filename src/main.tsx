import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppRouter } from './app/AppRouter'
import { startTugaServiceWorker } from './services/pwa/serviceWorker'
import './styles/tuga.css'
import './styles/global.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('No se encontró el contenedor principal de TUGA.')
}

startTugaServiceWorker()

createRoot(rootElement).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
)
