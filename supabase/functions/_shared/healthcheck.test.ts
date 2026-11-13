import { describe, expect, it, vi } from 'vitest'

import { checkDatabaseHealth } from './healthcheck'

describe('healthcheck de PostgreSQL', () => {
  it('devuelve ok cuando la consulta real responde', async () => {
    await expect(checkDatabaseHealth(async () => ({ data: true, error: null }))).resolves.toBe('ok')
  })

  it('devuelve unavailable cuando PostgreSQL no está disponible', async () => {
    await expect(checkDatabaseHealth(async () => {
      throw new Error('database unavailable')
    })).resolves.toBe('unavailable')
  })

  it('limita el tiempo de espera de la consulta', async () => {
    vi.useFakeTimers()
    const result = checkDatabaseHealth(() => new Promise(() => undefined), 1_000)
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(result).resolves.toBe('timeout')
    vi.useRealTimers()
  })
})
