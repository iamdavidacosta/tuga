import { useState } from 'react'
import { Link } from 'react-router-dom'

import { tugaAssets } from '../assets/tugaAssets'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { TugaIcon } from '../components/TugaIcon'
import {
  formatDoseAmount,
  formatLongDate,
  formatMonth,
  getMonthDays,
  getMonthRange,
  moveMonth,
} from '../features/doses/doseRules'
import { useDoseContext } from '../features/doses/useDoseContext'
import { useDoseOccurrences } from '../features/doses/useDoseOccurrences'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function CalendarPage() {
  useDocumentTitle('Calendario | TUGA')
  const doseContext = useDoseContext()
  const [chosenMonth, setChosenMonth] = useState<string | null>(null)
  const [chosenDate, setChosenDate] = useState<string | null>(null)
  const monthDate = chosenMonth ?? doseContext.context?.today ?? '1970-01-01'
  const selectedDate = chosenDate ?? doseContext.context?.today ?? '1970-01-01'
  const range = getMonthRange(monthDate)
  const monthDays = getMonthDays(monthDate)
  const { occurrences, isLoading, errorMessage } = useDoseOccurrences(range.from, range.to, Boolean(doseContext.context))
  const selected = occurrences.filter(({ localDate }) => localDate === selectedDate)
  const firstWeekday = (new Date(`${range.from}T12:00:00Z`).getUTCDay() + 6) % 7

  const changeMonth = (amount: number) => {
    const nextMonth = moveMonth(monthDate, amount)
    setChosenMonth(nextMonth)
    setChosenDate(nextMonth)
  }

  if (!doseContext.context) {
    return (
      <div className="screen-stack">
        <PageHeader backLabel="Volver a Hoy" backTo="/hoy" title="Calendario" />
        {doseContext.isLoading
          ? <p className="loading-message" role="status">Cargando tu calendario…</p>
          : <p className="auth-error" role="alert">{doseContext.errorMessage}</p>}
      </div>
    )
  }

  return (
    <div className="screen-stack">
      <PageHeader backLabel="Volver a Hoy" backTo="/hoy" title="Calendario" />
      <section className="calendar-card" aria-labelledby="calendar-month-title">
        <div className="calendar-navigation">
          <button className="calendar-navigation__button" onClick={() => changeMonth(-1)} type="button" aria-label="Mes anterior">‹</button>
          <h2 className="tuga-heading" id="calendar-month-title">{formatMonth(monthDate)}</h2>
          <button className="calendar-navigation__button" onClick={() => changeMonth(1)} type="button" aria-label="Mes siguiente">›</button>
        </div>
        <div className="month-weekdays" aria-hidden="true">
          {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="month-grid" aria-label={`Calendario de ${formatMonth(monthDate)}`}>
          {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
          {monthDays.map((date) => {
            const dayOccurrences = occurrences.filter(({ localDate }) => localDate === date)
            const taken = dayOccurrences.filter(({ status }) => status === 'taken').length
            return (
              <button
                aria-label={`${formatLongDate(date)}. ${dayOccurrences.length} tomas, ${taken} realizadas`}
                aria-pressed={selectedDate === date}
                className="month-day"
                key={date}
                onClick={() => setChosenDate(date)}
                type="button"
              >
                <strong>{Number(date.slice(-2))}</strong>
                <span>{dayOccurrences.length ? `${taken}/${dayOccurrences.length}` : '—'}</span>
              </button>
            )
          })}
        </div>
      </section>

      {isLoading ? <p className="loading-message" role="status">Cargando el calendario…</p> : null}
      {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}

      {!isLoading && !errorMessage ? (
        <section className="compact-section" aria-live="polite">
          <h2 className="tuga-heading">{formatLongDate(selectedDate)}</h2>
          {selected.length > 0 ? (
            <div className="card-list compact-card-list">
              {selected.map((occurrence) => (
                <article className="calendar-intake-row" key={occurrence.id}>
                  <div>
                    <h3 className="tuga-heading">{occurrence.medicationName}</h3>
                    <p>{occurrence.localTime} · {formatDoseAmount(occurrence.dosageAmount)} {occurrence.dosageUnit}</p>
                  </div>
                  <div className="intake-row__actions">
                    <StatusBadge status={occurrence.status} />
                    <Link className="text-link" to={`/tomas/${occurrence.id}/confirmar`}>Ver toma</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <img src={tugaAssets.mascots.calendar} alt="TUGA sostiene un calendario de medicamentos" />
              <p className="empty-message">No hay tomas programadas para este día.</p>
            </div>
          )}
        </section>
      ) : null}
      <p className="supporting-text calendar-help"><TugaIcon name="calendar" /> Los números muestran tomas realizadas y tomas programadas.</p>
    </div>
  )
}
