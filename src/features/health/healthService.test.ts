import { describe, expect, it, vi } from 'vitest'

import { checkTugaHealth } from './healthService'

describe('estado de TUGA', () => {
  it('reconoce un healthcheck válido', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { status: 'ok' }, error: null })
    await expect(checkTugaHealth(invoke)).resolves.toEqual({ connection: 'available', reason: 'ok' })
  })

  it('presenta como no disponible una respuesta fallida', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new Error('unavailable') })
    await expect(checkTugaHealth(invoke)).resolves.toEqual({ connection: 'unavailable', reason: 'service' })
  })

  it('cancela una comprobación que supera el tiempo límite', async () => {
    vi.useFakeTimers()
    const invoke = vi.fn((signal: AbortSignal) => new Promise<never>((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const result = checkTugaHealth(invoke, 1_000)
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(result).resolves.toEqual({ connection: 'unavailable', reason: 'timeout' })
    vi.useRealTimers()
  })
})
