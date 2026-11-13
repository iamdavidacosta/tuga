import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

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

  const closeTarget = medicationId ? `/medicamentos/${medicationId}` : '/medicamentos'

  return (
    <div className="add-medication-screen">
      {loadingError ? (
        <section className="information-panel add-medication-message" role="alert">
          <h2 className="tuga-heading">No pudimos abrir el formulario</h2>
          <p>{loadingError}</p>
          <button className="tuga-button-primary" onClick={() => void navigate(closeTarget)} type="button">
            Volver a mis medicamentos
          </button>
        </section>
      ) : null}

      {!initialDraft && !loadingError ? (
        <p className="loading-message add-medication-message" role="status">Cargando medicamento…</p>
      ) : null}

      {initialDraft ? (
        <MedicationWizard
          initialDraft={initialDraft}
          onClose={() => void navigate(closeTarget)}
          onSave={handleSave}
          startWithIntro={!isEditing}
          submitLabel={isEditing ? 'Guardar cambios' : 'Guardar medicamento'}
        />
      ) : null}
    </div>
  )
}
