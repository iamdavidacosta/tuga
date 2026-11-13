import { describe, expect, it } from 'vitest'

import { readSupabasePublicConfig } from './config'

describe('configuración pública de Supabase', () => {
  it('permite iniciar TUGA cuando Supabase aún no está configurado', () => {
    expect(readSupabasePublicConfig({})).toBeNull()
  })

  it('rechaza una configuración parcial', () => {
    expect(() =>
      readSupabasePublicConfig({
        VITE_SUPABASE_URL: 'https://proyecto.supabase.co',
      }),
    ).toThrow('La configuración pública de Supabase está incompleta')
  })

  it('acepta una URL y una clave publicable', () => {
    expect(
      readSupabasePublicConfig({
        VITE_SUPABASE_URL: 'https://proyecto.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ejemplo',
      }),
    ).toEqual({
      url: 'https://proyecto.supabase.co/',
      publishableKey: 'sb_publishable_ejemplo',
    })
  })

  it('rechaza protocolos que no son web', () => {
    expect(() =>
      readSupabasePublicConfig({
        VITE_SUPABASE_URL: 'javascript:alert(1)',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ejemplo',
      }),
    ).toThrow('debe usar el protocolo http o https')
  })
})
