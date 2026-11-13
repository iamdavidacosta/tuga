import { expect, test } from '@playwright/test'

test('registra la PWA con un único Service Worker', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    const manifestResponse = await fetch('/manifest.webmanifest')
    const manifest = await manifestResponse.json()
    return {
      scriptUrl: registration.active?.scriptURL ?? '',
      display: manifest.display,
      startUrl: manifest.start_url,
      icon: manifest.icons?.[0]?.src,
    }
  })

  expect(result).toEqual(expect.objectContaining({
    display: 'standalone',
    startUrl: '/hoy',
    icon: '/assets/tuga/app-icon.png',
  }))
  expect(result.scriptUrl).toMatch(/\/sw\.js$/)
})
