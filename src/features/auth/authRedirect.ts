import type { SupabaseEnvironment } from '../../types/environment'

const allowedProtocols = new Set(['http:', 'https:'])

export function resolveAuthRedirectUrl(
  environment: SupabaseEnvironment,
  currentOrigin: string,
): string {
  const configuredUrl = environment.VITE_AUTH_REDIRECT_URL?.trim()
  const redirectUrl = new URL(
    configuredUrl || '/auth/callback',
    currentOrigin,
  )

  if (!allowedProtocols.has(redirectUrl.protocol)) {
    throw new Error(
      'VITE_AUTH_REDIRECT_URL debe usar el protocolo http o https.',
    )
  }

  if (redirectUrl.username || redirectUrl.password) {
    throw new Error('VITE_AUTH_REDIRECT_URL no puede incluir credenciales.')
  }

  redirectUrl.hash = ''
  return redirectUrl.toString()
}
