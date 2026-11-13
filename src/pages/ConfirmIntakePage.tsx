import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { tugaAssets } from '../assets/tugaAssets'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { TugaIcon } from '../components/TugaIcon'
import { useAuth } from '../features/auth/authContext'
import { formatDoseAmount, formatLongDate } from '../features/doses/doseRules'
import {
  confirmDoseOccurrence,
  correctDoseOccurrence,
  getDoseOccurrence,
  skipDoseOccurrence,
  subscribeToDoseChanges,
} from '../features/doses/doseService'
import type { DoseOccurrence } from '../features/doses/types'
import { postponeDoseReminder } from '../features/notifications/notificationService'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

type PendingAction = 'skip' | 'correct' | null

export function ConfirmIntakePage() {
  useDocumentTitle('Confirmar toma | TUGA')
  const { intakeId } = useParams()
  const { user } = useAuth()
  const [occurrence, setOccurrence] = useState<DoseOccurrence | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBusy, setIsBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  const loadOccurrence = useCallback(async () => {
    if (!intakeId) return
    try {
      setOccurrence(await getDoseOccurrence(intakeId))
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos cargar la toma.')
    } finally {
      setIsLoading(false)
    }
  }, [intakeId])

  useEffect(() => { queueMicrotask(() => { void loadOccurrence() }) }, [loadOccurrence])
  useEffect(() => {
    if (!user) return undefined
    return subscribeToDoseChanges(user.id, () => { void loadOccurrence() })
  }, [loadOccurrence, user])

  const runAction = async (action: 'confirm' | 'skip' | 'correct') => {
    if (!occurrence || isBusy) return
    setIsBusy(true)
    setErrorMessage(null)
    try {
      if (action === 'confirm') await confirmDoseOccurrence(occurrence.id)
      if (action === 'skip') await skipDoseOccurrence(occurrence.id)
      if (action === 'correct') await correctDoseOccurrence(occurrence.id)
      setSuccessMessage(action === 'confirm'
        ? 'Toma confirmada. Guardamos la hora real de tu confirmación.'
        : action === 'skip'
          ? 'La toma quedó marcada como omitida.'
          : 'La corrección quedó guardada. La toma vuelve a estar pendiente.')
      setPendingAction(null)
      await loadOccurrence()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos guardar el cambio.')
    } finally {
      setIsBusy(false)
    }
  }

  const postponeReminder = async () => {
    if (!occurrence || isBusy) return
    setIsBusy(true)
    setErrorMessage(null)
    try {
      await postponeDoseReminder(occurrence.id)
      setSuccessMessage('Programamos otro recordatorio para dentro de 15 minutos. La toma continúa pendiente.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos posponer el recordatorio.')
    } finally {
      setIsBusy(false)
    }
  }

  if (isLoading) return <p className="loading-message" role="status">Cargando la toma…</p>

  if (!occurrence) {
    return (
      <div className="screen-stack">
        <PageHeader backTo="/hoy" title="Toma no disponible" />
        <p className="auth-error" role="alert">{errorMessage ?? 'No encontramos esta toma.'}</p>
      </div>
    )
  }

  return (
    <div className="screen-stack confirmation-screen">
      <PageHeader backLabel="Volver a Hoy" backTo="/hoy" title="Confirmar toma" />
      {successMessage ? (
        <section className="confirmation-panel confirmation-panel--success" role="status">
          <img className="confirmation-mascot" src={tugaAssets.mascots.heart} alt="TUGA abraza un corazón" />
          <p>{successMessage}</p>
        </section>
      ) : null}
      {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}

      <section className="intake-card confirmation-card confirmation-dialog" aria-labelledby="confirm-intake-title">
        <img className="confirmation-dialog__mascot" src={tugaAssets.mascots.alarmClock} alt="Tuga sostiene un reloj despertador" />
        <div className="confirmation-dialog__question">
          <h2 className="tuga-heading" id="confirm-intake-title">¿Ya te tomaste tu medicamento?</h2>
          <p>Confirma solamente cuando ya hayas tomado esta dosis.</p>
        </div>
        <div className="confirmation-medication">
          <span className="icon-tile icon-tile--large"><TugaIcon name="medication" /></span>
          <div>
            <h3 className="tuga-heading">{occurrence.medicationName}</h3>
            <p>{formatDoseAmount(occurrence.dosageAmount)} {occurrence.dosageUnit}</p>
          </div>
          <StatusBadge status={occurrence.status} />
        </div>
        <p className="supporting-text">{formatLongDate(occurrence.localDate)}</p>
        <p className="intake-time"><TugaIcon name="clock" /> <span>Hora programada <strong>{occurrence.localTime}</strong></span></p>

        {occurrence.status === 'pending' ? (
          <div className="stacked-actions full-width-action">
            <button className="tuga-button-primary full-width-action" disabled={isBusy} onClick={() => void runAction('confirm')} type="button">
              {!isBusy ? <TugaIcon name="taken" /> : null}
              {isBusy ? 'Guardando…' : 'Sí, ya lo tomé'}
            </button>
            <Link className="tuga-button-secondary full-width-action" to="/hoy"><TugaIcon name="clock" /> Todavía no</Link>
            <button className="tuga-button-secondary full-width-action" disabled={isBusy} onClick={() => void postponeReminder()} type="button">
              <TugaIcon name="postpone" /> Recordarme en 15 minutos
            </button>
            {pendingAction !== 'skip' ? (
              <button className="text-button danger-text-button" onClick={() => setPendingAction('skip')} type="button">Marcar como omitida</button>
            ) : (
              <div className="consequence-confirmation" role="group" aria-label="Confirmar toma omitida">
                <p>¿Confirmas que esta toma fue omitida? “Todavía no” no la omite.</p>
                <button className="tuga-button-secondary full-width-action" disabled={isBusy} onClick={() => void runAction('skip')} type="button">Sí, marcar como omitida</button>
                <button className="text-button" onClick={() => setPendingAction(null)} type="button">Cancelar</button>
              </div>
            )}
          </div>
        ) : (
          <div className="stacked-actions full-width-action">
            <p>{occurrence.status === 'taken' ? 'Esta toma ya fue confirmada.' : 'Esta toma está marcada como omitida.'}</p>
            {pendingAction !== 'correct' ? (
              <button className="tuga-button-secondary full-width-action" onClick={() => setPendingAction('correct')} type="button">Corregir este registro</button>
            ) : (
              <div className="consequence-confirmation" role="group" aria-label="Confirmar corrección">
                <p>La toma volverá a quedar pendiente. ¿Deseas continuar?</p>
                <button className="tuga-button-primary full-width-action" disabled={isBusy} onClick={() => void runAction('correct')} type="button">Sí, corregir</button>
                <button className="text-button" onClick={() => setPendingAction(null)} type="button">Cancelar</button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
