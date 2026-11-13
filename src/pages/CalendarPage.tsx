import { useState } from 'react'
import { Link } from 'react-router-dom'

import { tugaAssets } from '../assets/tugaAssets'
import { TugaIcon } from '../components/TugaIcon'
import {
  formatDoseAmount,
  formatLongDate,
  formatMonth,
  getMonthDays,
  getMonthRange,
  moveMonth,
} from '../features/doses/doseRules'
import type { DoseStatus } from '../features/doses/types'
import { useDoseContext } from '../features/doses/useDoseContext'
import { useDoseOccurrences } from '../features/doses/useDoseOccurrences'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const statusLabels: Record<DoseStatus, string> = {
  taken: 'Tomado',
  pending: 'Pendiente',
  skipped: 'Omitido',
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toLocaleUpperCase('es-CO') + value.slice(1) : value
}

function formatMonthTitle(value: string): string {
  return capitalize(formatMonth(value).replace(' de ', ' '))
}

function formatSelectedDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1))
  return capitalize(new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date))
}

function formatTime(value: string): string {
  const [hoursValue = '0', minutes = '00'] = value.split(':')
  const hours = Number(hoursValue)
  const period = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${minutes} ${period}`
}

interface CalendarStatusPillProps {
  status: DoseStatus
  compact?: boolean
}

function CalendarStatusPill({ status, compact = false }: CalendarStatusPillProps) {
  return (
    <span className={`calendar-status-pill calendar-status-pill--${status}${compact ? ' calendar-status-pill--compact' : ''}`}>
      {status === 'taken' ? <TugaIcon name="taken" /> : null}
      {status === 'pending' ? <TugaIcon name="pending" /> : null}
      {status === 'skipped' ? <span className="calendar-status-pill__mark" aria-hidden="true">×</span> : null}
      <span>{statusLabels[status]}</span>
    </span>
  )
}

function CalendarHeader() {
  return (
    <header className="calendar-app-header">
      <Link aria-label="Volver a Hoy" className="calendar-app-header__button" to="/hoy">
        <span aria-hidden="true">←</span>
      </Link>
      <Link aria-label="TUGA, ir a Hoy" className="calendar-app-header__logo" to="/hoy">
        <img alt="TUGA" src={tugaAssets.logos.text} />
      </Link>
      <Link aria-label="Abrir configuración" className="calendar-app-header__button" to="/configuracion">
        <TugaIcon name="settings" />
      </Link>
    </header>
  )
}

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
  const selectedMedicationCount = new Set(selected.map(({ medicationId }) => medicationId)).size
  const firstWeekday = (new Date(`${range.from}T12:00:00Z`).getUTCDay() + 6) % 7

  const changeMonth = (amount: number) => {
    const nextMonth = moveMonth(monthDate, amount)
    setChosenMonth(nextMonth)
    setChosenDate(nextMonth)
  }

  return (
    <div className="calendar-screen">
      <CalendarHeader />

      <section className="calendar-title" aria-labelledby="calendar-page-title">
        <span className="calendar-title__icon" aria-hidden="true"><TugaIcon name="calendar" /></span>
        <h1 id="calendar-page-title">Calendario de medicamentos</h1>
      </section>

      {!doseContext.context ? (
        doseContext.isLoading
          ? <p className="loading-message" role="status">Cargando tu calendario…</p>
          : <p className="auth-error" role="alert">{doseContext.errorMessage}</p>
      ) : (
        <>
          <div className="calendar-month-selector" aria-labelledby="calendar-month-title">
            <button onClick={() => changeMonth(-1)} type="button" aria-label="Mes anterior">‹</button>
            <h2 id="calendar-month-title">{formatMonthTitle(monthDate)}</h2>
            <button onClick={() => changeMonth(1)} type="button" aria-label="Mes siguiente">›</button>
          </div>

          <section className="calendar-month-card" aria-label={`Calendario de ${formatMonthTitle(monthDate)}`}>
            <div className="calendar-weekdays" aria-hidden="true">
              {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="calendar-month-grid">
              {Array.from({ length: firstWeekday }, (_, index) => <span aria-hidden="true" key={`empty-${index}`} />)}
              {monthDays.map((date) => {
                const dayOccurrences = occurrences.filter(({ localDate }) => localDate === date)
                const taken = dayOccurrences.filter(({ status }) => status === 'taken').length
                const dayStatus = dayOccurrences.some(({ status }) => status === 'skipped')
                  ? 'skipped'
                  : dayOccurrences.some(({ status }) => status === 'pending')
                    ? 'pending'
                    : dayOccurrences.length > 0
                      ? 'taken'
                      : 'empty'

                return (
                  <button
                    aria-label={`${formatLongDate(date)}. ${dayOccurrences.length} tomas, ${taken} realizadas`}
                    aria-pressed={selectedDate === date}
                    className={`calendar-day calendar-day--${dayStatus}`}
                    key={date}
                    onClick={() => setChosenDate(date)}
                    type="button"
                  >
                    <strong>{Number(date.slice(-2))}</strong>
                    {dayStatus === 'taken' ? <TugaIcon name="taken" /> : null}
                    {dayStatus === 'pending' ? <TugaIcon name="pending" /> : null}
                    {dayStatus === 'skipped' ? <span className="calendar-day__mark" aria-hidden="true">×</span> : null}
                    <span className="visually-hidden">
                      {dayOccurrences.length ? `${taken} de ${dayOccurrences.length} tomadas` : 'Sin tomas'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <div className="calendar-status-legend" aria-label="Estados del calendario">
            <CalendarStatusPill status="taken" />
            <CalendarStatusPill status="pending" />
            <CalendarStatusPill status="skipped" />
          </div>

          {isLoading ? <p className="loading-message" role="status">Cargando el calendario…</p> : null}
          {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}

          {!isLoading && !errorMessage ? (
            <section className="calendar-day-detail" aria-live="polite">
              <header className="calendar-day-detail__header">
                <TugaIcon name="calendar" />
                <h2>{formatSelectedDate(selectedDate)}</h2>
                <span className="calendar-day-detail__count">
                  {selectedMedicationCount} {selectedMedicationCount === 1 ? 'medicamento' : 'medicamentos'}
                </span>
              </header>

              {selected.length > 0 ? (
                <div className="calendar-dose-list">
                  {selected.map((occurrence) => (
                    <Link
                      aria-label={`Ver toma de ${occurrence.medicationName} a las ${formatTime(occurrence.localTime)}`}
                      className={`calendar-dose-row calendar-dose-row--${occurrence.status}`}
                      key={occurrence.id}
                      to={`/tomas/${occurrence.id}/confirmar`}
                    >
                      <span className="calendar-dose-row__icon" aria-hidden="true">
                        <TugaIcon name="medication" />
                      </span>
                      <span className="calendar-dose-row__medicine">
                        <strong>{occurrence.medicationName}</strong>
                        <span>{formatDoseAmount(occurrence.dosageAmount)} {occurrence.dosageUnit}</span>
                      </span>
                      <span className="calendar-dose-row__meta">
                        <span className="calendar-dose-row__time"><TugaIcon name="clock" />{formatTime(occurrence.localTime)}</span>
                        <CalendarStatusPill compact status={occurrence.status} />
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="calendar-empty-day">
                  <img src={tugaAssets.mascots.calendar} alt="Tuga sostiene un calendario de medicamentos" />
                  <div>
                    <h3>No hay tomas para este día</h3>
                    <p>No tienes medicamentos programados en esta fecha.</p>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
