import { expect, test } from '@playwright/test'

const userId = '11111111-1111-4111-8111-111111111111'

function createTestSession() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const accessToken = [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ aud: 'authenticated', exp: 4_102_444_800, role: 'authenticated', sub: userId }),
    'test-signature',
  ].join('.')

  return {
    access_token: accessToken,
    refresh_token: 'visual-test-refresh-token',
    expires_at: 4_102_444_800,
    expires_in: 2_147_483_647,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'marta@example.com',
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Marta Gómez' },
      created_at: '2026-11-13T12:00:00.000Z',
    },
  }
}

test('la navegación compartida conserva iconos uniformes y Más es clara', async ({ page }, testInfo) => {
  await page.addInitScript((session) => {
    window.localStorage.setItem('tuga-auth-session', JSON.stringify(session))
  }, createTestSession())

  await page.route('**/functions/v1/healthcheck', async (route) => {
    await route.fulfill({ json: { status: 'ok' } })
  })
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/get_dose_context')) {
      await route.fulfill({ json: [{ display_timezone: 'America/Bogota', local_date: '2026-11-13' }] })
      return
    }
    if (url.includes('/get_push_notification_status')) {
      await route.fulfill({ json: [{ current_device_active: false, active_devices: 0, last_test_at: null, last_test_status: null }] })
      return
    }
    await route.fulfill({ json: [] })
  })

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    for (const route of ['/hoy', '/medicamentos', '/calendario', '/configuracion']) {
      await page.setViewportSize(viewport)
      await page.goto(route)
      await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()

      const navigation = await page.evaluate(() => {
        const icons = [...document.querySelectorAll<HTMLElement>('.bottom-navigation__icon')]
        const labels = [...document.querySelectorAll<HTMLElement>('.bottom-navigation__label')]
        return {
          documentWidth: document.documentElement.scrollWidth,
          iconSizes: icons.map((icon) => [icon.getBoundingClientRect().width, icon.getBoundingClientRect().height]),
          labelsSingleLine: labels.every((label) => getComputedStyle(label).whiteSpace === 'nowrap'),
        }
      })
      expect(navigation, JSON.stringify(navigation)).toEqual({
        documentWidth: viewport.width,
        iconSizes: [[26, 26], [26, 26], [26, 26], [26, 26]],
        labelsSingleLine: true,
      })
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/configuracion')
  await expect(page.getByRole('heading', { name: 'Más opciones' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Mi perfil/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Recordatorios/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Mis preferencias/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ayuda/ })).toBeVisible()
  await page.screenshot({ path: 'docs/capturas/mas-390x844.png' })
  await page.screenshot({ path: testInfo.outputPath('mas-completa.png'), fullPage: true })
})
