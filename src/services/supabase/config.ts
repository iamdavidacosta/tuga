import type {
  SupabaseEnvironment,
  SupabasePublicConfig,
} from '../../types/environment'

const supportedProtocols = new Set(['http:', 'https:'])

export function readSupabasePublicConfig(
  environment: SupabaseEnvironment,
): SupabasePublicConfig | null {
  const url = environment.VITE_SUPABASE_URL?.trim() ?? ''
  const publishableKey =
    environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

  if (!url && !publishableKey) {
    return null
  }

  if (!url || !publishableKey) {
    throw new Error(
      'La configuración pública de Supabase está incompleta. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.',
    )
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('VITE_SUPABASE_URL debe ser una URL válida.')
  }

  if (!supportedProtocols.has(parsedUrl.protocol)) {
    throw new Error('VITE_SUPABASE_URL debe usar el protocolo http o https.')
  }

  return {
    url: parsedUrl.toString(),
    publishableKey,
  }
}
