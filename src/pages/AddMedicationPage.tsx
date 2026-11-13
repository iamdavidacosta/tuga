import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '../components/PageHeader'
import { medicationToDraft } from '../features/medications/medicationRules'
import { MedicationWizard } from '../features/medications/MedicationWizard'
import {
  createMedication,
  getMedication,
  updateMedication,
} from '../features/medications/medicationsService'
import {
  emptyMedicationDraft,
  type MedicationDraft,
} from '../features/medications/types'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function AddMedicationPage() {
  const { medicationId } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(medicationId)
  const [initialDraft, setInitialDraft] = useState<MedicationDraft | null>(
    isEditing ? null : emptyMedicationDraft,
  )
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const createRequestId = useRef(crypto.randomUUID())

  useDocumentTitle(`${isEditing ? 'Editar' : 'Agregar'} medicamento | TUGA`)

  useEffect(() => {
    if (!medicationId) return

    let isCurrent = true

    void getMedication(medicationId)
      .then((medication) => {
        if (isCurrent) setInitialDraft(medicationToDraft(medication))
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setLoadingError(
            error instanceof Error
              ? error.message
              : 'No pudimos cargar este medicamento.',
          )
        }
      })

    return () => {
      isCurrent = false
    }
  }, [medicationId])

  async function handleSave(draft: MedicationDraft) {
    const savedId = medicationId
      ? await updateMedication(medicationId, draft)
      : await createMedication(createRequestId.current, draft)

    await navigate(`/medicamentos/${savedId}`, {
      replace: true,
      state: {
        message: medicationId
          ? 'Los cambios se guardaron correctamente.'
          : 'El medicamento se guardó correctamente.',
      },
    })
  }

  return (
    <div className="screen-stack">
      <PageHeader
        backLabel="Volver a medicamentos"
        backTo={medicationId ? `/medicamentos/${medicationId}` : '/medicamentos'}
        title={isEditing ? 'Editar medicamento' : 'Agregar medicamento'}
      />

      {loadingError ? (
        <section className="information-panel" role="alert">
          <h2 className="tuga-heading">No pudimos abrir el formulario</h2>
          <p>{loadingError}</p>
        </section>
      ) : null}

      {!initialDraft && !loadingError ? (
        <p className="loading-message" role="status">Cargando medicamento…</p>
      ) : null}

      {initialDraft ? (
        <MedicationWizard
          initialDraft={initialDraft}
          onSave={handleSave}
          submitLabel={isEditing ? 'Guardar cambios' : 'Guardar medicamento'}
        />
      ) : null}
    </div>
  )
}
