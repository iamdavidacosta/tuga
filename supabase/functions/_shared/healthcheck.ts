export type DatabaseProbeResult = {
  data: boolean | null
  error: unknown
}

export type DatabaseHealth = 'ok' | 'timeout' | 'unavailable'

export async function checkDatabaseHealth(
  probe: () => PromiseLike<DatabaseProbeResult>,
  timeoutMs = 4_000,
): Promise<DatabaseHealth> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>((resolve) => {
    timeoutId = setTimeout(() => resolve('timeout'), timeoutMs)
  })

  try {
    const result = await Promise.race([
      Promise.resolve(probe()).then(({ data, error }) => error || data !== true ? 'unavailable' as const : 'ok' as const),
      timeout,
    ])
    return result
  } catch {
    return 'unavailable'
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
