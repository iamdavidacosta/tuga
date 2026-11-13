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

const medicationRows = [
  ['11111111-1111-4111-8111-111111111201', 'Losartán', 1, 'tableta', 'active'],
  ['11111111-1111-4111-8111-111111111202', 'Metformina de liberación prolongada', 1, 'tableta', 'active'],
  ['11111111-1111-4111-8111-111111111203', 'Atorvastatina', 1, 'tableta', 'active'],
  ['11111111-1111-4111-8111-111111111204', 'Acetaminofén', 2, 'tabletas', 'paused'],
  ['11111111-1111-4111-8111-111111111205', 'Amoxicilina', 1, 'cápsula', 'completed'],
].map(([id, name, dosageAmount, dosageUnit, status]) => ({
  id,
  name,
  dosage_amount: dosageAmount,
  dosage_unit: dosageUnit,
  instructions: null,
  notes: null,
  start_date: '2026-11-01',
  end_date: status === 'active' ? null : '2026-11-10',
  duration_config: status === 'active'
    ? { kind: 'indefinite', boundary: 'inclusive' }
    : { kind: 'days', amount: 10, boundary: 'inclusive' },
  status,
  created_at: '2026-11-01T12:00:00Z',
  updated_at: '2026-11-01T12:00:00Z',
}))

const scheduleRows = medicationRows.map((medication, index) => ({
  id: `22222222-2222-4222-8222-22222222220${index + 1}`,
  medication_id: medication.id,
  schedule_type: 'daily',
  local_times: [`${String(8 + index * 3).padStart(2, '0')}:00:00`],
  timezone: 'America/Bogota',
  recurrence_config: { mode: 'fixed', frequencyKind: 'daily', intervalDays: 1 },
}))

test('Medicamentos reproduce el mockup sin desbordamiento móvil', async ({ page }, testInfo) => {
  await page.addInitScript((session) => {
    window.localStorage.setItem('tuga-auth-session', JSON.stringify(session))
  }, createTestSession())

  await page.route('**/rest/v1/medications*', async (route) => {
    await route.fulfill({ json: medicationRows })
  })
  await page.route('**/rest/v1/medication_schedules*', async (route) => {
    await route.fulfill({ json: scheduleRows })
  })

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/medicamentos')

    await expect(page.getByRole('heading', { name: 'Medicamentos' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tratamientos activos (3)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Finalizados (2)' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver Losartán' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver Metformina de liberación prolongada' })).toBeVisible()

    const layout = await page.evaluate(() => {
      const addButton = document.querySelector('.medications-add-action')!.getBoundingClientRect()
      const navigation = document.querySelector('.bottom-navigation')!.getBoundingClientRect()
      const cards = [...document.querySelectorAll<HTMLElement>('.treatment-card')]
      return {
        documentWidth: document.documentElement.scrollWidth,
        addButtonVisible: addButton.top >= 0 && addButton.bottom <= window.innerHeight,
        addButtonClearOfNavigation: addButton.bottom <= navigation.top,
        cardsContained: cards.every((card) => {
          const bounds = card.getBoundingClientRect()
          return bounds.left >= -1 && bounds.right <= window.innerWidth + 1
        }),
      }
    })
    expect(layout).toEqual({
      documentWidth: viewport.width,
      addButtonVisible: true,
      addButtonClearOfNavigation: true,
      cardsContained: true,
    })

    if (viewport.width === 390) {
      await page.screenshot({ path: 'docs/capturas/medicamentos-390x844.png' })
      await page.screenshot({ path: testInfo.outputPath('medicamentos-completa.png'), fullPage: true })
    }

    await page.getByRole('button', { name: 'Finalizados (2)' }).click()
    await expect(page.getByRole('link', { name: 'Ver Acetaminofén' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver Losartán' })).not.toBeVisible()
  }
})
