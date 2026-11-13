import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { tugaAssets } from '../assets/tugaAssets'
import { TugaIcon } from '../components/TugaIcon'
import { formatDosage } from '../features/medications/medicationFormatters'
import { getMedicationViewStatus } from '../features/medications/medicationRules'
import { listMedications } from '../features/medications/medicationsService'
import type { Medication, MedicationSchedule } from '../features/medications/types'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

type MedicationView = 'active' | 'finished'

function formatFrequency(schedule: MedicationSchedule | null): string {
  if (!schedule) return 'sin frecuencia disponible'
  if (schedule.type === 'interval' && schedule.intervalHours) {
    return `cada ${schedule.intervalHours} horas`
  }
  if (schedule.frequencyKind === 'every_two_days') return 'cada 2 días'
  if (schedule.frequencyKind === 'weekly') return 'cada semana'
  if (schedule.frequencyKind === 'custom' && schedule.intervalDays) {
    return `cada ${schedule.intervalDays} días`
  }
  return 'todos los días'
}

function formatTime(value: string | undefined): string {
  if (!value) return 'Sin horario'

  const [hoursValue = '0', minutes = '00'] = value.split(':')
  const hours = Number(hoursValue)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes} ${period}`
}

export function MedicationsPage() {
  useDocumentTitle('Medicamentos | TUGA')
  const [medications, setMedications] = useState<Medication[]>([])
  const [view, setView] = useState<MedicationView>('active')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadMedications = useCallback(async () => {
    try {
      setMedications(await listMedications())
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos cargar tus medicamentos.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isCurrent = true

    void listMedications()
      .then((result) => {
        if (isCurrent) setMedications(result)
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'No pudimos cargar tus medicamentos.',
          )
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const medicationGroups = useMemo(() => {
    const active: Medication[] = []
    const finished: Medication[] = []

    medications.forEach((medication) => {
      if (getMedicationViewStatus(medication) === 'active') active.push(medication)
      else finished.push(medication)
    })

    return { active, finished }
  }, [medications])

  const visibleMedications = view === 'active'
    ? medicationGroups.active
    : medicationGroups.finished

  return (
    <div className="medications-screen">
      <header className="medications-header">
        <Link aria-label="Volver a Hoy" className="medications-header__button" to="/hoy">
          <span aria-hidden="true">←</span>
        </Link>
        <Link aria-label="TUGA, ir a Hoy" className="medications-header__logo" to="/hoy">
          <img alt="TUGA" src={tugaAssets.logos.text} />
        </Link>
        <Link aria-label="Abrir configuración" className="medications-header__button" to="/configuracion">
          <TugaIcon name="settings" />
        </Link>
      </header>

      <section className="medications-intro" aria-labelledby="medications-title">
        <h1 id="medications-title">
          <span className="medications-intro__icon" aria-hidden="true"><TugaIcon name="medication" /></span>
          Medicamentos
        </h1>
        <p>Aquí puedes ver tus tratamientos activos y los que ya completaste.</p>
      </section>

      <div className="medications-tabs" aria-label="Filtrar tratamientos" role="group">
        <button
          aria-pressed={view === 'active'}
          onClick={() => setView('active')}
          type="button"
        >
          Tratamientos activos ({medicationGroups.active.length})
        </button>
        <button
          aria-pressed={view === 'finished'}
          onClick={() => setView('finished')}
          type="button"
        >
          Finalizados ({medicationGroups.finished.length})
        </button>
      </div>

      {isLoading ? <p className="loading-message" role="status">Cargando medicamentos…</p> : null}

      {errorMessage ? (
        <section className="information-panel" role="alert">
          <h2 className="tuga-heading">No pudimos cargar tus medicamentos</h2>
          <p>{errorMessage}</p>
          <button
            className="tuga-button-secondary"
            onClick={() => {
              setIsLoading(true)
              setErrorMessage(null)
              void loadMedications()
            }}
            type="button"
          >
            Intentar de nuevo
          </button>
        </section>
      ) : null}

      {!isLoading && !errorMessage && visibleMedications.length === 0 ? (
        <section className="information-panel medications-empty-state">
          <TugaIcon name="medication" />
          <h2 className="tuga-heading">
            {view === 'active' ? 'No tienes tratamientos activos' : 'No tienes tratamientos finalizados'}
          </h2>
          <p>
            {view === 'active'
              ? 'Añade un medicamento siguiendo los datos de tu prescripción.'
              : 'Aquí aparecerán los tratamientos terminados o suspendidos.'}
          </p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && visibleMedications.length > 0 ? (
        <section
          className="medications-list"
          aria-label={view === 'active' ? 'Tratamientos activos' : 'Tratamientos finalizados'}
        >
          {visibleMedications.map((medication) => {
            const firstTime = medication.schedule?.localTimes.slice().sort()[0]
            return (
              <Link
                aria-label={`Ver ${medication.name}`}
                className="treatment-card"
                key={medication.id}
                to={`/medicamentos/${medication.id}`}
              >
                <span className="treatment-card__icon" aria-hidden="true">
                  <TugaIcon name="medication" />
                </span>
                <span className="treatment-card__content">
                  <strong title={medication.name}>{medication.name}</strong>
                  <span className="treatment-card__summary">
                    {formatDosage(medication)}, {formatFrequency(medication.schedule)}
                  </span>
                  <span className="treatment-card__time">
                    <TugaIcon name="clock" />
                    {formatTime(firstTime)}
                    {medication.schedule && medication.schedule.localTimes.length > 1
                      ? <small>+{medication.schedule.localTimes.length - 1}</small>
                      : null}
                  </span>
                </span>
                <span aria-hidden="true" className="treatment-card__chevron">›</span>
              </Link>
            )
          })}
        </section>
      ) : null}

      <div className="medications-add-action">
        <Link className="tuga-button-primary" to="/medicamentos/agregar">
          <TugaIcon name="add" />
          Añadir medicamento
        </Link>
      </div>
    </div>
  )
}
