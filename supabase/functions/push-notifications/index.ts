import { withSupabase } from 'npm:@supabase/server@1'
import webpush from 'npm:web-push@3.6.7'

import {
  classifyPushResponse,
  processDeliveryBatch,
  type DeliveryTarget,
  type SendResult,
} from '../_shared/reminderEngine.ts'

const allowedOrigins = new Set(
  (Deno.env.get('TUGA_ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(request: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request) })
}

function configureWebPush(): void {
  const subject = Deno.env.get('VAPID_SUBJECT') ?? ''
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
  if (!subject || !publicKey || !privateKey) throw new Error('Web Push is not configured')
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

function pushSubscription(target: Pick<DeliveryTarget, 'endpoint' | 'p256dh' | 'auth_key'>) {
  return {
    endpoint: target.endpoint,
    keys: { p256dh: target.p256dh, auth: target.auth_key },
  }
}

async function sendDoseReminder(target: DeliveryTarget): Promise<SendResult> {
  const payload = JSON.stringify({
    title: 'TUGA te recuerda',
    body: 'Tienes una toma pendiente. Abre TUGA para revisarla.',
    tag: `tuga-dose-${target.occurrence_id}`,
    data: { url: `/tomas/${target.occurrence_id}/confirmar` },
  })
  try {
    const response = await webpush.sendNotification(pushSubscription(target), payload, {
      TTL: 300,
      urgency: 'high',
    })
    return classifyPushResponse(response.statusCode)
  } catch (error) {
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number(error.statusCode)
      : null
    return Number.isInteger(statusCode)
      ? classifyPushResponse(statusCode)
      : { outcome: 'retry', responseCode: null, errorCode: 'network_error' }
  }
}

async function sendTestNotification(target: Pick<DeliveryTarget, 'endpoint' | 'p256dh' | 'auth_key'>): Promise<SendResult> {
  try {
    const response = await webpush.sendNotification(
      pushSubscription(target),
      JSON.stringify({
        title: 'Prueba de TUGA',
        body: 'Tus recordatorios están configurados en este dispositivo.',
        tag: 'tuga-notification-test',
        data: { url: '/configuracion' },
      }),
      { TTL: 120, urgency: 'normal' },
    )
    return classifyPushResponse(response.statusCode)
  } catch (error) {
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number(error.statusCode)
      : null
    return Number.isInteger(statusCode)
      ? classifyPushResponse(statusCode)
      : { outcome: 'retry', responseCode: null, errorCode: 'network_error' }
  }
}

const securedHandler = withSupabase(
  { auth: ['user', 'secret'] },
  async (request, context) => {
    if (request.method !== 'POST') return json(request, { message: 'Método no permitido.' }, 405)
    let body: { mode?: unknown }
    try {
      body = await request.json() as { mode?: unknown }
    } catch {
      return json(request, { message: 'Solicitud no válida.' }, 400)
    }
    const mode = typeof body.mode === 'string' ? body.mode : ''

    try {
      configureWebPush()
    } catch {
      return json(request, { message: 'Los recordatorios todavía no están configurados.' }, 503)
    }

    if (mode === 'process') {
      if (context.authMode !== 'secret') return json(request, { message: 'No autorizado.' }, 403)
      const { data, error } = await context.supabaseAdmin.rpc('claim_due_notification_deliveries', { p_limit: 100 })
      if (error) throw error
      const targets = (data ?? []) as DeliveryTarget[]
      const summary = await processDeliveryBatch(targets, {
        isCurrent: async (target) => {
          const result = await context.supabaseAdmin.rpc('is_notification_delivery_current', {
            p_delivery_id: target.delivery_id,
            p_claim_token: target.claim_token,
          })
          if (result.error) throw result.error
          return result.data === true
        },
        send: sendDoseReminder,
        complete: async (target, result) => {
          const completion = await context.supabaseAdmin.rpc('complete_notification_delivery', {
            p_delivery_id: target.delivery_id,
            p_claim_token: target.claim_token,
            p_outcome: result.outcome,
            p_response_code: result.responseCode,
            p_error_code: result.errorCode,
          })
          if (completion.error) throw completion.error
        },
      })
      return json(request, summary)
    }

    if (mode === 'test') {
      if (context.authMode !== 'user') return json(request, { message: 'Se requiere una sesión de usuario.' }, 403)
      const userId = context.userClaims?.id
      if (!userId) return json(request, { message: 'No pudimos identificar tu sesión.' }, 401)
      const { data, error } = await context.supabaseAdmin.rpc('begin_push_test', {
        p_user_id: userId,
      })
      if (error) {
        const limited = error.code === 'P0001'
        return json(request, {
          message: limited
            ? 'Espera cinco minutos antes de hacer otra prueba.'
            : 'No pudimos iniciar la prueba.',
        }, limited ? 429 : 400)
      }
      const rows = data ?? []
      const requestId = rows[0]?.request_id as string | undefined
      const targets = rows.filter((row) => row.subscription_id !== null)
      let accepted = 0
      let failed = 0
      const expired: string[] = []
      for (const target of targets) {
        const result = await sendTestNotification(target)
        if (result.outcome === 'accepted') accepted += 1
        else failed += 1
        if (result.outcome === 'expired') expired.push(target.subscription_id)
      }
      if (requestId) {
        const completion = await context.supabaseAdmin.rpc('complete_push_test_request', {
          p_request_id: requestId,
          p_accepted_count: accepted,
          p_failed_count: failed,
          p_expired_subscription_ids: expired,
        })
        if (completion.error) throw completion.error
      }
      return json(request, {
        accepted,
        failed,
        message: accepted > 0
          ? `El servicio aceptó la prueba para ${accepted} dispositivo${accepted === 1 ? '' : 's'}.`
          : 'No hay dispositivos activos que puedan recibir la prueba.',
      })
    }

    return json(request, { message: 'Operación no válida.' }, 400)
  },
)

export default {
  fetch(request: Request): Promise<Response> | Response {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
    return securedHandler(request)
  },
}
