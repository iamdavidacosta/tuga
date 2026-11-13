import { useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { getOAuthCallbackError } from '../features/auth/authErrors'
import { useAuth } from '../features/auth/authContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function AuthCallbackPage() {
  useDocumentTitle('Completando inicio de sesión | TUGA')
  const navigate = useNavigate()
  const { session, isLoading, errorMessage } = useAuth()
  const callbackError = useMemo(
    () => getOAuthCallbackError(window.location),
    [],
  )
  const visibleError = callbackError ?? errorMessage

  useEffect(() => {
    if (session) {
      void navigate('/hoy', { replace: true })
    }
  }, [navigate, session])

  return (
    <div className="tuga-app app-shell welcome-shell">
      <main className="welcome-screen" id="contenido-principal">
        <section className="auth-state-card" aria-live="polite">
          <p className="welcome-eyebrow">Inicio de sesión</p>
          {visibleError ? (
            <>
              <h1 className="tuga-heading">No pudimos iniciar tu sesión</h1>
              <p className="auth-error" role="alert">{visibleError}</p>
              <Link className="tuga-button-primary full-width-action" to="/">
                Volver a intentar
              </Link>
            </>
          ) : (
            <>
              <h1 className="tuga-heading">Completando el acceso</h1>
              <p>
                {isLoading
                  ? 'Estamos verificando tu cuenta de Google.'
                  : 'No recibimos una sesión válida. Vuelve a iniciar el acceso.'}
              </p>
              {!isLoading && !session ? (
                <Link className="tuga-button-primary full-width-action" to="/">
                  Volver al inicio
                </Link>
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
