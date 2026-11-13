import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('recursos PWA seguros', () => {
  it('declara un manifest instalable con el icono oficial', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/manifest.webmanifest'), 'utf8')) as {
      display: string
      start_url: string
      icons: Array<{ src: string; sizes: string }>
    }
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/hoy')
    expect(manifest.icons).toContainEqual(expect.objectContaining({
      src: '/assets/tuga/app-icon.png',
      sizes: '1254x1254',
    }))
    expect(statSync(resolve('public/assets/tuga/app-icon.png')).size).toBeGreaterThan(0)
  })

  it('usa un único Service Worker y solo precachea recursos visuales públicos', () => {
    const serviceWorker = readFileSync(resolve('public/sw.js'), 'utf8')
    expect(serviceWorker).toContain("self.addEventListener('push'")
    expect(serviceWorker).toContain("self.addEventListener('notificationclick'")
    expect(serviceWorker).not.toContain('supabase.co')
    expect(serviceWorker).not.toContain('/rest/v1')
    expect(serviceWorker).not.toContain('dose_occurrences')
  })
})
