import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { TugaIcon } from '../components/TugaIcon'
import {
  formatDosage,
  formatSchedule,
  formatTreatmentDates,
} from '../features/medications/medicationFormatters'
import { getMedicationViewStatus } from '../features/medications/medicationRules'
import { listMedications } from '../features/medications/medicationsService'
import type { Medication } from '../features/medications/types'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

type MedicationView = 'active' | 'finished'

export function MedicationsPage() {
  useDocumentTitle('Mis medicamentos | TUGA')
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

  const visibleMedications = useMemo(
    () => medications.filter((medication) => {
      const status = getMedicationViewStatus(medication)
      return view === 'active' ? status === 'active' : status !== 'active'
    }),
    [medications, view],
  )

  return (
    <div className="screen-stack">
      <PageHeader backLabel="Volver a Hoy" backTo="/hoy" title="Mis medicamentos" />
      <Link className="tuga-button-primary full-width-action" to="/medicamentos/agregar">
        <TugaIcon name="add" />
        Agregar medicamento
      </Link>

      <div className="segmented-control" aria-label="Filtrar tratamientos">
        <button
          aria-pressed={view === 'active'}
          onClick={() => setView('active')}
          type="button"
        >
          Activos
        </button>
        <button
          aria-pressed={view === 'finished'}
          onClick={() => setView('finished')}
          type="button"
        >
          Finalizados
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
        <section className="information-panel empty-state">
          <TugaIcon name="medication" className="empty-state__icon" />
          <h2 className="tuga-heading">
            {view === 'active' ? 'No tienes tratamientos activos' : 'No tienes tratamientos finalizados'}
          </h2>
          <p className="supporting-text">
            {view === 'active'
              ? 'Agrega un medicamento siguiendo los datos de tu prescripción.'
              : 'Aquí aparecerán los tratamientos terminados o suspendidos.'}
          </p>
        </section>
      ) : null}

      {!isLoading && !errorMessage && visibleMedications.length > 0 ? (
        <section className="card-list" aria-label={view === 'active' ? 'Tratamientos activos' : 'Tratamientos finalizados'}>
          {visibleMedications.map((medication) => {
            const status = getMedicationViewStatus(medication)
            return (
              <Link
                className="medication-card medication-card--link"
                key={medication.id}
                to={`/medicamentos/${medication.id}`}
              >
                <span className="icon-tile"><TugaIcon name="medication" /></span>
                <span className="medication-card__body">
                  <span className="card-kicker">
                    {status === 'active' ? 'Tratamiento activo' : status === 'suspended' ? 'Tratamiento suspendido' : 'Tratamiento finalizado'}
                  </span>
                  <strong className="medication-card__title">{medication.name}</strong>
                  <span>{formatDosage(medication)}</span>
                  <span className="supporting-text">{formatSchedule(medication.schedule)}</span>
                  <span className="supporting-text">{formatTreatmentDates(medication)}</span>
                </span>
                <span aria-hidden="true" className="card-chevron">›</span>
              </Link>
            )
          })}
        </section>
      ) : null}
    </div>
  )
}
