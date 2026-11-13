import { describe, expect, it } from 'vitest'

import { resolveAuthRedirectUrl } from './authRedirect'

describe('resolveAuthRedirectUrl', () => {
  it('usa el callback del origen actual por defecto', () => {
    expect(
      resolveAuthRedirectUrl({}, 'http://localhost:5173'),
    ).toBe('http://localhost:5173/auth/callback')
  })

  it('acepta una URL pública explícita y elimina el fragmento', () => {
    expect(
      resolveAuthRedirectUrl(
        { VITE_AUTH_REDIRECT_URL: 'https://tuga.example/auth/callback#token' },
        'http://localhost:5173',
      ),
    ).toBe('https://tuga.example/auth/callback')
  })

  it.each([
    ['javascript:alert(1)', 'protocolo http o https'],
    ['https://usuario:clave@tuga.example/auth/callback', 'credenciales'],
  ])('rechaza una redirección insegura: %s', (url, message) => {
    expect(() =>
      resolveAuthRedirectUrl(
        { VITE_AUTH_REDIRECT_URL: url },
        'http://localhost:5173',
      ),
    ).toThrow(message)
  })
})
