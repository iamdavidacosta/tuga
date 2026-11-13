import { beforeEach, describe, expect, it, vi } from 'vitest'

const subscription = vi.hoisted(() => ({
  endpoint: 'https://push.example.test/device-one',
  expirationTime: null,
  toJSON: vi.fn(() => ({ keys: { p256dh: 'A'.repeat(65), auth: 'B'.repeat(16) } })),
  unsubscribe: vi.fn(),
}))
const pushManager = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  subscribe: vi.fn(),
}))
const supabase = vi.hoisted(() => ({
  rpc: vi.fn(),
  functions: { invoke: vi.fn() },
}))

vi.mock('../../services/supabase/client', () => ({ getSupabaseClient: () => supabase }))
vi.mock('../../services/pwa/serviceWorker', () => ({
  registerTugaServiceWorker: async () => ({ pushManager }),
}))

import {
  detectPushSupport,
  disablePushNotifications,
  enablePushNotifications,
  sendPushNotificationTest,
  urlBase64ToUint8Array,
} from './notificationService'

describe('suscripción Web Push', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQ')
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} })
    vi.stubGlobal('PushManager', class PushManager {})
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    })
    pushManager.getSubscription.mockResolvedValue(null)
    pushManager.subscribe.mockResolvedValue(subscription)
    subscription.unsubscribe.mockResolvedValue(true)
    supabase.rpc.mockResolvedValue({ data: 'subscription-id', error: null })
    supabase.functions.invoke.mockResolvedValue({
      data: { message: 'El servicio aceptó la prueba para 1 dispositivo.' },
      error: null,
    })
  })

  it('detecta navegador incompatible e instalación requerida en iPhone', () => {
    expect(detectPushSupport({
      secureContext: true,
      hasServiceWorker: false,
      hasPushManager: true,
      hasNotification: true,
      isIos: false,
      isStandalone: false,
    }).availability).toBe('unsupported')
    expect(detectPushSupport({
      secureContext: true,
      hasServiceWorker: true,
      hasPushManager: true,
      hasNotification: true,
      isIos: true,
      isStandalone: false,
    }).availability).toBe('requires-installation')
  })

  it('convierte la clave VAPID pública sin exponer una clave privada', () => {
    expect(urlBase64ToUint8Array('QUJD')).toEqual(new Uint8Array([65, 66, 67]))
  })

  it('solicita permiso por acción explícita y registra el dispositivo sin user_id', async () => {
    await enablePushNotifications()

    expect(Notification.requestPermission).toHaveBeenCalledOnce()
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(supabase.rpc).toHaveBeenCalledWith('upsert_push_subscription', expect.objectContaining({
      p_endpoint: subscription.endpoint,
      p_p256dh: 'A'.repeat(65),
      p_auth_key: 'B'.repeat(16),
    }))
    expect(supabase.rpc.mock.calls[0]?.[1]).not.toHaveProperty('user_id')
  })

  it('desactiva primero en la base y luego en el navegador', async () => {
    pushManager.getSubscription.mockResolvedValue(subscription)
    await disablePushNotifications()
    expect(supabase.rpc).toHaveBeenCalledWith('deactivate_push_subscription', {
      p_endpoint: subscription.endpoint,
    })
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
  })

  it('realiza la prueba mediante la Edge Function autenticada', async () => {
    await expect(sendPushNotificationTest()).resolves.toContain('aceptó la prueba')
    expect(supabase.functions.invoke).toHaveBeenCalledWith('push-notifications', {
      body: { mode: 'test' },
    })
  })
})
