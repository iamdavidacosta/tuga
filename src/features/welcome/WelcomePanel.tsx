import { tugaAssets } from '../../assets/tugaAssets'
import { useAuth } from '../auth/authContext'

export function WelcomePanel() {
  const { signIn, isBusy, errorMessage } = useAuth()

  return (
    <main className="welcome-screen" id="contenido-principal">
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <p className="welcome-eyebrow">Tu salud, a tiempo</p>
          <h1 id="welcome-title" className="tuga-heading">
            Bienvenido a TUGA
          </h1>
          <p className="welcome-message">
            Una forma clara y amable de recordar tus medicamentos.
          </p>
        </div>
        <img
          className="welcome-mascot"
          src={tugaAssets.mascots.heart}
          alt="TUGA, la tortuga, abraza un corazón"
        />
        <div className="login-panel" aria-labelledby="login-title">
          <h2 className="tuga-heading" id="login-title">
            Iniciar sesión
          </h2>
          <button
            aria-describedby="login-description"
            className="tuga-button-primary login-button"
            disabled={isBusy}
            onClick={() => void signIn()}
            type="button"
          >
            {isBusy ? 'Abriendo Google…' : 'Continuar con Google'}
          </button>
          <p className="supporting-text" id="login-description">
            Usaremos tu cuenta de Google para identificarte de forma segura.
          </p>
          {errorMessage ? (
            <p className="auth-error" role="alert">{errorMessage}</p>
          ) : null}
        </div>
        <p className="welcome-disclaimer">
          TUGA no recomienda dosis ni modifica tratamientos.
        </p>
      </section>
    </main>
  )
}
