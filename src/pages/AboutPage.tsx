import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function AboutPage() {
  useDocumentTitle('Acerca de TUGA')

  return (
    <article className="information-panel">
      <PageHeader
        backLabel="Volver a configuración"
        backTo="/configuracion"
        eyebrow="Información clara"
        title="Acerca de TUGA"
      />
      <p>
        TUGA te ayudará a organizar recordatorios y a registrar las tomas que
        tú confirmes.
      </p>
      <p>
        TUGA no cambia dosis, prescripciones ni tratamientos. Si tienes dudas
        sobre un medicamento, consulta a un profesional de la salud.
      </p>
      <Link className="text-link" to="/hoy">
        Ir a Hoy
      </Link>
    </article>
  )
}
