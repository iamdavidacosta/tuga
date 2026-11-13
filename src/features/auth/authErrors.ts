interface ErrorWithCode {
  code?: unknown
  message?: unknown
}

const sessionErrorCodes = new Set([
  'refresh_token_already_used',
  'refresh_token_not_found',
  'session_not_found',
])

export function getAuthErrorMessage(error: unknown): string {
  const authError = error as ErrorWithCode | null
  const code = typeof authError?.code === 'string' ? authError.code : ''
  const message =
    typeof authError?.message === 'string' ? authError.message.toLowerCase() : ''

  if (sessionErrorCodes.has(code)) {
    return 'Tu sesión terminó. Inicia sesión nuevamente con Google.'
  }

  if (code === 'over_request_rate_limit') {
    return 'Se hicieron demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
  }

  if (code === 'bad_oauth_state' || code === 'validation_failed') {
    return 'No pudimos validar el inicio de sesión. Vuelve a intentarlo desde TUGA.'
  }

  if (code === 'oauth_provider_not_supported') {
    return 'El acceso con Google no está disponible. Revisa la configuración de Supabase Auth.'
  }

  if (
    message.includes('configuración pública de supabase') ||
    message.includes('supabase todavía no está configurado')
  ) {
    return 'El acceso con Google todavía no está configurado en este entorno.'
  }

  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'No pudimos conectarnos. Revisa tu conexión a internet e inténtalo de nuevo.'
  }

  return 'No pudimos completar el inicio de sesión. Inténtalo nuevamente.'
}

export function getOAuthCallbackError(location: Location): string | null {
  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
  const code = query.get('error_code') ?? hash.get('error_code')
  const error = query.get('error') ?? hash.get('error')

  if (!code && !error) {
    return null
  }

  return getAuthErrorMessage({ code: code ?? error })
}
