import { type FormEvent, useRef, useState } from 'react'

import type { ReactNode } from 'react'

import { tugaAssets } from '../../assets/tugaAssets'
import { TugaIcon } from '../../components/TugaIcon'
import {
  calculateEndDate,
  getTodayDate,
  normalizeMedicationDraft,
  validateMedicationStep,
} from './medicationRules'
import type {
  DurationKind,
  FrequencyKind,
  MedicationDraft,
} from './types'

const stepNames = ['Nombre', 'Dosis', 'Frecuencia', 'Horarios', 'Inicio', 'Duración'] as const
const standardUnits = [
  'tableta',
  'cápsula',
  'mililitro',
  'gota',
  'sobre',
  'aplicación',
  'inhalación',
] as const

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5

interface MedicationWizardProps {
  initialDraft: MedicationDraft
  onClose: () => void
  onSave: (draft: MedicationDraft) => Promise<void>
  startWithIntro?: boolean
  submitLabel: string
}

function cloneDraft(draft: MedicationDraft): MedicationDraft {
  return {
    ...draft,
    frequency: { ...draft.frequency },
    schedule: draft.schedule.kind === 'fixed'
      ? { ...draft.schedule, times: [...draft.schedule.times] }
      : { ...draft.schedule },
    duration: { ...draft.duration },
    startDate: draft.startDate || getTodayDate(),
  }
}

function formatFrequency(draft: MedicationDraft): string {
  if (draft.frequency.kind === 'daily') return 'Todos los días'
  if (draft.frequency.kind === 'every_two_days') return 'Cada 2 días'
  if (draft.frequency.kind === 'weekly') return 'Cada semana'
  return `Cada ${draft.frequency.intervalDays || '—'} días`
}

function formatSchedule(draft: MedicationDraft): string {
  if (draft.schedule.kind === 'fixed') {
    return draft.schedule.times.filter(Boolean).slice().sort().join(', ') || 'Sin horarios'
  }
  return `Cada ${draft.schedule.intervalHours || '—'} horas desde las ${draft.schedule.firstTime || '—'}`
}

function formatDuration(draft: MedicationDraft): string {
  if (draft.duration.kind === 'indefinite') return 'De forma continua'
  if (draft.duration.kind === 'end_date') return `Hasta ${draft.duration.endDate || '—'}`

  const labels = {
    days: 'días',
    weeks: 'semanas',
    months: 'meses calendario',
  } as const
  return `${draft.duration.amount || '—'} ${labels[draft.duration.kind]}`
}

interface WizardHeaderProps {
  onBack: () => void
  onClose: () => void
}

function WizardHeader({ onBack, onClose }: WizardHeaderProps) {
  return (
    <header className="medication-wizard-header">
      <button
        aria-label="Regresar"
        className="wizard-header-button"
        onClick={onBack}
        type="button"
      >
        <span aria-hidden="true">←</span>
      </button>
      <img alt="TUGA" className="medication-wizard-logo" src={tugaAssets.logos.text} />
      <button
        aria-label="Cerrar el formulario"
        className="wizard-header-button"
        onClick={onClose}
        type="button"
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>
  )
}

interface StepTitleProps {
  icon: 'medication' | 'calendar' | 'clock' | 'pending'
  step: WizardStep
  children: ReactNode
}

function StepTitle({ icon, step, children }: StepTitleProps) {
  return (
    <div className="wizard-step-title">
      <span className="wizard-step-title__icon" aria-hidden="true"><TugaIcon name={icon} /></span>
      <div>
        <p>Paso {step + 1} de 6</p>
        <h1>{children}</h1>
      </div>
    </div>
  )
}

export function MedicationWizard({
  initialDraft,
  onClose,
  onSave,
  startWithIntro = true,
  submitLabel,
}: MedicationWizardProps) {
  const [showsIntro, setShowsIntro] = useState(startWithIntro)
  const [step, setStep] = useState<WizardStep>(0)
  const [draft, setDraft] = useState(() => cloneDraft(initialDraft))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [usesCustomUnit, setUsesCustomUnit] = useState(
    Boolean(initialDraft.dosageUnit) && !standardUnits.includes(initialDraft.dosageUnit as typeof standardUnits[number]),
  )
  const submissionLocked = useRef(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  function moveToStep(nextStep: WizardStep) {
    setErrorMessage(null)
    setStep(nextStep)
    requestAnimationFrame(() => {
      const scrollArea = scrollAreaRef.current
      if (!scrollArea) return
      if (typeof scrollArea.scrollTo === 'function') scrollArea.scrollTo({ top: 0 })
      else scrollArea.scrollTop = 0
    })
  }

  function handleBack() {
    if (showsIntro) {
      onClose()
      return
    }
    if (step === 0) {
      if (startWithIntro) setShowsIntro(true)
      else onClose()
      return
    }
    moveToStep((step - 1) as WizardStep)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    const validationError = validateMedicationStep(draft, step)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    if (step < 5) {
      moveToStep((step + 1) as WizardStep)
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

  function adjustDose(change: number) {
    const currentValue = Number(draft.dosageAmount.replace(',', '.'))
    const nextValue = Math.max(0.5, (Number.isFinite(currentValue) ? currentValue : 0) + change)
    setDraft({ ...draft, dosageAmount: String(Number(nextValue.toFixed(3))) })
  }

  function selectFrequency(kind: FrequencyKind) {
    setDraft({
      ...draft,
      frequency: {
        kind,
        intervalDays: kind === 'daily'
          ? '1'
          : kind === 'every_two_days'
            ? '2'
            : kind === 'weekly'
              ? '7'
              : draft.frequency.kind === 'custom'
                ? draft.frequency.intervalDays
                : '',
      },
    })
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
    if (draft.schedule.kind !== 'fixed' || draft.schedule.times.length >= 24) return
    setDraft({
      ...draft,
      schedule: { kind: 'fixed', times: [...draft.schedule.times, ''] },
    })
  }

  function updateInterval(field: 'intervalHours' | 'firstTime', value: string) {
    if (draft.schedule.kind !== 'interval') return
    setDraft({
      ...draft,
      schedule: { ...draft.schedule, [field]: value },
    })
  }

  function updateDurationKind(kind: DurationKind) {
    setDraft({
      ...draft,
      duration: {
        kind,
        amount: kind === 'indefinite' || kind === 'end_date' ? '' : draft.duration.amount,
        endDate: kind === 'end_date' ? draft.duration.endDate : '',
      },
    })
  }

  const endDate = step === 5 && validateMedicationStep(draft, 5) === null
    ? calculateEndDate(draft.startDate, draft.duration)
    : null

  return (
    <section className="medication-wizard-page" aria-label="Agregar medicamento">
      <WizardHeader onBack={handleBack} onClose={onClose} />

      {showsIntro ? (
        <div className="medication-wizard-intro">
          <div className="medication-wizard-intro__content">
            <img
              alt="Tuga sostiene una cápsula"
              className="medication-wizard-intro__mascot"
              src={tugaAssets.mascots.capsule}
            />
            <h1>Añadir <br />un medicamento</h1>
            <p>Te guiaremos paso a paso<br />para registrarlo en TUGA.</p>
          </div>
          <div className="medication-wizard-footer">
            <button
              className="tuga-button-primary wizard-main-action"
              onClick={() => setShowsIntro(false)}
              type="button"
            >
              Comenzar <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <ol className="wizard-progress" aria-label="Progreso del medicamento">
            {stepNames.map((stepName, index) => (
              <li
                aria-current={index === step ? 'step' : undefined}
                aria-label={`${stepName}: ${index < step ? 'completado' : index === step ? 'paso actual' : 'pendiente'}`}
                className={index < step ? 'is-complete' : index === step ? 'is-current' : ''}
                key={stepName}
              >
                <span aria-hidden="true">{index < step ? '✓' : index + 1}</span>
              </li>
            ))}
          </ol>

          <form className="medication-wizard-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
            <div className="medication-wizard-scroll" ref={scrollAreaRef}>
              {step === 0 ? (
                <fieldset className="wizard-step-panel">
                  <legend className="visually-hidden">Nombre del medicamento</legend>
                  <StepTitle icon="medication" step={step}>¿Cómo se llama <br />el medicamento?</StepTitle>
                  <label className="wizard-field" htmlFor="medication-name">
                    <span className="visually-hidden">Nombre del medicamento</span>
                    <input
                      aria-describedby="medication-name-help"
                      aria-invalid={Boolean(errorMessage)}
                      autoComplete="off"
                      id="medication-name"
                      maxLength={160}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      placeholder="Ejemplo: Losartán"
                      type="text"
                      value={draft.name}
                    />
                  </label>
                  <p className="wizard-help" id="medication-name-help">
                    Puedes escribir el nombre tal como aparece en la caja.
                  </p>
                  {errorMessage ? <p className="wizard-error" role="alert">{errorMessage}</p> : null}
                </fieldset>
              ) : null}

              {step === 1 ? (
                <fieldset className="wizard-step-panel">
                  <legend className="visually-hidden">Dosis</legend>
                  <StepTitle icon="medication" step={step}>¿Cuál es la dosis?</StepTitle>
                  <div className="dose-selector">
                    <button aria-label="Disminuir dosis" onClick={() => adjustDose(-1)} type="button">−</button>
                    <label htmlFor="medication-amount">
                      <span className="visually-hidden">Cantidad indicada</span>
                      <input
                        aria-invalid={Boolean(errorMessage)}
                        id="medication-amount"
                        inputMode="decimal"
                        onChange={(event) => setDraft({ ...draft, dosageAmount: event.target.value })}
                        placeholder="1"
                        type="text"
                        value={draft.dosageAmount}
                      />
                    </label>
                    <button aria-label="Aumentar dosis" onClick={() => adjustDose(1)} type="button">+</button>
                  </div>
                  <label className="wizard-field" htmlFor="medication-unit">
                    <span className="visually-hidden">Presentación indicada</span>
                    <select
                      id="medication-unit"
                      onChange={(event) => {
                        const isCustom = event.target.value === '__other'
                        setUsesCustomUnit(isCustom)
                        setDraft({ ...draft, dosageUnit: isCustom ? '' : event.target.value })
                      }}
                      value={usesCustomUnit ? '__other' : draft.dosageUnit}
                    >
                      <option value="">Selecciona la presentación</option>
                      {standardUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      <option value="__other">Otra presentación</option>
                    </select>
                  </label>
                  {usesCustomUnit ? (
                    <label className="wizard-field" htmlFor="medication-custom-unit">
                      <span>Escribe la presentación</span>
                      <input
                        autoComplete="off"
                        id="medication-custom-unit"
                        maxLength={50}
                        onChange={(event) => setDraft({ ...draft, dosageUnit: event.target.value })}
                        type="text"
                        value={draft.dosageUnit}
                      />
                    </label>
                  ) : null}
                  <p className="wizard-help">Registra exactamente lo indicado. TUGA no recomienda cantidades.</p>
                  {errorMessage ? <p className="wizard-error" role="alert">{errorMessage}</p> : null}
                </fieldset>
              ) : null}

              {step === 2 ? (
                <fieldset className="wizard-step-panel">
                  <legend className="visually-hidden">Frecuencia</legend>
                  <StepTitle icon="calendar" step={step}>¿Con qué frecuencia <br />lo tomas?</StepTitle>
                  <div className="wizard-choice-list">
                    {([
                      ['daily', 'Todos los días'],
                      ['every_two_days', 'Cada 2 días'],
                      ['weekly', 'Cada semana'],
                      ['custom', 'Otra frecuencia'],
                    ] as const).map(([kind, label]) => (
                      <label key={kind}>
                        <input
                          checked={draft.frequency.kind === kind}
                          name="frequency"
                          onChange={() => selectFrequency(kind)}
                          type="radio"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  {draft.frequency.kind === 'custom' ? (
                    <label className="wizard-field wizard-field--inline" htmlFor="frequency-days">
                      <span>Cada</span>
                      <input
                        id="frequency-days"
                        inputMode="numeric"
                        max={3650}
                        min={1}
                        onChange={(event) => setDraft({
                          ...draft,
                          frequency: { kind: 'custom', intervalDays: event.target.value },
                        })}
                        type="number"
                        value={draft.frequency.intervalDays}
                      />
                      <span>días</span>
                    </label>
                  ) : null}
                  {errorMessage ? <p className="wizard-error" role="alert">{errorMessage}</p> : null}
                </fieldset>
              ) : null}

              {step === 3 ? (
                <fieldset className="wizard-step-panel">
                  <legend className="visually-hidden">Horarios</legend>
                  <StepTitle icon="clock" step={step}>¿A qué horas <br />lo tomas?</StepTitle>
                  <div className="schedule-kind wizard-choice-list wizard-choice-list--two">
                    <label>
                      <input
                        checked={draft.schedule.kind === 'fixed'}
                        name="schedule-kind"
                        onChange={() => setDraft({ ...draft, schedule: { kind: 'fixed', times: [''] } })}
                        type="radio"
                      />
                      <span>Horas fijas</span>
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
                      <span>Cada cierto número de horas</span>
                    </label>
                  </div>

                  {draft.schedule.kind === 'fixed' ? (
                    <div className="wizard-time-list">
                      {draft.schedule.times.map((time, index, times) => (
                        <div className="wizard-time-row" key={`time-${index}`}>
                          <TugaIcon name="clock" />
                          <label htmlFor={`medication-time-${index}`}>
                            <span className="visually-hidden">Hora {index + 1}</span>
                            <input
                              id={`medication-time-${index}`}
                              onChange={(event) => updateFixedTime(index, event.target.value)}
                              type="time"
                              value={time}
                            />
                          </label>
                          {times.length > 1 ? (
                            <button
                              aria-label={`Quitar hora ${index + 1}`}
                              onClick={() => removeFixedTime(index)}
                              type="button"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      ))}
                      <button className="wizard-add-time" onClick={addFixedTime} type="button">
                        <span aria-hidden="true">+</span> Agregar otro horario
                      </button>
                    </div>
                  ) : (
                    <div className="wizard-interval-fields">
                      <label className="wizard-field" htmlFor="interval-hours">
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
                      <label className="wizard-field" htmlFor="interval-first-time">
                        <span>Hora inicial de referencia</span>
                        <input
                          id="interval-first-time"
                          onChange={(event) => updateInterval('firstTime', event.target.value)}
                          type="time"
                          value={draft.schedule.firstTime}
                        />
                      </label>
                      <p className="wizard-help">Usa el intervalo exacto indicado por tu médico. No equivale automáticamente a “veces al día”.</p>
                    </div>
                  )}
                  {errorMessage ? <p className="wizard-error" role="alert">{errorMessage}</p> : null}
                </fieldset>
              ) : null}

              {step === 4 ? (
                <fieldset className="wizard-step-panel">
                  <legend className="visually-hidden">Fecha de inicio</legend>
                  <StepTitle icon="calendar" step={step}>¿Cuándo empiezas <br />a tomarlo?</StepTitle>
                  <label className="wizard-date-field" htmlFor="medication-start-date">
                    <TugaIcon name="calendar" />
                    <span className="visually-hidden">Fecha inicial indicada</span>
                    <input
                      aria-invalid={Boolean(errorMessage)}
                      id="medication-start-date"
                      onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                      type="date"
                      value={draft.startDate}
                    />
                  </label>
                  <p className="wizard-help">La fecha inicial cuenta como el primer día del tratamiento.</p>
                  {errorMessage ? <p className="wizard-error" role="alert">{errorMessage}</p> : null}
                </fieldset>
              ) : null}

              {step === 5 ? (
                <fieldset className="wizard-step-panel wizard-step-panel--duration">
                  <legend className="visually-hidden">Duración</legend>
                  <StepTitle icon="pending" step={step}>¿Por cuánto tiempo <br />lo tomarás?</StepTitle>
                  <div className="wizard-choice-list">
                    <label>
                      <input
                        checked={draft.duration.kind === 'indefinite'}
                        name="duration-mode"
                        onChange={() => updateDurationKind('indefinite')}
                        type="radio"
                      />
                      <span>De forma continua <small>(sin fecha de finalización)</small></span>
                    </label>
                    <label>
                      <input
                        checked={draft.duration.kind !== 'indefinite'}
                        name="duration-mode"
                        onChange={() => updateDurationKind('days')}
                        type="radio"
                      />
                      <span>Por un tiempo específico</span>
                    </label>
                  </div>

                  {draft.duration.kind !== 'indefinite' ? (
                    <div className="wizard-duration-fields">
                      <label className="wizard-field" htmlFor="duration-kind">
                        <span>Indica la duración</span>
                        <select
                          id="duration-kind"
                          onChange={(event) => updateDurationKind(event.target.value as DurationKind)}
                          value={draft.duration.kind}
                        >
                          <option value="days">Días</option>
                          <option value="weeks">Semanas</option>
                          <option value="months">Meses calendario</option>
                          <option value="end_date">Fecha final</option>
                        </select>
                      </label>
                      {draft.duration.kind === 'end_date' ? (
                        <label className="wizard-field" htmlFor="duration-end-date">
                          <span>Fecha final</span>
                          <input
                            id="duration-end-date"
                            min={draft.startDate}
                            onChange={(event) => setDraft({
                              ...draft,
                              duration: { ...draft.duration, endDate: event.target.value },
                            })}
                            type="date"
                            value={draft.duration.endDate}
                          />
                        </label>
                      ) : (
                        <label className="wizard-field" htmlFor="duration-amount">
                          <span>Cantidad</span>
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
                      )}
                    </div>
                  ) : null}

                  <section className="wizard-summary" aria-labelledby="wizard-summary-title">
                    <h2 id="wizard-summary-title">Revisa antes de guardar</h2>
                    <dl>
                      <div><dt>Medicamento</dt><dd>{draft.name.trim()}</dd></div>
                      <div><dt>Dosis</dt><dd>{draft.dosageAmount} {draft.dosageUnit}</dd></div>
                      <div><dt>Frecuencia</dt><dd>{formatFrequency(draft)}</dd></div>
                      <div><dt>Horarios</dt><dd>{formatSchedule(draft)}</dd></div>
                      <div><dt>Inicio</dt><dd>{draft.startDate}</dd></div>
                      <div><dt>Duración</dt><dd>{formatDuration(draft)}</dd></div>
                      {endDate ? <div><dt>Último día incluido</dt><dd>{endDate}</dd></div> : null}
                    </dl>
                  </section>
                  {errorMessage ? <p className="wizard-error" role="alert">{errorMessage}</p> : null}
                </fieldset>
              ) : null}
            </div>

            <div className="medication-wizard-footer">
              <button className="tuga-button-primary wizard-main-action" disabled={isSaving} type="submit">
                {isSaving
                  ? 'Guardando…'
                  : step === 5
                    ? <><span aria-hidden="true">✓</span> {submitLabel}</>
                    : <>Continuar <span aria-hidden="true">→</span></>}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}
