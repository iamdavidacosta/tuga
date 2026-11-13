import { providerAssets, tugaAssets } from '../../assets/tugaAssets'
import { useAuth } from '../auth/authContext'

export function WelcomePanel() {
  const { signIn, isBusy, errorMessage } = useAuth()

  return (
    <main
      className="welcome-screen"
      id="contenido-principal"
      style={{ backgroundImage: `url("${tugaAssets.patterns.landscape}")` }}
    >
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <img
          className="welcome-brand"
          src={tugaAssets.logos.smilingVertical}
          alt="TUGA, tortuga sonriente"
        />
        <div className="welcome-copy">
          <h1 id="welcome-title" className="tuga-heading">
            Bienvenido a TUGA
          </h1>
          <p className="welcome-message">
            Te ayudamos a recordar tus medicamentos de forma clara, amable y a tiempo.
          </p>
        </div>
        <div className="login-panel" aria-labelledby="login-title">
          <h2 className="visually-hidden" id="login-title">Iniciar sesión</h2>
          <button
            className="tuga-button-primary login-button"
            disabled={isBusy}
            onClick={() => void signIn()}
            type="button"
          >
            <img className="google-mark" src={providerAssets.google} alt="" aria-hidden="true" />
            {isBusy ? 'Abriendo Google…' : 'Entrar con Google'}
          </button>
          {errorMessage ? (
            <p className="auth-error" role="alert">{errorMessage}</p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
