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
  formatLongDate,
} from '../features/doses/doseRules'
import { useDoseContext } from '../features/doses/useDoseContext'
import { useDoseOccurrences } from '../features/doses/useDoseOccurrences'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function TodayPage() {
  useDocumentTitle('Hoy | TUGA')
  const { user } = useAuth()
  const doseContext = useDoseContext()
  const today = doseContext.context?.today ?? '1970-01-01'
  const { occurrences, isLoading, errorMessage } = useDoseOccurrences(today, today, Boolean(doseContext.context))
  const [pendingMessage, setPendingMessage] = useState('')
  const nextOccurrence = findNextPending(occurrences)
  const progress = calculateDailyProgress(occurrences)
  const otherOccurrences = occurrences.filter(({ id }) => id !== nextOccurrence?.id)
  const metadataName = user?.user_metadata.full_name ?? user?.user_metadata.name
  const firstName = typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim().split(/\s+/)[0]
    : ''

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
        <div>
          <p className="page-eyebrow">{formatLongDate(today)}</p>
          <h1 className="tuga-heading" id="today-title">Hola{firstName ? `, ${firstName}` : ''}</h1>
          <p>Aquí tienes tu próxima toma.</p>
        </div>
        <img src={tugaAssets.mascots.heart} alt="TUGA te acompaña hoy" />
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
        <section className="intake-card intake-card--primary today-next-card" aria-labelledby="next-intake-title">
          <div className="today-next-card__heading">
            <TugaIcon name="medication" />
            <span>Próximo medicamento</span>
          </div>
          <div className="today-next-card__body">
            <div className="medication-summary medication-summary--featured">
              <span className="icon-tile icon-tile--large"><TugaIcon name="medication" /></span>
              <div>
                <h2 className="tuga-heading" id="next-intake-title">{nextOccurrence.medicationName}</h2>
                <p className="dose-pill">{formatDoseAmount(nextOccurrence.dosageAmount)} {nextOccurrence.dosageUnit}</p>
              </div>
            </div>
            <p className="intake-time intake-time--featured">
              <TugaIcon name="clock" />
              <span>Hora programada <strong>{nextOccurrence.localTime}</strong></span>
            </p>
            <StatusBadge status={nextOccurrence.status} />
          </div>
          <div className="stacked-actions">
            <Link className="tuga-button-primary full-width-action" to={`/tomas/${nextOccurrence.id}/confirmar`}>
              <TugaIcon name="taken" /> Sí, ya lo tomé
            </Link>
            <button
              className="tuga-button-secondary full-width-action"
              onClick={() => setPendingMessage('La toma continúa pendiente. No se guardó ningún cambio.')}
              type="button"
            ><TugaIcon name="postpone" /> Todavía no</button>
          </div>
          <p className="action-feedback" aria-live="polite">{pendingMessage}</p>
        </section>
      ) : null}

      {!isLoading && occurrences.length > 0 ? (
        <section className="compact-section" aria-labelledby="daily-progress-title">
          <div className="section-heading-row">
            <h2 className="tuga-heading" id="daily-progress-title">Progreso de hoy</h2>
            <strong>{progress.completed} de {progress.total}</strong>
          </div>
          <progress className="daily-progress" max={progress.total || 1} value={progress.completed}>{progress.percentage}%</progress>
          <p className="supporting-text">{progress.percentage}% de las tomas confirmadas.</p>
        </section>
      ) : null}

      {otherOccurrences.length > 0 ? (
        <section className="compact-section" aria-labelledby="other-intakes-title">
          <div className="section-heading-row">
            <h2 className="tuga-heading" id="other-intakes-title">Otras tomas de hoy</h2>
            <Link className="text-link inline-link" to="/historial">Ver historial</Link>
          </div>
          <div className="card-list">
            {otherOccurrences.map((occurrence) => (
              <article className="intake-row intake-row--linked" key={occurrence.id}>
                <div>
                  <h3 className="tuga-heading">{occurrence.medicationName}</h3>
                  <p>{formatDoseAmount(occurrence.dosageAmount)} {occurrence.dosageUnit} · {occurrence.localTime}</p>
                </div>
                <div className="intake-row__actions">
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
