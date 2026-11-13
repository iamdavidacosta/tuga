import { describe, expect, it } from 'vitest'

import { getAuthErrorMessage, getOAuthCallbackError } from './authErrors'

describe('errores de autenticación', () => {
  it('traduce los errores de sesión a lenguaje claro', () => {
    expect(getAuthErrorMessage({ code: 'session_not_found' })).toBe(
      'Tu sesión terminó. Inicia sesión nuevamente con Google.',
    )
  })

  it('no muestra al usuario el detalle técnico recibido en el callback', () => {
    const location = {
      search: '?error=server_error&error_description=detalle+interno',
      hash: '',
    } as Location

    const result = getOAuthCallbackError(location)

    expect(result).toBe(
      'No pudimos completar el inicio de sesión. Inténtalo nuevamente.',
    )
    expect(result).not.toContain('detalle interno')
  })
})
