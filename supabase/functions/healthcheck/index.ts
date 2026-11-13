import { withSupabase } from 'npm:@supabase/server@1'

import { checkDatabaseHealth } from '../_shared/healthcheck.ts'

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  }
}

function json(request: Request, status: 'ok' | 'unavailable', httpStatus: number): Response {
  return Response.json({ status }, { status: httpStatus, headers: corsHeaders(request) })
}

const securedHandler = withSupabase(
  { auth: ['user', 'secret'] },
  async (request, context) => {
    if (request.method !== 'GET') return json(request, 'unavailable', 405)

    const health = await checkDatabaseHealth(
      () => context.supabaseAdmin.rpc('tuga_healthcheck'),
    )

    if (health === 'ok') return json(request, 'ok', 200)
    return json(request, 'unavailable', health === 'timeout' ? 504 : 503)
  },
)

export default {
  fetch(request: Request): Promise<Response> | Response {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
    return securedHandler(request)
  },
}
