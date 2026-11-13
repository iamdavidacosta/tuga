import { describe, expect, it, vi } from 'vitest'

import {
  classifyPushResponse,
  processDeliveryBatch,
  type DeliveryTarget,
} from './reminderEngine'

const target = (id: string): DeliveryTarget => ({
  delivery_id: id,
  claim_token: `claim-${id}`,
  occurrence_id: `occurrence-${id}`,
  subscription_id: `subscription-${id}`,
  endpoint: `https://push.example.test/${id}`,
  p256dh: 'A'.repeat(65),
  auth_key: 'B'.repeat(16),
  attempt_count: 1,
})

describe('motor de recordatorios', () => {
  it('no envía una toma que dejó de estar pendiente', async () => {
    const send = vi.fn()
    const complete = vi.fn()
    const summary = await processDeliveryBatch([target('confirmed')], {
      isCurrent: async () => false,
      send,
      complete,
    })

    expect(send).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
    expect(summary.cancelled).toBe(1)
  })

  it('procesa de forma independiente dos dispositivos', async () => {
    const complete = vi.fn()
    const summary = await processDeliveryBatch([target('phone'), target('tablet')], {
      isCurrent: async () => true,
      send: async () => classifyPushResponse(201),
      complete,
    })

    expect(summary).toMatchObject({ claimed: 2, accepted: 2 })
    expect(complete).toHaveBeenCalledTimes(2)
  })

  it('desactiva respuestas 410 y reintenta errores temporales sin fingir entrega', () => {
    expect(classifyPushResponse(410)).toMatchObject({ outcome: 'expired' })
    expect(classifyPushResponse(503)).toMatchObject({ outcome: 'retry' })
    expect(classifyPushResponse(400)).toMatchObject({ outcome: 'failed' })
    expect(classifyPushResponse(202)).toMatchObject({ outcome: 'accepted' })
  })

  it('convierte un fallo de red en un reintento controlado', async () => {
    const complete = vi.fn()
    const summary = await processDeliveryBatch([target('network')], {
      isCurrent: async () => true,
      send: async () => { throw new Error('simulated') },
      complete,
    })

    expect(summary.retried).toBe(1)
    expect(complete).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ outcome: 'retry', errorCode: 'network_error' }),
    )
  })
})
