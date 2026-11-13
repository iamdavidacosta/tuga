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

interface DoseFixture {
  date: string
  hour: string
  id: string
  medication: string
  status: 'pending' | 'taken' | 'skipped'
}

const doseFixtures: DoseFixture[] = [
  { id: '101', date: '2026-01-01', hour: '08:00:00', medication: 'Losartán', status: 'taken' },
  { id: '102', date: '2026-01-04', hour: '08:00:00', medication: 'Losartán', status: 'pending' },
  { id: '103', date: '2026-01-06', hour: '20:00:00', medication: 'Atorvastatina', status: 'skipped' },
  { id: '104', date: '2026-01-10', hour: '14:00:00', medication: 'Metformina', status: 'pending' },
  { id: '105', date: '2026-01-14', hour: '20:00:00', medication: 'Atorvastatina', status: 'skipped' },
  { id: '106', date: '2026-01-15', hour: '08:00:00', medication: 'Losartán', status: 'taken' },
  { id: '107', date: '2026-01-18', hour: '08:00:00', medication: 'Losartán', status: 'taken' },
  { id: '108', date: '2026-01-18', hour: '14:00:00', medication: 'Metformina', status: 'pending' },
  { id: '109', date: '2026-01-18', hour: '20:00:00', medication: 'Atorvastatina', status: 'skipped' },
]

const doseRows = doseFixtures.map((fixture) => ({
  id: `11111111-1111-4111-8111-111111111${fixture.id}`,
  medication_id: `22222222-2222-4222-8222-222222222${fixture.id}`,
  schedule_id: `33333333-3333-4333-8333-333333333${fixture.id}`,
  medication_name: fixture.medication,
  dosage_amount: 1,
  dosage_unit: 'tableta',
  scheduled_at: `${fixture.date}T13:00:00Z`,
  status: fixture.status,
  taken_at: fixture.status === 'taken' ? `${fixture.date}T13:02:00Z` : null,
  updated_at: `${fixture.date}T13:02:00Z`,
  local_date: fixture.date,
  local_time: fixture.hour,
  display_timezone: 'America/Bogota',
}))

test('Calendario reproduce el mockup en móvil sin desbordamiento', async ({ page }, testInfo) => {
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
    await page.goto('/calendario')

    await expect(page.getByRole('heading', { name: 'Calendario de medicamentos' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Enero 2026' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Domingo, 18 de enero' })).toBeVisible()
    await expect(page.getByText('3 medicamentos')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver toma de Losartán a las 8:00 AM' })).toBeVisible()

    const layout = await page.evaluate(() => {
      const monthCard = document.querySelector('.calendar-month-card')!.getBoundingClientRect()
      const legend = document.querySelector('.calendar-status-legend')!.getBoundingClientRect()
      const days = [...document.querySelectorAll<HTMLElement>('.calendar-day')]
      return {
        documentWidth: document.documentElement.scrollWidth,
        monthCardContained: monthCard.left >= -1 && monthCard.right <= window.innerWidth + 1,
        legendContained: legend.left >= -1 && legend.right <= window.innerWidth + 1,
        dayTargets: days.every((day) => day.getBoundingClientRect().height >= 54),
      }
    })
    expect(layout).toEqual({
      documentWidth: viewport.width,
      monthCardContained: true,
      legendContained: true,
      dayTargets: true,
    })

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const contentClearOfNavigation = await page.evaluate(() => {
      const detail = document.querySelector('.calendar-day-detail')!.getBoundingClientRect()
      const navigation = document.querySelector('.bottom-navigation')!.getBoundingClientRect()
      return detail.bottom <= navigation.top
    })
    expect(contentClearOfNavigation).toBe(true)

    if (viewport.width === 390) {
      await page.screenshot({ path: 'docs/capturas/calendario-detalle-390x844.png' })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: 'docs/capturas/calendario-390x844.png' })
      await page.screenshot({ path: testInfo.outputPath('calendario-completo.png'), fullPage: true })
    }
  }
})
