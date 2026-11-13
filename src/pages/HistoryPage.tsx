import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import {
  formatDoseAmount,
  formatLongDate,
} from '../features/doses/doseRules'
import { useDoseContext } from '../features/doses/useDoseContext'
import { useDoseOccurrences } from '../features/doses/useDoseOccurrences'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

function formatConfirmation(value: string | null, timezone: string): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
}

export function HistoryPage() {
  useDocumentTitle('Historial | TUGA')
  const doseContext = useDoseContext()
  const [chosenDate, setChosenDate] = useState<string | null>(null)
  const selectedDate = chosenDate ?? doseContext.context?.today ?? '1970-01-01'
  const [medicationFilter, setMedicationFilter] = useState('all')
  const { occurrences, isLoading, errorMessage } = useDoseOccurrences(selectedDate, selectedDate, Boolean(doseContext.context))
  const medicationNames = [...new Set(occurrences.map(({ medicationName }) => medicationName))].sort()
  const visibleOccurrences = medicationFilter === 'all'
    ? occurrences
    : occurrences.filter(({ medicationName }) => medicationName === medicationFilter)

  if (!doseContext.context) {
    return (
      <div className="screen-stack">
        <PageHeader backLabel="Volver a Hoy" backTo="/hoy" title="Historial" />
        {doseContext.isLoading
          ? <p className="loading-message" role="status">Cargando tu historial…</p>
          : <p className="auth-error" role="alert">{doseContext.errorMessage}</p>}
      </div>
    )
  }

  return (
    <div className="screen-stack">
      <PageHeader backLabel="Volver a Hoy" backTo="/hoy" title="Historial" />
      <section className="compact-section" aria-labelledby="history-filters-title">
        <h2 className="tuga-heading" id="history-filters-title">Buscar por día y medicamento</h2>
        <label className="form-field">
          <span>Fecha</span>
          <input type="date" value={selectedDate} onChange={(event) => { setChosenDate(event.target.value); setMedicationFilter('all') }} />
        </label>
        <label className="form-field">
          <span>Medicamento</span>
          <select value={medicationFilter} onChange={(event) => setMedicationFilter(event.target.value)}>
            <option value="all">Todos los medicamentos</option>
            {medicationNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </section>

      {isLoading ? <p className="loading-message" role="status">Cargando el historial…</p> : null}
      {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}

      {!isLoading && !errorMessage ? (
        <section className="compact-section" aria-labelledby="history-day-title">
          <h2 className="tuga-heading" id="history-day-title">{formatLongDate(selectedDate)}</h2>
          {visibleOccurrences.length ? (
            <div className="history-list">
              {visibleOccurrences.map((occurrence) => (
                <article className="history-row" key={occurrence.id}>
                  <div className="history-row__heading">
                    <h3 className="tuga-heading">{occurrence.medicationName}</h3>
                    <StatusBadge status={occurrence.status} />
                  </div>
                  <p>{formatDoseAmount(occurrence.dosageAmount)} {occurrence.dosageUnit}</p>
                  <p className="supporting-text">Programada para las {occurrence.localTime}.</p>
                  {occurrence.status === 'taken' ? (
                    <p className="supporting-text">Confirmada el {formatConfirmation(occurrence.takenAt, occurrence.displayTimezone)}.</p>
                  ) : null}
                  {occurrence.status === 'pending' ? <p className="supporting-text">Continúa pendiente.</p> : null}
                  {occurrence.status === 'skipped' ? <p className="supporting-text">Marcada explícitamente como omitida.</p> : null}
                  <Link className="text-link" to={`/tomas/${occurrence.id}/confirmar`}>
                    {occurrence.status === 'pending' ? 'Registrar esta toma' : 'Revisar o corregir'}
                  </Link>
                </article>
              ))}
            </div>
          ) : <p className="empty-message">No hay tomas para esta selección.</p>}
        </section>
      ) : null}
      <p className="important-message">El historial muestra únicamente los registros de tu cuenta y las acciones que confirmaste.</p>
    </div>
  )
}
