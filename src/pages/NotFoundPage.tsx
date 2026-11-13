import { Link } from 'react-router-dom'

import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Página no encontrada | TUGA')

  return (
    <article className="information-panel">
      <p className="welcome-eyebrow">Página no encontrada</p>
      <h1 className="tuga-heading">No encontramos esta página</h1>
      <p>La dirección puede estar incompleta o haber cambiado.</p>
      <Link className="tuga-button-primary compact-action" to="/">
        Ir al inicio
      </Link>
    </article>
  )
}
