import { useState } from 'react'
import { Link } from 'react-router-dom'

import { tugaAssets } from '../assets/tugaAssets'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { TugaIcon } from '../components/TugaIcon'
import { useAuth } from '../features/auth/authContext'
import {
  calculateDailyProgress,
  findNextPending,
  formatDoseAmount,
} from '../features/doses/doseRules'
import { useDoseContext } from '../features/doses/useDoseContext'
import { useDoseOccurrences } from '../features/doses/useDoseOccurrences'
import { postponeDoseReminder } from '../features/notifications/notificationService'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

function formatTodayTime(value: string): string {
  const [hourText = '', minute = ''] = value.split(':')
  const hour = Number(hourText)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !/^\d{2}$/.test(minute)) return value
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${period}`
}

export function TodayPage() {
  useDocumentTitle('Hoy | TUGA')
  const { user } = useAuth()
  const doseContext = useDoseContext()
  const today = doseContext.context?.today ?? '1970-01-01'
  const { occurrences, isLoading, errorMessage } = useDoseOccurrences(today, today, Boolean(doseContext.context))
  const [pendingMessage, setPendingMessage] = useState('')
  const [isPostponing, setIsPostponing] = useState(false)
  const nextOccurrence = findNextPending(occurrences)
  const progress = calculateDailyProgress(occurrences)
  const otherOccurrences = occurrences.filter(({ id }) => id !== nextOccurrence?.id)
  const allTaken = occurrences.length > 0 && occurrences.every(({ status }) => status === 'taken')
  const metadataName = user?.user_metadata.full_name ?? user?.user_metadata.name
  const firstName = typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim().split(/\s+/)[0]
    : ''

  async function postponeNextReminder() {
    if (!nextOccurrence || isPostponing) return
    setIsPostponing(true)
    setPendingMessage('')
    try {
      await postponeDoseReminder(nextOccurrence.id)
      setPendingMessage('Te recordaremos nuevamente en 15 minutos. La toma continúa pendiente.')
    } catch (error) {
      setPendingMessage(error instanceof Error ? error.message : 'No pudimos programar el recordatorio. Inténtalo nuevamente.')
    } finally {
      setIsPostponing(false)
    }
  }

  if (!doseContext.context) {
    return (
      <div className="screen-stack">
        <PageHeader title="Medicamentos de hoy" />
        {doseContext.isLoading
          ? <p className="loading-message" role="status">Cargando tu fecha local…</p>
          : <p className="auth-error" role="alert">{doseContext.errorMessage}</p>}
      </div>
    )
  }

  return (
    <div className="screen-stack today-screen">
      <section className="today-hero" aria-labelledby="today-title">
        <div className="today-hero__copy">
          <h1 className="tuga-heading" id="today-title">Hola{firstName ? `, ${firstName}` : ''}</h1>
          <p>Aquí tienes tu próxima toma.</p>
        </div>
        <img className="today-hero__mascot" src={tugaAssets.mascots.salute} alt="TUGA te saluda" />
      </section>
      <h2 className="visually-hidden">Medicamentos de hoy</h2>
      {isLoading ? <p className="loading-message" role="status">Cargando tus tomas…</p> : null}
      {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}

      {!isLoading && !errorMessage && occurrences.length === 0 ? (
        <section className="empty-state compact-section">
          <TugaIcon name="calendar" className="empty-state__icon" />
          <h2 className="tuga-heading">No tienes tomas programadas para hoy</h2>
          <p>Consulta tu calendario o revisa tus medicamentos activos.</p>
          <Link className="tuga-button-secondary full-width-action" to="/medicamentos">Ver mis medicamentos</Link>
        </section>
      ) : null}

      {nextOccurrence ? (
        <section className="intake-card intake-card--primary today-next-card" aria-labelledby="next-intake-heading">
          <h2 className="today-next-card__heading" id="next-intake-heading">
            <TugaIcon name="medication" />
            <span>Próximo medicamento</span>
          </h2>
          <div className="today-next-card__body">
            <div className="medication-summary medication-summary--featured">
              <span className="icon-tile icon-tile--large"><TugaIcon name="medication" /></span>
              <div>
                <h3 className="tuga-heading" id="next-intake-title">{nextOccurrence.medicationName}</h3>
                <p className="dose-pill">{formatDoseAmount(nextOccurrence.dosageAmount)} {nextOccurrence.dosageUnit}</p>
              </div>
            </div>
            <div className="today-schedule">
              <TugaIcon name="calendar" />
              <span className="today-schedule__divider" aria-hidden="true" />
              <p><span className="visually-hidden">Hora programada: </span><strong>{formatTodayTime(nextOccurrence.localTime)}</strong></p>
            </div>
            <StatusBadge status={nextOccurrence.status} />
          </div>
          <div className="stacked-actions">
            <Link className="tuga-button-primary full-width-action" to={`/tomas/${nextOccurrence.id}/confirmar`}>
              <TugaIcon name="taken" /> Tomé mi medicamento
            </Link>
            <button
              className="tuga-button-secondary full-width-action"
              disabled={isPostponing}
              onClick={() => void postponeNextReminder()}
              type="button"
            ><TugaIcon name="postpone" /> {isPostponing ? 'Programando…' : 'Recordar más tarde'}</button>
          </div>
          {pendingMessage ? <p className="action-feedback" aria-live="polite">{pendingMessage}</p> : null}
        </section>
      ) : null}

      {!isLoading && !errorMessage && occurrences.length > 0 && !nextOccurrence ? (
        <section className="today-finished-card" aria-labelledby="finished-title">
          <div className="today-finished-card__heading"><TugaIcon name="taken" /> Medicamentos de hoy</div>
          <div className="today-finished-card__body">
            <img
              src={allTaken ? tugaAssets.mascots.celebration : tugaAssets.mascots.calendar}
              alt={allTaken ? 'TUGA celebra contigo' : 'TUGA sostiene un calendario de medicamentos'}
            />
            <div>
              <h2 className="tuga-heading" id="finished-title">
                {allTaken
                  ? '¡Muy bien! Ya completaste tus medicamentos de hoy'
                  : 'Ya no tienes tomas pendientes hoy'}
              </h2>
              <p>{allTaken ? 'Tus confirmaciones quedaron guardadas.' : 'Consulta el historial para revisar las tomas de hoy.'}</p>
            </div>
          </div>
          <Link className="tuga-button-secondary full-width-action" to="/historial">Ver historial</Link>
        </section>
      ) : null}

      {!isLoading && occurrences.length > 0 ? (
        <section className="compact-section today-progress-card" aria-labelledby="daily-progress-title">
          <div className="section-heading-row">
            <h2 className="tuga-heading" id="daily-progress-title">Tu progreso de hoy</h2>
            <strong className="today-progress-count">{progress.completed} de {progress.total}</strong>
          </div>
          <progress aria-labelledby="daily-progress-title" className="daily-progress" max={progress.total || 1} value={progress.completed}>{progress.percentage}%</progress>
          <p className="supporting-text today-progress-summary"><strong>{progress.percentage}%</strong> de las tomas confirmadas.</p>
        </section>
      ) : null}

      {otherOccurrences.length > 0 ? (
        <section className="compact-section today-other-card" aria-labelledby="other-intakes-title">
          <div className="section-heading-row">
            <h2 className="tuga-heading" id="other-intakes-title">Otras tomas de hoy</h2>
            <Link className="text-link inline-link" to="/historial">Ver historial</Link>
          </div>
          <div className="card-list today-intake-list">
            {otherOccurrences.map((occurrence) => (
              <article className="intake-row intake-row--linked today-intake-row" key={occurrence.id}>
                <div className="today-intake-row__details">
                  <h3 className="tuga-heading">{occurrence.medicationName}</h3>
                  <p>{formatDoseAmount(occurrence.dosageAmount)} {occurrence.dosageUnit} · {formatTodayTime(occurrence.localTime)}</p>
                </div>
                <div className="intake-row__actions today-intake-row__actions">
                  <StatusBadge status={occurrence.status} />
                  <Link className="text-link" to={`/tomas/${occurrence.id}/confirmar`}>Ver toma</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
