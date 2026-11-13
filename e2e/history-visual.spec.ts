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
      created_at: '2026-01-18T12:00:00.000Z',
    },
  }
}

const doseRows = [
  ['101', '201', 'Losartán', '2026-01-18', '08:00:00', 'taken', '2026-01-18T13:07:00Z'],
  ['102', '202', 'Metformina', '2026-01-18', '14:00:00', 'pending', null],
  ['103', '203', 'Atorvastatina', '2026-01-18', '20:00:00', 'skipped', null],
  ['104', '201', 'Losartán', '2026-01-17', '08:00:00', 'taken', '2026-01-17T13:03:00Z'],
  ['105', '202', 'Metformina', '2026-01-17', '14:00:00', 'taken', '2026-01-17T19:04:00Z'],
  ['106', '203', 'Atorvastatina', '2026-01-17', '20:00:00', 'taken', '2026-01-18T01:02:00Z'],
].map(([id, medicationId, medication, date, hour, status, takenAt]) => ({
  id: `11111111-1111-4111-8111-111111111${id}`,
  medication_id: `22222222-2222-4222-8222-222222222${medicationId}`,
  schedule_id: `33333333-3333-4333-8333-333333333${id}`,
  medication_name: medication,
  dosage_amount: 1,
  dosage_unit: 'tableta',
  scheduled_at: `${date}T13:00:00Z`,
  status,
  taken_at: takenAt,
  updated_at: takenAt ?? `${date}T13:02:00Z`,
  local_date: date,
  local_time: hour,
  display_timezone: 'America/Bogota',
}))

test('Historial reproduce el mockup en móvil sin desbordamiento', async ({ page }, testInfo) => {
  await page.addInitScript((session) => {
    window.localStorage.setItem('tuga-auth-session', JSON.stringify(session))
  }, createTestSession())

  await page.route('**/rest/v1/rpc/get_dose_context', async (route) => {
    await route.fulfill({ json: [{ display_timezone: 'America/Bogota', local_date: '2026-01-18' }] })
  })
  await page.route('**/rest/v1/rpc/ensure_dose_occurrences', async (route) => {
    await route.fulfill({ json: doseRows.length })
  })
  await page.route('**/rest/v1/rpc/list_dose_occurrences', async (route) => {
    await route.fulfill({ json: doseRows })
  })

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/historial')

    await expect(page.getByRole('heading', { name: 'Historial de tomas' })).toBeVisible()
    await expect(page.getByLabel('Período')).toHaveValue('month')
    await expect(page.getByText('Domingo, 18 de enero de 2026')).toBeVisible()
    await expect(page.getByText('Sábado, 17 de enero de 2026')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver toma de Losartán a las 8:00 AM' }).first()).toBeVisible()

    const layout = await page.evaluate(() => {
      const filters = document.querySelector('.history-filters')!.getBoundingClientRect()
      const summary = document.querySelector('.history-summary')!.getBoundingClientRect()
      const cards = [...document.querySelectorAll<HTMLElement>('.history-date-card')]
      return {
        documentWidth: document.documentElement.scrollWidth,
        filtersContained: filters.left >= -1 && filters.right <= window.innerWidth + 1,
        summaryContained: summary.left >= -1 && summary.right <= window.innerWidth + 1,
        cardsContained: cards.every((card) => {
          const bounds = card.getBoundingClientRect()
          return bounds.left >= -1 && bounds.right <= window.innerWidth + 1
        }),
      }
    })
    expect(layout).toEqual({
      documentWidth: viewport.width,
      filtersContained: true,
      summaryContained: true,
      cardsContained: true,
    })

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto'
      window.scrollTo(0, document.documentElement.scrollHeight)
    })
    const contentClearOfNavigation = await page.evaluate(() => {
      const lastCard = document.querySelector('.history-date-card:last-child')!.getBoundingClientRect()
      const navigation = document.querySelector('.bottom-navigation')!.getBoundingClientRect()
      return lastCard.bottom <= navigation.top
    })
    expect(contentClearOfNavigation).toBe(true)

    if (viewport.width === 390) {
      await page.screenshot({ path: 'docs/capturas/historial-detalle-390x844.png' })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: 'docs/capturas/historial-390x844.png' })
      await page.screenshot({ path: testInfo.outputPath('historial-completo.png'), fullPage: true })
    }
  }
})
