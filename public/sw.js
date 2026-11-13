const STATIC_CACHE = 'tuga-static-v1'
const SAFE_STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/assets/tuga/app-icon.png',
  '/assets/tuga/iconos/recordatorio.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(SAFE_STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (
    event.request.method !== 'GET'
    || url.origin !== self.location.origin
    || !SAFE_STATIC_ASSETS.includes(url.pathname)
  ) return

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  const title = typeof payload.title === 'string' ? payload.title : 'TUGA te recuerda'
  const body = typeof payload.body === 'string'
    ? payload.body
    : 'Tienes una toma pendiente. Abre TUGA para revisarla.'
  const relativeUrl = typeof payload.data?.url === 'string' && payload.data.url.startsWith('/')
    ? payload.data.url
    : '/hoy'

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/assets/tuga/app-icon.png',
    tag: typeof payload.tag === 'string' ? payload.tag : 'tuga-reminder',
    renotify: false,
    data: { url: relativeUrl },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const relativeUrl = typeof event.notification.data?.url === 'string'
    && event.notification.data.url.startsWith('/')
    ? event.notification.data.url
    : '/hoy'
  const destination = new URL(relativeUrl, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin)
      if (existing) {
        await existing.navigate(destination)
        return existing.focus()
      }
      return self.clients.openWindow(destination)
    }),
  )
})
