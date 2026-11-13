export type DeliveryOutcome = 'accepted' | 'expired' | 'retry' | 'failed'

export interface DeliveryTarget {
  delivery_id: string
  claim_token: string
  occurrence_id: string
  subscription_id: string
  endpoint: string
  p256dh: string
  auth_key: string
  attempt_count: number
}

export interface SendResult {
  outcome: DeliveryOutcome
  responseCode: number | null
  errorCode: string | null
}

export interface ReminderProcessorDependencies {
  isCurrent: (target: DeliveryTarget) => Promise<boolean>
  send: (target: DeliveryTarget) => Promise<SendResult>
  complete: (target: DeliveryTarget, result: SendResult) => Promise<void>
}

export interface ProcessSummary {
  claimed: number
  accepted: number
  expired: number
  retried: number
  failed: number
  cancelled: number
}

export async function processDeliveryBatch(
  targets: DeliveryTarget[],
  dependencies: ReminderProcessorDependencies,
): Promise<ProcessSummary> {
  const summary: ProcessSummary = {
    claimed: targets.length,
    accepted: 0,
    expired: 0,
    retried: 0,
    failed: 0,
    cancelled: 0,
  }

  for (const target of targets) {
    if (!(await dependencies.isCurrent(target))) {
      summary.cancelled += 1
      continue
    }

    let result: SendResult
    try {
      result = await dependencies.send(target)
    } catch {
      result = { outcome: 'retry', responseCode: null, errorCode: 'network_error' }
    }
    await dependencies.complete(target, result)

    if (result.outcome === 'accepted') summary.accepted += 1
    if (result.outcome === 'expired') summary.expired += 1
    if (result.outcome === 'retry') summary.retried += 1
    if (result.outcome === 'failed') summary.failed += 1
  }

  return summary
}

export function classifyPushResponse(statusCode: number | null): SendResult {
  if (statusCode !== null && statusCode >= 200 && statusCode < 300) {
    return { outcome: 'accepted', responseCode: statusCode, errorCode: null }
  }
  if (statusCode === 404 || statusCode === 410) {
    return { outcome: 'expired', responseCode: statusCode, errorCode: 'subscription_expired' }
  }
  if (statusCode === 429 || (statusCode !== null && statusCode >= 500)) {
    return { outcome: 'retry', responseCode: statusCode, errorCode: 'provider_temporary_error' }
  }
  return { outcome: 'failed', responseCode: statusCode, errorCode: 'provider_rejected' }
}
