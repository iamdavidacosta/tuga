import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { TugaIcon } from '../components/TugaIcon'
import { useAuth } from '../features/auth/authContext'
import { UserProfileCard } from '../features/auth/UserProfileCard'
import { useSystemHealth } from '../features/health/useSystemHealth'
import { usePushNotifications } from '../features/notifications/usePushNotifications'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function SettingsPage() {
  useDocumentTitle('Configuración | TUGA')
  const { user, signOut, isBusy, errorMessage } = useAuth()
  const notifications = usePushNotifications()
  const notificationState = notifications.state
  const health = useSystemHealth()

  const connectionLabel = health.state === 'checking'
    ? 'Comprobando conexión…'
    : health.state === 'available'
      ? 'Conexión disponible.'
      : 'No pudimos conectar en este momento.'
  const notificationsLabel = !notificationState
    ? 'Consultando notificaciones…'
    : notificationState.currentDeviceActive
      ? 'Notificaciones activadas.'
      : 'Notificaciones desactivadas.'

  return (
    <div className="screen-stack">
      <PageHeader backLabel="Volver a Hoy" backTo="/hoy" title="Configuración" />
      {user ? <UserProfileCard user={user} /> : null}
      <section className="settings-card" aria-labelledby="notifications-title">
        <div className="settings-card__heading">
          <span className="icon-tile"><TugaIcon name="reminder" /></span>
          <div>
            <p className="card-kicker">Este dispositivo</p>
            <h2 className="tuga-heading" id="notifications-title">Notificaciones</h2>
          </div>
        </div>
        {!notificationState ? <p className="loading-message" role="status">Consultando recordatorios…</p> : null}
        {notificationState ? (
          <div className="notification-settings">
            <p className="notification-status">
              <strong>
                {notificationState.currentDeviceActive
                  ? 'Recordatorios activos'
                  : 'Recordatorios no activos'}
              </strong>
              <span>{notificationState.support.message}</span>
            </p>
            {notificationState.support.availability === 'available' ? (
              notificationState.currentDeviceActive ? (
                <div className="stacked-actions">
                  <button className="tuga-button-secondary full-width-action" disabled={notifications.isBusy} onClick={() => void notifications.test()} type="button">
                    Probar mis recordatorios
                  </button>
                  <button className="text-button danger-text-button" disabled={notifications.isBusy} onClick={() => void notifications.disable()} type="button">
                    Desactivar en este dispositivo
                  </button>
                </div>
              ) : (
                <button className="tuga-button-primary full-width-action" disabled={notifications.isBusy} onClick={() => void notifications.enable()} type="button">
                  {notifications.isBusy ? 'Activando…' : 'Activar recordatorios'}
                </button>
              )
            ) : null}
            <p className="supporting-text">
              Dispositivos activos en tu cuenta: {notificationState.activeDevices}.
              TUGA solo pedirá permiso cuando pulses el botón.
            </p>
          </div>
        ) : null}
        <p className="action-feedback" aria-live="polite">{notifications.message}</p>
        {notifications.errorMessage ? <p className="auth-error" role="alert">{notifications.errorMessage}</p> : null}
        <p className="supporting-text">
          La pantalla bloqueada mostrará un aviso general, sin nombre ni dosis. El proveedor push puede aceptar un envío sin garantizar que llegue al dispositivo.
        </p>
      </section>

      <section className="settings-card" aria-labelledby="system-status-title">
        <div className="settings-card__heading">
          <span className="icon-tile"><TugaIcon name="settings" /></span>
          <div>
            <p className="card-kicker">Disponibilidad</p>
            <h2 className="tuga-heading" id="system-status-title">Estado de TUGA</h2>
          </div>
        </div>
        <div className="notification-settings" aria-live="polite">
          <p className="notification-status">
            <strong>{connectionLabel}</strong>
            <span>{notificationsLabel}</span>
          </p>
          <button
            className="tuga-button-secondary full-width-action"
            disabled={health.state === 'checking'}
            onClick={() => void health.check()}
            type="button"
          >
            {health.state === 'checking' ? 'Comprobando…' : 'Comprobar'}
          </button>
        </div>
      </section>

      <nav className="settings-links" aria-label="Otras opciones">
        <Link to="/historial"><TugaIcon name="history" /><span>Ver historial</span><span aria-hidden="true">›</span></Link>
        <Link to="/acerca-de-tuga"><TugaIcon name="settings" /><span>Acerca de TUGA</span><span aria-hidden="true">›</span></Link>
      </nav>

      <section className="settings-card" aria-labelledby="session-title">
        <h2 className="tuga-heading" id="session-title">Sesión</h2>
        <button
          className="tuga-button-secondary full-width-action"
          disabled={isBusy}
          onClick={() => void signOut()}
          type="button"
        >
          {isBusy ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
        <p className="supporting-text">Cierra la sesión solamente en este dispositivo.</p>
        {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}
      </section>
    </div>
  )
}
