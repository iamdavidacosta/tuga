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

const doseRows = [
  {
    id: '11111111-1111-4111-8111-111111111101',
    medication_id: '11111111-1111-4111-8111-111111111201',
    schedule_id: '11111111-1111-4111-8111-111111111301',
    medication_name: 'Losartán',
    dosage_amount: 1,
    dosage_unit: 'tableta',
    scheduled_at: '2099-01-18T13:00:00Z',
    status: 'pending',
    taken_at: null,
    updated_at: '2026-11-13T12:00:00Z',
    local_date: '2026-11-13',
    local_time: '08:00:00',
    display_timezone: 'America/Bogota',
  },
  {
    id: '11111111-1111-4111-8111-111111111102',
    medication_id: '11111111-1111-4111-8111-111111111202',
    schedule_id: '11111111-1111-4111-8111-111111111302',
    medication_name: 'Metformina de liberación prolongada',
    dosage_amount: 1,
    dosage_unit: 'tableta',
    scheduled_at: '2099-01-18T19:00:00Z',
    status: 'taken',
    taken_at: '2026-11-13T19:02:00Z',
    updated_at: '2026-11-13T19:02:00Z',
    local_date: '2026-11-13',
    local_time: '14:00:00',
    display_timezone: 'America/Bogota',
  },
  {
    id: '11111111-1111-4111-8111-111111111103',
    medication_id: '11111111-1111-4111-8111-111111111203',
    schedule_id: '11111111-1111-4111-8111-111111111303',
    medication_name: 'Atorvastatina',
    dosage_amount: 1,
    dosage_unit: 'tableta',
    scheduled_at: '2099-01-19T01:00:00Z',
    status: 'skipped',
    taken_at: null,
    updated_at: '2026-11-13T20:00:00Z',
    local_date: '2026-11-13',
    local_time: '20:00:00',
    display_timezone: 'America/Bogota',
  },
]

test('Hoy conserva la composición del mockup sin desbordamiento', async ({ page }, testInfo) => {
  await page.addInitScript((session) => {
    window.localStorage.setItem('tuga-auth-session', JSON.stringify(session))
  }, createTestSession())

  await page.route('**/rest/v1/rpc/get_dose_context', async (route) => {
    await route.fulfill({ json: [{ display_timezone: 'America/Bogota', local_date: '2026-11-13' }] })
  })
  await page.route('**/rest/v1/rpc/ensure_dose_occurrences', async (route) => {
    await route.fulfill({ json: 3 })
  })
  await page.route('**/rest/v1/rpc/list_dose_occurrences', async (route) => {
    await route.fulfill({ json: doseRows })
  })

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/hoy')
    await expect(page.getByRole('heading', { name: 'Hola, Marta' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Próximo medicamento' })).toBeVisible()
    const overflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      elements: [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 8)
        .map((element) => ({
          className: element.className,
          right: Math.round(element.getBoundingClientRect().right),
          width: Math.round(element.getBoundingClientRect().width),
        })),
    }))
    expect(overflow, JSON.stringify(overflow)).toMatchObject({ documentWidth: viewport.width })

    if (viewport.width === 390) {
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: 'docs/capturas/hoy-390x844.png' })
      await page.screenshot({ path: testInfo.outputPath('hoy-completa.png'), fullPage: true })
    }
  }
})
