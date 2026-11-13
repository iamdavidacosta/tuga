export interface SupabaseEnvironment {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_AUTH_REDIRECT_URL?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

export interface SupabasePublicConfig {
  readonly url: string
  readonly publishableKey: string
}
