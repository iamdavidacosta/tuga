import { useState } from 'react'
import { Link } from 'react-router-dom'

import { tugaAssets } from '../assets/tugaAssets'
import { TugaIcon } from '../components/TugaIcon'
import { useAuth } from '../features/auth/authContext'
import { UserProfileCard } from '../features/auth/UserProfileCard'
import { useSystemHealth } from '../features/health/useSystemHealth'
import { usePushNotifications } from '../features/notifications/usePushNotifications'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

interface MoreOptionCardProps {
  description: string
  icon: 'settings' | 'reminder' | 'calendar' | 'history'
  label: string
  to: string
}

function MoreOptionCard({ description, icon, label, to }: MoreOptionCardProps) {
  return (
    <a className="more-option-card" href={to}>
      <span aria-hidden="true" className="more-option-card__icon">
        <TugaIcon name={icon} />
      </span>
      <span className="more-option-card__copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span aria-hidden="true" className="more-option-card__arrow">→</span>
    </a>
  )
}

export function SettingsPage() {
  useDocumentTitle('Más opciones | TUGA')
  const { user, signOut, isBusy, errorMessage } = useAuth()
  const notifications = usePushNotifications()
  const notificationState = notifications.state
  const health = useSystemHealth()
  const [showSignOutConfirmation, setShowSignOutConfirmation] = useState(false)

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
    <div className="more-screen">
      <header className="more-header">
        <Link aria-label="Volver a Hoy" className="more-header__back" to="/hoy">
          <span aria-hidden="true">←</span>
        </Link>
        <Link aria-label="TUGA, ir a Hoy" className="more-header__logo" to="/hoy">
          <img alt="TUGA" src={tugaAssets.logos.text} />
        </Link>
      </header>

      <section className="more-intro" aria-labelledby="more-page-title">
        <img alt="Tuga te acompaña en tus recordatorios" src={tugaAssets.mascots.salute} />
        <div>
          <h1 id="more-page-title">Más opciones</h1>
          <p>Configura TUGA fácilmente.</p>
        </div>
      </section>

      <nav className="more-options" aria-label="Opciones de TUGA">
        <MoreOptionCard description="Cuenta de Google y datos personales." icon="settings" label="Mi perfil" to="#perfil" />
        <MoreOptionCard description="Activa y prueba tus notificaciones." icon="reminder" label="Recordatorios" to="#recordatorios" />
        <MoreOptionCard description="Zona horaria y estado del servicio." icon="calendar" label="Mis preferencias" to="#preferencias" />
        <MoreOptionCard description="Instrucciones sencillas para usar TUGA." icon="history" label="Ayuda" to="/acerca-de-tuga" />
      </nav>

      <div className="more-details">
        <section className="more-detail-card" id="perfil" aria-labelledby="profile-title">
          {user ? <UserProfileCard user={user} /> : <p className="loading-message" role="status">Cargando tu perfil…</p>}
        </section>

        <section className="more-detail-card" id="recordatorios" aria-labelledby="notifications-title">
          <div className="more-detail-card__heading">
            <span aria-hidden="true" className="more-detail-card__icon"><TugaIcon name="reminder" /></span>
            <div>
              <p className="card-kicker">Este dispositivo</p>
              <h2 id="notifications-title">Recordatorios</h2>
            </div>
          </div>
          {!notificationState ? <p className="loading-message" role="status">Consultando recordatorios…</p> : null}
          {notificationState ? (
            <div className="notification-settings">
              <p className="notification-status">
                <strong>{notificationState.currentDeviceActive ? 'Recordatorios activos' : 'Recordatorios no activos'}</strong>
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
              <p className="supporting-text">Dispositivos activos en tu cuenta: {notificationState.activeDevices}.</p>
            </div>
          ) : null}
          <p className="action-feedback" aria-live="polite">{notifications.message}</p>
          {notifications.errorMessage ? <p className="auth-error" role="alert">{notifications.errorMessage}</p> : null}
        </section>

        <section className="more-detail-card" id="preferencias" aria-labelledby="preferences-title">
          <div className="more-detail-card__heading">
            <span aria-hidden="true" className="more-detail-card__icon"><TugaIcon name="calendar" /></span>
            <div>
              <p className="card-kicker">Disponibilidad</p>
              <h2 id="preferences-title">Mis preferencias</h2>
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
              {health.state === 'checking' ? 'Comprobando…' : 'Comprobar conexión'}
            </button>
          </div>
          <nav className="more-secondary-links" aria-label="Más información">
            <Link to="/historial"><TugaIcon name="history" /><span>Historial de tomas</span><span aria-hidden="true">→</span></Link>
            <Link to="/acerca-de-tuga"><TugaIcon name="settings" /><span>Acerca de TUGA</span><span aria-hidden="true">→</span></Link>
          </nav>
        </section>

        <section className="more-signout" aria-labelledby="session-title">
          <h2 id="session-title">Cerrar sesión</h2>
          {!showSignOutConfirmation ? (
            <button className="more-signout__button" disabled={isBusy} onClick={() => setShowSignOutConfirmation(true)} type="button">
              Cerrar sesión
            </button>
          ) : (
            <div className="more-signout__confirmation" role="group" aria-label="Confirmar cierre de sesión">
              <p>¿Quieres cerrar tu sesión en este dispositivo?</p>
              <div>
                <button className="more-signout__button" disabled={isBusy} onClick={() => void signOut()} type="button">
                  {isBusy ? 'Cerrando sesión…' : 'Sí, cerrar sesión'}
                </button>
                <button className="tuga-button-secondary full-width-action" disabled={isBusy} onClick={() => setShowSignOutConfirmation(false)} type="button">
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}
        </section>
      </div>
    </div>
  )
}
