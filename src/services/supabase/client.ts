import {
  createClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

import type { Database } from '../../types/database'
import { readSupabasePublicConfig } from './config'

let client: SupabaseClient<Database> | undefined

export function getSupabaseClient(): SupabaseClient<Database> {
  const config = readSupabasePublicConfig(import.meta.env)

  if (!config) {
    throw new Error(
      'Supabase todavía no está configurado. Completa las variables públicas del entorno.',
    )
  }

  client ??= createClient<Database>(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      persistSession: true,
      storageKey: 'tuga-auth-session',
    },
  })

  return client
}
