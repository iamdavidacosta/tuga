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

test('Agregar medicamento conserva el mockup en anchos móviles', async ({ page }, testInfo) => {
  await page.addInitScript((session) => {
    window.localStorage.setItem('tuga-auth-session', JSON.stringify(session))
  }, createTestSession())

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/medicamentos/agregar')

    await expect(page.getByRole('heading', { name: 'Añadir un medicamento' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Comenzar' })).toBeVisible()

    const introLayout = await page.evaluate(() => {
      const pageRect = document.querySelector('.medication-wizard-page')!.getBoundingClientRect()
      const mascot = document.querySelector('.medication-wizard-intro__mascot')!.getBoundingClientRect()
      const action = document.querySelector('.wizard-main-action')!.getBoundingClientRect()
      return {
        documentWidth: document.documentElement.scrollWidth,
        pageContained: pageRect.left >= 0 && pageRect.right <= window.innerWidth,
        mascotContained: mascot.left >= pageRect.left && mascot.right <= pageRect.right,
        actionVisible: action.top >= 0 && action.bottom <= window.innerHeight,
      }
    })
    expect(introLayout).toEqual({
      documentWidth: viewport.width,
      pageContained: true,
      mascotContained: true,
      actionVisible: true,
    })

    if (viewport.width === 390) {
      await page.screenshot({ path: 'docs/capturas/agregar-medicamento-inicio-390x844.png' })
    }

    await page.getByRole('button', { name: 'Comenzar' }).click()
    await expect(page.getByRole('heading', { name: '¿Cómo se llama el medicamento?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Regresar' })).toBeInViewport()
    await expect(page.getByRole('img', { name: 'TUGA' })).toBeInViewport()

    const stepLayout = await page.evaluate(() => {
      const pageRect = document.querySelector('.medication-wizard-page')!.getBoundingClientRect()
      const logo = document.querySelector('.medication-wizard-logo')!.getBoundingClientRect()
      const action = document.querySelector('.wizard-main-action')!.getBoundingClientRect()
      return {
        documentWidth: document.documentElement.scrollWidth,
        logoCentered: Math.abs((logo.left + logo.right) / 2 - (pageRect.left + pageRect.right) / 2) <= 1,
        actionVisible: action.top >= 0 && action.bottom <= window.innerHeight,
        buttons: [...document.querySelectorAll<HTMLElement>('.wizard-header-button')]
          .every((button) => button.getBoundingClientRect().width >= 48 && button.getBoundingClientRect().height >= 48),
      }
    })
    expect(stepLayout).toEqual({
      documentWidth: viewport.width,
      logoCentered: true,
      actionVisible: true,
      buttons: true,
    })

    if (viewport.width === 390) {
      await page.screenshot({ path: 'docs/capturas/agregar-medicamento-paso-1-390x844.png' })
      await page.screenshot({ path: testInfo.outputPath('agregar-medicamento-paso-1.png'), fullPage: true })
    }

    await page.getByLabel('Nombre del medicamento').fill('Losartán')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Cantidad indicada').fill('1')
    await page.getByLabel('Presentación indicada').selectOption('tableta')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByLabel('Hora 1').fill('08:00')
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()

    await expect(page.getByRole('heading', { name: '¿Por cuánto tiempo lo tomarás?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guardar medicamento' })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Regresar' })).toBeInViewport()
    await expect(page.getByRole('img', { name: 'TUGA' })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width)

    if (viewport.width === 390) {
      await page.screenshot({ path: 'docs/capturas/agregar-medicamento-paso-6-390x844.png' })
    }
  }
})
