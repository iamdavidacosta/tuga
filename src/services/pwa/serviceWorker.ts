let registrationPromise: Promise<ServiceWorkerRegistration> | null = null

export function canRegisterServiceWorker(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

export function registerTugaServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!canRegisterServiceWorker()) {
    return Promise.reject(new Error('Este navegador no admite el Service Worker de TUGA.'))
  }
  registrationPromise ??= navigator.serviceWorker.register('/sw.js', { scope: '/' })
  return registrationPromise
}

export function startTugaServiceWorker(): void {
  if (!canRegisterServiceWorker()) return
  window.addEventListener('load', () => {
    void registerTugaServiceWorker().catch(() => {
      // La pantalla de configuración mostrará el diagnóstico cuando la persona lo solicite.
    })
  }, { once: true })
}
