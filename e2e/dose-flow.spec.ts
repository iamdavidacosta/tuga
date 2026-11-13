import { createClient } from '@supabase/supabase-js'
import { expect, test } from '@playwright/test'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const localSecretKey = process.env.TUGA_E2E_LOCAL_SECRET_KEY

test('recorre Hoy y confirma una toma real en la base local', async ({ page }) => {
  test.skip(!supabaseUrl || !publishableKey || !localSecretKey, 'Requiere la configuración local de Supabase para E2E.')

  const email = `dose-e2e-${crypto.randomUUID()}@example.com`
  const password = `Tuga-${crypto.randomUUID()}!`
  const client = createClient(supabaseUrl!, publishableKey!)
  const admin = createClient(supabaseUrl!, localSecretKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: authData, error: authError } = await client.auth.signUp({ email, password })
  expect(authError).toBeNull()
  expect(authData.session).not.toBeNull()
  const userId = authData.user!.id

  try {
    const now = new Date()
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
    const part = (name: Intl.DateTimeFormatPartTypes) => localParts.find(({ type }) => type === name)!.value
    const localDate = `${part('year')}-${part('month')}-${part('day')}`
    const currentMinutes = Number(part('hour')) * 60 + Number(part('minute'))
    const futureMinutes = Math.min(currentMinutes + 30, 23 * 60 + 59)
    const localTime = `${String(Math.floor(futureMinutes / 60)).padStart(2, '0')}:${String(futureMinutes % 60).padStart(2, '0')}`
    const medicationId = crypto.randomUUID()

    const { error: createError } = await client.rpc('create_medication_with_schedule', {
      p_medication_id: medicationId,
      p_name: 'Medicamento E2E',
      p_dosage_amount: 1,
      p_dosage_unit: 'tableta',
      p_start_date: localDate,
      p_end_date: localDate,
      p_duration_config: { kind: 'days', amount: 1, boundary: 'inclusive' },
      p_schedule_type: 'daily',
      p_local_times: [localTime],
      p_timezone: 'America/Bogota',
      p_recurrence_config: { mode: 'fixed' },
    })
    expect(createError).toBeNull()

    await page.addInitScript((session) => {
      window.localStorage.setItem('tuga-auth-session', JSON.stringify(session))
    }, authData.session)
    await page.goto('/hoy')

    await expect(page.getByRole('heading', { name: 'Medicamento E2E' })).toBeVisible()
    await page.getByRole('link', { name: 'Sí, ya lo tomé' }).click()
    await page.getByRole('button', { name: 'Sí, ya lo tomé' }).click()
    await expect(page.getByRole('status')).toContainText('Toma confirmada')

    const { data: rows } = await client.rpc('get_dose_occurrence', {
      p_occurrence_id: page.url().split('/tomas/')[1]!.split('/')[0],
    })
    expect(rows?.[0]?.status).toBe('taken')
    expect(rows?.[0]?.taken_at).toBeTruthy()
  } finally {
    await admin.auth.admin.deleteUser(userId)
  }
})
