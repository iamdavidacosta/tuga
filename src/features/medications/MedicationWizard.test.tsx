import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MedicationWizard } from './MedicationWizard'
import { emptyMedicationDraft, type MedicationDraft } from './types'

function renderWizard(onSave: (draft: MedicationDraft) => Promise<void>) {
  render(
    <MedicationWizard
      initialDraft={emptyMedicationDraft}
      onClose={() => undefined}
      onSave={onSave}
      startWithIntro={false}
      submitLabel="Guardar medicamento"
    />,
  )
}

async function completeFirstFiveSteps(
  onSave: (draft: MedicationDraft) => Promise<void>,
) {
  const user = userEvent.setup()
  renderWizard(onSave)

  await user.type(screen.getByLabelText('Nombre del medicamento'), 'Medicamento indicado')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))

  await user.type(screen.getByLabelText('Cantidad indicada'), '1.5')
  await user.selectOptions(screen.getByLabelText('Presentación indicada'), 'tableta')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))

  await user.click(screen.getByLabelText('Cada 2 días'))
  await user.click(screen.getByRole('button', { name: 'Continuar' }))

  await user.type(screen.getByLabelText('Hora 1'), '08:00')
  await user.click(screen.getByRole('button', { name: 'Agregar otro horario' }))
  await user.type(screen.getByLabelText('Hora 2'), '20:00')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))

  const startDate = screen.getByLabelText('Fecha inicial indicada')
  await user.clear(startDate)
  await user.type(startDate, '2026-11-12')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))

  return user
}

describe('asistente de medicamentos', () => {
  it('muestra la bienvenida y comienza el asistente', async () => {
    const user = userEvent.setup()
    render(
      <MedicationWizard
        initialDraft={emptyMedicationDraft}
        onClose={() => undefined}
        onSave={async () => undefined}
        submitLabel="Guardar medicamento"
      />,
    )

    expect(screen.getByRole('heading', { name: 'Añadir un medicamento' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Comenzar' }))
    expect(screen.getByRole('heading', { name: '¿Cómo se llama el medicamento?' })).toBeVisible()
  })

  it('recorre seis pasos, conserva varios horarios y guarda una sola vez', async () => {
    const onSave = vi.fn<(draft: MedicationDraft) => Promise<void>>(
      () => new Promise<void>(() => undefined),
    )
    const user = await completeFirstFiveSteps(onSave)

    expect(screen.getByText('Paso 6 de 6')).toBeVisible()
    await user.click(screen.getByLabelText('Por un tiempo específico'))
    await user.selectOptions(screen.getByLabelText('Indica la duración'), 'days')
    await user.type(screen.getByLabelText('Cantidad'), '10')

    expect(screen.getByText('08:00, 20:00')).toBeVisible()
    expect(screen.getByText('Cada 2 días')).toBeVisible()
    expect(screen.getByText('2026-11-21')).toBeVisible()

    const saveButton = screen.getByRole('button', { name: 'Guardar medicamento' })
    await user.click(saveButton)
    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledOnce()
    expect(saveButton).toBeDisabled()
  })

  it('permite regresar con la flecha superior sin perder datos', async () => {
    const user = userEvent.setup()
    renderWizard(async () => undefined)

    await user.type(screen.getByLabelText('Nombre del medicamento'), 'Nombre conservado')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('button', { name: 'Regresar' }))

    expect(screen.getByLabelText('Nombre del medicamento')).toHaveValue('Nombre conservado')
    expect(screen.queryByRole('button', { name: 'Paso anterior' })).not.toBeInTheDocument()
  })

  it('muestra el error del campo sin avanzar', async () => {
    const user = userEvent.setup()
    renderWizard(async () => undefined)

    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escribe el nombre como aparece en la prescripción.',
    )
    expect(screen.getByText('Paso 1 de 6')).toBeVisible()
  })
})
