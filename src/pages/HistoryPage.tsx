import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { tugaAssets } from '../assets/tugaAssets'
import { TugaIcon } from '../components/TugaIcon'
import {
  addCalendarDays,
  formatDoseAmount,
  formatLongDate,
  getMonthRange,
} from '../features/doses/doseRules'
import type { DoseOccurrence, DoseStatus } from '../features/doses/types'
import { useDoseContext } from '../features/doses/useDoseContext'
import { useDoseOccurrences } from '../features/doses/useDoseOccurrences'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

type HistoryPeriod = 'today' | 'week' | 'month' | 'custom'

interface DateRange {
  from: string
  to: string
}

const statusLabels: Record<DoseStatus, string> = {
  taken: 'Tomado',
  pending: 'Pendiente',
  skipped: 'Omitido',
}

function getWeekRange(today: string): DateRange {
  const day = new Date(`${today}T12:00:00Z`).getUTCDay()
  const daysSinceMonday = (day + 6) % 7
  const from = addCalendarDays(today, -daysSinceMonday)
  return { from, to: addCalendarDays(from, 6) }
}

function getHistoryRange(
  period: HistoryPeriod,
  today: string,
  customFrom: string,
  customTo: string,
): DateRange {
  if (period === 'today') return { from: today, to: today }
  if (period === 'week') return getWeekRange(today)
  if (period === 'custom') return { from: customFrom, to: customTo }
  return getMonthRange(today)
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toLocaleUpperCase('es-CO') + value.slice(1) : value
}

function formatTime(value: string): string {
  const [hoursValue = '0', minutes = '00'] = value.split(':')
  const hours = Number(hoursValue)
  const period = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${minutes} ${period}`
}

function formatConfirmationTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(new Date(value))
}

function HistoryHeader() {
  return (
    <header className="history-app-header">
      <Link aria-label="Volver a Hoy" className="history-app-header__button" to="/hoy">
        <span aria-hidden="true">←</span>
      </Link>
      <Link aria-label="TUGA, ir a Hoy" className="history-app-header__logo" to="/hoy">
        <img alt="TUGA" src={tugaAssets.logos.text} />
      </Link>
      <Link aria-label="Abrir configuración" className="history-app-header__button" to="/configuracion">
        <TugaIcon name="settings" />
      </Link>
    </header>
  )
}

function HistoryStatusPill({ status }: { status: DoseStatus }) {
  return (
    <span className={`history-status-pill history-status-pill--${status}`}>
      {status === 'taken' ? <TugaIcon name="taken" /> : null}
      {status === 'pending' ? <TugaIcon name="pending" /> : null}
      {status === 'skipped' ? <span aria-hidden="true" className="history-status-pill__mark">×</span> : null}
      <span>{statusLabels[status]}</span>
    </span>
  )
}

function HistoryDoseRow({ occurrence }: { occurrence: DoseOccurrence }) {
  return (
    <Link
      aria-label={`Ver toma de ${occurrence.medicationName} a las ${formatTime(occurrence.localTime)}`}
      className={`history-dose-row history-dose-row--${occurrence.status}`}
      to={`/tomas/${occurrence.id}/confirmar`}
    >
      <span aria-hidden="true" className="history-dose-row__icon">
        <TugaIcon name="medication" />
      </span>
      <span className="history-dose-row__medicine">
        <strong>{occurrence.medicationName}</strong>
        <span>{formatDoseAmount(occurrence.dosageAmount)} {occurrence.dosageUnit}</span>
        {occurrence.status === 'taken' && occurrence.takenAt ? (
          <small>Confirmada a las {formatConfirmationTime(occurrence.takenAt, occurrence.displayTimezone)}</small>
        ) : null}
      </span>
      <span className="history-dose-row__meta">
        <span className="history-dose-row__time"><TugaIcon name="clock" />{formatTime(occurrence.localTime)}</span>
        <HistoryStatusPill status={occurrence.status} />
      </span>
    </Link>
  )
}

export function HistoryPage() {
  useDocumentTitle('Historial de tomas | TUGA')
  const doseContext = useDoseContext()
  const today = doseContext.context?.today ?? '1970-01-01'
  const [period, setPeriod] = useState<HistoryPeriod>('month')
  const [customFrom, setCustomFrom] = useState(today)
  const [customTo, setCustomTo] = useState(today)
  const [medicationFilter, setMedicationFilter] = useState('all')
  const range = getHistoryRange(period, today, customFrom, customTo)
  const customRangeIsValid = period !== 'custom' || range.from <= range.to
  const { occurrences, isLoading, errorMessage } = useDoseOccurrences(
    range.from,
    range.to,
    Boolean(doseContext.context) && customRangeIsValid,
  )

  const occurrencesInRange = useMemo(
    () => occurrences.filter(({ localDate }) => localDate >= range.from && localDate <= range.to),
    [occurrences, range.from, range.to],
  )
  const medications = useMemo(() => {
    const byId = new Map<string, string>()
    occurrencesInRange.forEach(({ medicationId, medicationName }) => byId.set(medicationId, medicationName))
    return [...byId.entries()].sort(([, left], [, right]) => left.localeCompare(right, 'es-CO'))
  }, [occurrencesInRange])
  const visibleOccurrences = medicationFilter === 'all'
    ? occurrencesInRange
    : occurrencesInRange.filter(({ medicationId }) => medicationId === medicationFilter)
  const totals = {
    taken: visibleOccurrences.filter(({ status }) => status === 'taken').length,
    pending: visibleOccurrences.filter(({ status }) => status === 'pending').length,
    skipped: visibleOccurrences.filter(({ status }) => status === 'skipped').length,
  }
  const groupedOccurrences = useMemo(() => {
    const groups = new Map<string, DoseOccurrence[]>()
    const sorted = [...visibleOccurrences].sort((left, right) => (
      right.localDate.localeCompare(left.localDate) || left.localTime.localeCompare(right.localTime)
    ))
    sorted.forEach((occurrence) => {
      const dateOccurrences = groups.get(occurrence.localDate) ?? []
      dateOccurrences.push(occurrence)
      groups.set(occurrence.localDate, dateOccurrences)
    })
    return [...groups.entries()]
  }, [visibleOccurrences])

  const handlePeriodChange = (nextPeriod: HistoryPeriod) => {
    setPeriod(nextPeriod)
    setMedicationFilter('all')
    if (nextPeriod === 'custom') {
      setCustomFrom(today)
      setCustomTo(today)
    }
  }

  return (
    <div className="history-screen">
      <HistoryHeader />

      <section className="history-title" aria-labelledby="history-page-title">
        <TugaIcon name="history" />
        <div>
          <h1 id="history-page-title">Historial de tomas</h1>
          <p>Aquí puedes ver el registro de tus medicamentos</p>
        </div>
      </section>

      {!doseContext.context ? (
        doseContext.isLoading
          ? <p className="loading-message" role="status">Cargando tu historial…</p>
          : <p className="auth-error" role="alert">{doseContext.errorMessage}</p>
      ) : (
        <>
          <section className="history-filters" aria-label="Filtros del historial">
            <label className="history-select">
              <span className="visually-hidden">Período</span>
              <TugaIcon name="calendar" />
              <select
                aria-label="Período"
                onChange={(event) => handlePeriodChange(event.target.value as HistoryPeriod)}
                value={period}
              >
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
            <label className="history-select">
              <span className="visually-hidden">Medicamento</span>
              <TugaIcon name="medication" />
              <select
                aria-label="Medicamento"
                onChange={(event) => setMedicationFilter(event.target.value)}
                value={medicationFilter}
              >
                <option value="all">Todos los medicamentos</option>
                {medications.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          </section>

          {period === 'custom' ? (
            <section className="history-custom-range" aria-label="Período personalizado">
              <label>
                <span>Desde</span>
                <input max={customTo} onChange={(event) => setCustomFrom(event.target.value)} type="date" value={customFrom} />
              </label>
              <label>
                <span>Hasta</span>
                <input min={customFrom} onChange={(event) => setCustomTo(event.target.value)} type="date" value={customTo} />
              </label>
              {!customRangeIsValid ? <p role="alert">La fecha final debe ser igual o posterior a la inicial.</p> : null}
            </section>
          ) : null}

          <section className="history-summary" aria-label="Resumen de tomas" aria-live="polite">
            <article className="history-summary-card history-summary-card--taken">
              <TugaIcon name="taken" />
              <strong>{totals.taken}</strong>
              <span>Tomadas</span>
            </article>
            <article className="history-summary-card history-summary-card--pending">
              <TugaIcon name="pending" />
              <strong>{totals.pending}</strong>
              <span>Pendientes</span>
            </article>
            <article className="history-summary-card history-summary-card--skipped">
              <span aria-hidden="true" className="history-summary-card__mark">×</span>
              <strong>{totals.skipped}</strong>
              <span>Omitidas</span>
            </article>
          </section>

          {isLoading ? <p className="loading-message" role="status">Cargando el historial…</p> : null}
          {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}

          {!isLoading && !errorMessage && customRangeIsValid ? (
            groupedOccurrences.length > 0 ? (
              <div className="history-date-list">
                {groupedOccurrences.map(([date, dateOccurrences]) => {
                  const medicationCount = new Set(dateOccurrences.map(({ medicationId }) => medicationId)).size
                  return (
                    <section className="history-date-card" key={date} aria-labelledby={`history-date-${date}`}>
                      <header className="history-date-card__header">
                        <TugaIcon name="calendar" />
                        <h2 id={`history-date-${date}`}>{capitalize(formatLongDate(date))}</h2>
                        <span>{medicationCount} {medicationCount === 1 ? 'medicamento' : 'medicamentos'}</span>
                      </header>
                      <div className="history-dose-list">
                        {dateOccurrences.map((occurrence) => <HistoryDoseRow key={occurrence.id} occurrence={occurrence} />)}
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : (
              <section className="history-empty-state">
                <TugaIcon name="history" />
                <div>
                  <h2>No hay tomas en este período</h2>
                  <p>Prueba con otro período o medicamento.</p>
                </div>
              </section>
            )
          ) : null}
        </>
      )}
    </div>
  )
}
