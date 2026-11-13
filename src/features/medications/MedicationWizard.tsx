import { type FormEvent, useRef, useState } from 'react'

import { TugaIcon } from '../../components/TugaIcon'
import type { TugaIconName } from '../../assets/tugaAssets'
import {
  calculateEndDate,
  normalizeMedicationDraft,
  validateMedicationStep,
} from './medicationRules'
import type { DurationKind, MedicationDraft } from './types'

const stepNames = [
  'Nombre',
  'Dosis',
  'Horarios',
  'Inicio',
  'Duración',
  'Revisar',
] as const

const stepIcons = [
  'medication',
  'medication',
  'clock',
  'calendar',
  'calendar',
  'taken',
] as const satisfies readonly TugaIconName[]

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5

interface MedicationWizardProps {
  initialDraft: MedicationDraft
  onSave: (draft: MedicationDraft) => Promise<void>
  submitLabel: string
}

interface WizardLegendProps {
  icon: TugaIconName
  children: string
}

function WizardLegend({ icon, children }: WizardLegendProps) {
  return (
    <legend className="wizard-legend tuga-heading">
      <span className="wizard-legend__icon" aria-hidden="true"><TugaIcon name={icon} /></span>
      <span>{children}</span>
    </legend>
  )
}

function cloneDraft(draft: MedicationDraft): MedicationDraft {
  return {
    ...draft,
    schedule: draft.schedule.kind === 'fixed'
      ? { ...draft.schedule, times: [...draft.schedule.times] }
      : { ...draft.schedule },
    duration: { ...draft.duration },
  }
}

export function MedicationWizard({
  initialDraft,
  onSave,
  submitLabel,
}: MedicationWizardProps) {
  const [step, setStep] = useState<WizardStep>(0)
  const [draft, setDraft] = useState(() => cloneDraft(initialDraft))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const submissionLocked = useRef(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    if (step < 5) {
      const validationError = validateMedicationStep(draft, step)
      if (validationError) {
        setErrorMessage(validationError)
        return
      }

      setStep((step + 1) as WizardStep)
      return
    }

    if (submissionLocked.current) return

    try {
      normalizeMedicationDraft(draft)
      submissionLocked.current = true
      setIsSaving(true)
      await onSave(draft)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'No pudimos guardar el medicamento. Inténtalo nuevamente.',
      )
      submissionLocked.current = false
      setIsSaving(false)
    }
  }

  function goBack() {
    setErrorMessage(null)
    setStep((step - 1) as WizardStep)
  }

  function updateFixedTime(index: number, value: string) {
    if (draft.schedule.kind !== 'fixed') return

    const times = [...draft.schedule.times]
    times[index] = value
    setDraft({ ...draft, schedule: { ...draft.schedule, times } })
  }

  function removeFixedTime(index: number) {
    if (draft.schedule.kind !== 'fixed' || draft.schedule.times.length === 1) return

    setDraft({
      ...draft,
      schedule: {
        ...draft.schedule,
        times: draft.schedule.times.filter((_, timeIndex) => timeIndex !== index),
      },
    })
  }

  function addFixedTime() {
    if (draft.schedule.kind !== 'fixed') return

    setDraft({
      ...draft,
      schedule: {
        kind: 'fixed',
        times: [...draft.schedule.times, ''],
      },
    })
  }

  function updateInterval(
    field: 'firstTime' | 'intervalHours',
    value: string,
  ) {
    if (draft.schedule.kind !== 'interval') return

    setDraft({
      ...draft,
      schedule: { ...draft.schedule, [field]: value },
    })
  }

  const endDate = step === 5
    ? calculateEndDate(draft.startDate, draft.duration)
    : null
  const fixedTimeCount = draft.schedule.kind === 'fixed'
    ? draft.schedule.times.length
    : 0

  return (
    <>
      <ol className="step-progress" aria-label="Progreso del medicamento">
        {stepNames.map((stepName, index) => (
          <li
            aria-label={`${stepName}: ${index < step ? 'completado' : index === step ? 'paso actual' : 'pendiente'}`}
            aria-current={index === step ? 'step' : undefined}
            className={index <= step ? 'is-current-or-complete' : ''}
            key={stepName}
          >
            <span aria-hidden="true">{index < step ? '✓' : index + 1}</span>
            <small>{stepName}</small>
          </li>
        ))}
      </ol>

      <form className="wizard-card" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <p className="card-kicker">Paso {step + 1} de {stepNames.length}: {stepNames[step]}</p>

        {step === 0 ? (
          <fieldset>
            <WizardLegend icon={stepIcons[0]}>¿Cómo se llama el medicamento?</WizardLegend>
            <p className="supporting-text">Cópialo como aparece en tu prescripción.</p>
            <label className="form-field" htmlFor="medication-name">
              <span>Nombre del medicamento</span>
              <input
                autoComplete="off"
                autoFocus
                id="medication-name"
                maxLength={160}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                type="text"
                value={draft.name}
              />
            </label>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset>
            <WizardLegend icon={stepIcons[1]}>¿Cuánto debes tomar?</WizardLegend>
            <p className="supporting-text">Escribe exactamente la cantidad y la unidad indicadas.</p>
            <div className="form-grid">
              <label className="form-field" htmlFor="medication-amount">
                <span>Cantidad indicada</span>
                <input
                  autoFocus
                  id="medication-amount"
                  inputMode="decimal"
                  onChange={(event) => setDraft({ ...draft, dosageAmount: event.target.value })}
                  type="text"
                  value={draft.dosageAmount}
                />
              </label>
              <label className="form-field" htmlFor="medication-unit">
                <span>Unidad indicada</span>
                <input
                  autoComplete="off"
                  id="medication-unit"
                  maxLength={50}
                  onChange={(event) => setDraft({ ...draft, dosageUnit: event.target.value })}
                  type="text"
                  value={draft.dosageUnit}
                />
              </label>
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset>
            <WizardLegend icon={stepIcons[2]}>¿A qué horas debes tomarlo?</WizardLegend>
            <p className="supporting-text">Usa horarios fijos o el intervalo escrito en tu prescripción.</p>
            <div className="schedule-kind" role="radiogroup" aria-label="Tipo de horario">
              <label>
                <input
                  checked={draft.schedule.kind === 'fixed'}
                  name="schedule-kind"
                  onChange={() => setDraft({
                    ...draft,
                    schedule: { kind: 'fixed', times: [''] },
                  })}
                  type="radio"
                />
                Horarios fijos
              </label>
              <label>
                <input
                  checked={draft.schedule.kind === 'interval'}
                  name="schedule-kind"
                  onChange={() => setDraft({
                    ...draft,
                    schedule: { kind: 'interval', firstTime: '', intervalHours: '' },
                  })}
                  type="radio"
                />
                Intervalo en horas
              </label>
            </div>

            {draft.schedule.kind === 'fixed' ? (
              <div className="time-list">
                {[...draft.schedule.times].map((time, index) => (
                  <div className="time-row" key={`time-${index}`}>
                    <label className="form-field" htmlFor={`medication-time-${index}`}>
                      <span>Hora {index + 1}</span>
                      <input
                        id={`medication-time-${index}`}
                        onChange={(event) => updateFixedTime(index, event.target.value)}
                        type="time"
                        value={time}
                      />
                    </label>
                    {fixedTimeCount > 1 ? (
                      <button
                        aria-label={`Quitar hora ${index + 1}`}
                        className="tuga-button-secondary compact-button"
                        onClick={() => removeFixedTime(index)}
                        type="button"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                ))}
                {fixedTimeCount < 24 ? (
                  <button
                    className="tuga-button-secondary"
                    onClick={addFixedTime}
                    type="button"
                  >
                    Agregar otra hora
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="form-grid">
                <label className="form-field" htmlFor="interval-hours">
                  <span>Cada cuántas horas</span>
                  <input
                    id="interval-hours"
                    inputMode="numeric"
                    max={23}
                    min={1}
                    onChange={(event) => updateInterval('intervalHours', event.target.value)}
                    type="number"
                    value={draft.schedule.intervalHours}
                  />
                </label>
                <label className="form-field" htmlFor="interval-first-time">
                  <span>Primera hora indicada</span>
                  <input
                    id="interval-first-time"
                    onChange={(event) => updateInterval('firstTime', event.target.value)}
                    type="time"
                    value={draft.schedule.firstTime}
                  />
                </label>
              </div>
            )}
          </fieldset>
        ) : null}

        {step === 3 ? (
          <fieldset>
            <WizardLegend icon={stepIcons[3]}>¿Cuándo comienza?</WizardLegend>
            <label className="form-field" htmlFor="medication-start-date">
              <span>Fecha inicial indicada</span>
              <input
                autoFocus
                id="medication-start-date"
                onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                type="date"
                value={draft.startDate}
              />
            </label>
            <p className="important-message">La fecha inicial cuenta como el primer día del tratamiento.</p>
          </fieldset>
        ) : null}

        {step === 4 ? (
          <fieldset>
            <WizardLegend icon={stepIcons[4]}>¿Durante cuánto tiempo?</WizardLegend>
            <p className="supporting-text">Copia la duración indicada en tu prescripción.</p>
            <div className="form-grid">
              <label className="form-field" htmlFor="duration-kind">
                <span>Tipo de duración</span>
                <select
                  id="duration-kind"
                  onChange={(event) => setDraft({
                    ...draft,
                    duration: {
                      kind: event.target.value as DurationKind,
                      amount: event.target.value === 'indefinite' ? '' : draft.duration.amount,
                    },
                  })}
                  value={draft.duration.kind}
                >
                  <option value="days">Días</option>
                  <option value="weeks">Semanas</option>
                  <option value="months">Meses calendario</option>
                  <option value="indefinite">Sin fecha final indicada</option>
                </select>
              </label>
              {draft.duration.kind !== 'indefinite' ? (
                <label className="form-field" htmlFor="duration-amount">
                  <span>Cantidad de {draft.duration.kind === 'days' ? 'días' : draft.duration.kind === 'weeks' ? 'semanas' : 'meses'}</span>
                  <input
                    id="duration-amount"
                    inputMode="numeric"
                    min={1}
                    onChange={(event) => setDraft({
                      ...draft,
                      duration: { ...draft.duration, amount: event.target.value },
                    })}
                    type="number"
                    value={draft.duration.amount}
                  />
                </label>
              ) : null}
            </div>
            <p className="important-message">La fecha inicial y la fecha final se incluyen. Los meses se calculan como meses calendario, no como grupos de 30 días.</p>
          </fieldset>
        ) : null}

        {step === 5 ? (
          <fieldset>
            <WizardLegend icon={stepIcons[5]}>Revisar y guardar</WizardLegend>
            <dl className="review-list">
              <div><dt>Medicamento</dt><dd>{draft.name.trim()}</dd></div>
              <div><dt>Dosis indicada</dt><dd>{draft.dosageAmount} {draft.dosageUnit.trim()}</dd></div>
              <div>
                <dt>Horario</dt>
                <dd>
                  {draft.schedule.kind === 'fixed'
                    ? draft.schedule.times.slice().sort().join(', ')
                    : `Cada ${draft.schedule.intervalHours} horas desde las ${draft.schedule.firstTime}`}
                </dd>
              </div>
              <div><dt>Fecha inicial</dt><dd>{draft.startDate}</dd></div>
              <div><dt>Fecha final</dt><dd>{endDate ?? 'Sin fecha final indicada'}</dd></div>
            </dl>
            <p className="important-message">TUGA guardará lo que copiaste de tu prescripción. No modifica ni recomienda el tratamiento.</p>
          </fieldset>
        ) : null}

        {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}

        <div className="wizard-actions">
          {step > 0 ? (
            <button
              className="tuga-button-secondary"
              disabled={isSaving}
              onClick={goBack}
              type="button"
            >
              Paso anterior
            </button>
          ) : null}
          <button className="tuga-button-primary" disabled={isSaving} type="submit">
            {isSaving
              ? 'Guardando…'
              : step === 5
                ? submitLabel
                : <>Continuar <span aria-hidden="true">→</span></>}
          </button>
        </div>
      </form>
    </>
  )
}
