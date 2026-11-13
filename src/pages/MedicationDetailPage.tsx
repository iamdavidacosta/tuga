import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import {
  formatDosage,
  formatSchedule,
  formatTreatmentDates,
} from '../features/medications/medicationFormatters'
import { getMedicationViewStatus } from '../features/medications/medicationRules'
import {
  getMedication,
  suspendMedication,
} from '../features/medications/medicationsService'
import type { Medication } from '../features/medications/types'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function MedicationDetailPage() {
  const { medicationId } = useParams()
  const location = useLocation()
  const [medication, setMedication] = useState<Medication | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(medicationId))
  const [isSuspending, setIsSuspending] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    medicationId ? null : 'No encontramos este medicamento.',
  )
  const [successMessage, setSuccessMessage] = useState<string | null>(() => {
    const state = location.state as { message?: unknown } | null
    return typeof state?.message === 'string' ? state.message : null
  })
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useDocumentTitle(`${medication?.name ?? 'Medicamento'} | TUGA`)

  useEffect(() => {
    if (!medicationId) return

    let isCurrent = true
    void getMedication(medicationId)
      .then((result) => {
        if (isCurrent) setMedication(result)
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(error instanceof Error ? error.message : 'No pudimos cargar este medicamento.')
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [medicationId])

  useEffect(() => {
    if (showConfirmation) confirmButtonRef.current?.focus()
  }, [showConfirmation])

  async function confirmSuspension() {
    if (!medication || isSuspending) return

    setIsSuspending(true)
    setErrorMessage(null)

    try {
      await suspendMedication(medication.id)
      setMedication({ ...medication, status: 'paused' })
      setSuccessMessage('El tratamiento quedó suspendido. No se eliminó su historial.')
      setShowConfirmation(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos suspender el tratamiento.')
    } finally {
      setIsSuspending(false)
    }
  }

  if (isLoading) {
    return <p className="loading-message" role="status">Cargando medicamento…</p>
  }

  if (!medication) {
    return (
      <div className="screen-stack">
        <PageHeader backLabel="Volver a medicamentos" backTo="/medicamentos" title="Medicamento" />
        <section className="information-panel" role="alert">
          <h2 className="tuga-heading">No pudimos mostrar el medicamento</h2>
          <p>{errorMessage}</p>
        </section>
      </div>
    )
  }

  const viewStatus = getMedicationViewStatus(medication)

  return (
    <div className="screen-stack">
      <PageHeader backLabel="Volver a medicamentos" backTo="/medicamentos" title="Detalle del medicamento" />

      {successMessage ? <p className="success-message" role="status">{successMessage}</p> : null}
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}

      <section className="medication-detail" aria-labelledby="medication-detail-title">
        <p className="card-kicker">
          {viewStatus === 'active' ? 'Tratamiento activo' : viewStatus === 'suspended' ? 'Tratamiento suspendido' : 'Tratamiento finalizado'}
        </p>
        <h2 className="tuga-heading" id="medication-detail-title">{medication.name}</h2>
        <dl className="review-list">
          <div><dt>Dosis indicada</dt><dd>{formatDosage(medication)}</dd></div>
          <div><dt>Horario</dt><dd>{formatSchedule(medication.schedule)}</dd></div>
          <div><dt>Duración</dt><dd>{formatTreatmentDates(medication)}</dd></div>
        </dl>
        <p className="important-message">Estos datos provienen de lo que registraste de tu prescripción.</p>
      </section>

      <div className="detail-actions">
        {viewStatus !== 'finished' ? (
          <Link className="tuga-button-secondary" to={`/medicamentos/${medication.id}/editar`}>
            Editar medicamento
          </Link>
        ) : null}
        {viewStatus === 'active' ? (
          <button
            className="danger-button"
            onClick={() => setShowConfirmation(true)}
            type="button"
          >
            Suspender tratamiento
          </button>
        ) : null}
      </div>

      {showConfirmation ? (
        <section className="suspension-confirmation" aria-labelledby="suspend-title">
          <h2 className="tuga-heading" id="suspend-title">¿Suspender este tratamiento?</h2>
          <p>Dejará de aparecer como activo. Su información y su historial se conservarán.</p>
          <div className="wizard-actions">
            <button
              className="tuga-button-secondary"
              disabled={isSuspending}
              onClick={() => setShowConfirmation(false)}
              type="button"
            >
              No, regresar
            </button>
            <button
              className="danger-button"
              disabled={isSuspending}
              onClick={() => void confirmSuspension()}
              ref={confirmButtonRef}
              type="button"
            >
              {isSuspending ? 'Suspendiendo…' : 'Sí, suspender'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
