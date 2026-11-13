import { WelcomePanel } from '../features/welcome/WelcomePanel'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function HomePage() {
  useDocumentTitle('Inicio | TUGA')

  return (
    <div className="tuga-app app-shell welcome-shell">
      <a className="skip-link" href="#contenido-principal">
        Ir al contenido principal
      </a>
      <WelcomePanel />
    </div>
  )
}
