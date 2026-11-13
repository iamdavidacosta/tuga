import { getSupabaseClient } from '../../services/supabase/client'

export type HealthCheckResult = {
  connection: 'available' | 'unavailable'
  reason: 'ok' | 'service' | 'timeout'
}

type HealthInvoker = (signal: AbortSignal) => Promise<{
  data: unknown
  error: unknown
}>

const invokeHealthcheck: HealthInvoker = (signal) => getSupabaseClient().functions.invoke('healthcheck', {
  method: 'GET',
  signal,
})

export async function checkTugaHealth(
  invoke: HealthInvoker = invokeHealthcheck,
  timeoutMs = 6_000,
): Promise<HealthCheckResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const { data, error } = await invoke(controller.signal)
    if (error || !data || typeof data !== 'object' || !('status' in data) || data.status !== 'ok') {
      return { connection: 'unavailable', reason: 'service' }
    }
    return { connection: 'available', reason: 'ok' }
  } catch {
    return {
      connection: 'unavailable',
      reason: controller.signal.aborted ? 'timeout' : 'service',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
