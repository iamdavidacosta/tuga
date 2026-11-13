import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MedicationWizard } from './MedicationWizard'
import { emptyMedicationDraft, type MedicationDraft } from './types'

async function completeWizard(
  onSave: (draft: MedicationDraft) => Promise<void>,
) {
  const user = userEvent.setup()
  render(
    <MedicationWizard
      initialDraft={emptyMedicationDraft}
      onSave={onSave}
      submitLabel="Guardar medicamento"
    />,
  )

  await user.type(screen.getByLabelText('Nombre del medicamento'), 'Medicamento indicado')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))

  await user.type(screen.getByLabelText('Cantidad indicada'), '1.5')
  await user.type(screen.getByLabelText('Unidad indicada'), 'tableta')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))

  await user.type(screen.getByLabelText('Hora 1'), '08:00')
  await user.click(screen.getByRole('button', { name: 'Agregar otra hora' }))
  await user.type(screen.getByLabelText('Hora 2'), '20:00')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))

  await user.type(screen.getByLabelText('Fecha inicial indicada'), '2026-11-12')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))

  await user.type(screen.getByLabelText('Cantidad de días'), '10')
  await user.click(screen.getByRole('button', { name: 'Continuar' }))

  return user
}

describe('asistente de medicamentos', () => {
  it('recorre seis pasos, conserva varios horarios y guarda una sola vez', async () => {
    const onSave = vi.fn<(draft: MedicationDraft) => Promise<void>>(
      () => new Promise<void>(() => undefined),
    )
    const user = await completeWizard(onSave)

    expect(screen.getByText('Paso 6 de 6: Revisar')).toBeVisible()
    expect(screen.getByText('08:00, 20:00')).toBeVisible()
    expect(screen.getByText('2026-11-21')).toBeVisible()

    const saveButton = screen.getByRole('button', { name: 'Guardar medicamento' })
    await user.click(saveButton)
    await user.click(saveButton)

    expect(onSave).toHaveBeenCalledOnce()
    expect(saveButton).toBeDisabled()
  })

  it('permite regresar sin perder el nombre ingresado', async () => {
    const user = userEvent.setup()
    render(
      <MedicationWizard
        initialDraft={emptyMedicationDraft}
        onSave={async () => undefined}
        submitLabel="Guardar medicamento"
      />,
    )

    await user.type(screen.getByLabelText('Nombre del medicamento'), 'Nombre conservado')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(screen.getByRole('button', { name: 'Paso anterior' }))

    expect(screen.getByLabelText('Nombre del medicamento')).toHaveValue('Nombre conservado')
  })

  it('muestra el error del paso sin avanzar', async () => {
    const user = userEvent.setup()
    render(
      <MedicationWizard
        initialDraft={emptyMedicationDraft}
        onSave={async () => undefined}
        submitLabel="Guardar medicamento"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escribe el nombre como aparece en la prescripción.',
    )
    expect(screen.getByText('Paso 1 de 6: Nombre')).toBeVisible()
  })
})
