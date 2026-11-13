import { expect, test } from '@playwright/test'

test('la bienvenida ofrece el inicio de sesión con Google', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Bienvenido a TUGA' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Continuar con Google' }),
  ).toBeVisible()
  await expect(
    page.getByText('Usaremos tu cuenta de Google para identificarte de forma segura.'),
  ).toBeVisible()
})

test('protege una ruta privada sin una sesión autenticada', async ({ page }) => {
  await page.goto('/hoy')

  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByRole('heading', { name: 'Bienvenido a TUGA' }),
  ).toBeVisible()
})

test('explica un error de OAuth sin mostrar detalles internos', async ({ page }) => {
  await page.goto(
    '/auth/callback#error=server_error&error_description=detalle%20interno',
  )

  await expect(
    page.getByRole('heading', { name: 'No pudimos iniciar tu sesión' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toContainText(
    'No pudimos completar el inicio de sesión.',
  )
  await expect(page.getByText('detalle interno')).toHaveCount(0)
})

test('las rutas públicas no generan errores de consola', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  for (const route of [
    '/',
    '/auth/callback#error=server_error',
    '/hoy',
  ]) {
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
  }

  expect(errors).toEqual([])
})

for (const width of [320, 360, 390, 430]) {
  test(`mantiene el acceso visible a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')

    await expect(
      page.getByRole('button', { name: 'Continuar con Google' }),
    ).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )

    expect(hasHorizontalOverflow).toBe(false)
  })
}

test('admite texto ampliado al 200 % sin desplazamiento horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })

  await expect(
    page.getByRole('button', { name: 'Continuar con Google' }),
  ).toBeVisible()

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )

  expect(hasHorizontalOverflow).toBe(false)
})
