import { getSupabaseClient } from '../../services/supabase/client'
import { registerTugaServiceWorker } from '../../services/pwa/serviceWorker'
import type { PushNotificationState, PushSupport } from './types'

export class NotificationServiceError extends Error {}

interface BrowserCapabilities {
  secureContext: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  isIos: boolean
  isStandalone: boolean
}

export function detectPushSupport(capabilities: BrowserCapabilities): PushSupport {
  if (!capabilities.secureContext) {
    return { availability: 'insecure-context', message: 'Los recordatorios requieren una conexión segura (HTTPS).' }
  }
  if (!capabilities.hasServiceWorker || !capabilities.hasPushManager || !capabilities.hasNotification) {
    return { availability: 'unsupported', message: 'Este navegador no admite recordatorios Web Push.' }
  }
  if (capabilities.isIos && !capabilities.isStandalone) {
    return {
      availability: 'requires-installation',
      message: 'En iPhone, primero agrega TUGA a la pantalla de inicio y ábrela desde allí.',
    }
  }
  return { availability: 'available', message: 'Este dispositivo puede recibir recordatorios.' }
}

function browserCapabilities(): BrowserCapabilities {
  const userAgent = navigator.userAgent
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean }
  return {
    secureContext: window.isSecureContext,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIos: /iPhone|iPad|iPod/i.test(userAgent),
    isStandalone: (typeof window.matchMedia === 'function'
      && window.matchMedia('(display-mode: standalone)').matches)
      || standaloneNavigator.standalone === true,
  }
}

export function getPushSupport(): PushSupport {
  return detectPushSupport(browserCapabilities())
}

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  let decoded: string
  try {
    decoded = window.atob(base64)
  } catch {
    throw new NotificationServiceError('La clave pública de recordatorios no es válida.')
  }
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length))
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index)
  return bytes
}

function deviceLabel(): string {
  const userAgent = navigator.userAgent
  if (/Android/i.test(userAgent)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iPhone o iPad'
  if (/Windows/i.test(userAgent)) return 'Computador Windows'
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'Computador Mac'
  return 'Navegador web'
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport().availability !== 'available') return null
  const registration = await registerTugaServiceWorker()
  return registration.pushManager.getSubscription()
}

function subscriptionKeys(subscription: PushSubscription): { p256dh: string; auth: string } {
  const json = subscription.toJSON()
  if (!json.keys?.p256dh || !json.keys.auth) {
    throw new NotificationServiceError('El navegador no entregó las claves de la suscripción.')
  }
  return { p256dh: json.keys.p256dh, auth: json.keys.auth }
}

export async function readPushNotificationState(): Promise<PushNotificationState> {
  const support = getPushSupport()
  if (support.availability !== 'available') {
    return {
      support,
      permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
      currentDeviceActive: false,
      activeDevices: 0,
      lastTestAt: null,
      lastTestStatus: null,
    }
  }
  const subscription = await currentSubscription()
  const { data, error } = await getSupabaseClient().rpc('get_push_notification_status', {
    p_endpoint: subscription?.endpoint ?? '',
  })
  if (error) throw new NotificationServiceError('No pudimos consultar tus recordatorios.')
  const status = data[0]
  return {
    support,
    permission: Notification.permission,
    currentDeviceActive: Boolean(subscription && status?.current_device_active),
    activeDevices: Number(status?.active_devices ?? 0),
    lastTestAt: status?.last_test_at ?? null,
    lastTestStatus: status?.last_test_status ?? null,
  }
}

export async function enablePushNotifications(): Promise<void> {
  const support = getPushSupport()
  if (support.availability !== 'available') throw new NotificationServiceError(support.message)
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? ''
  if (!vapidPublicKey) {
    throw new NotificationServiceError('Los recordatorios todavía no están configurados en TUGA.')
  }
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission
  if (permission !== 'granted') {
    throw new NotificationServiceError(
      permission === 'denied'
        ? 'El permiso está bloqueado. Puedes habilitarlo en la configuración del navegador.'
        : 'No se activaron los recordatorios.',
    )
  }

  const registration = await registerTugaServiceWorker()
  let subscription = await registration.pushManager.getSubscription()
  let createdNow = false
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
    createdNow = true
  }
  try {
    const keys = subscriptionKeys(subscription)
    const { error } = await getSupabaseClient().rpc('upsert_push_subscription', {
      p_endpoint: subscription.endpoint,
      p_p256dh: keys.p256dh,
      p_auth_key: keys.auth,
      p_expiration_time: subscription.expirationTime,
      p_device_label: deviceLabel(),
    })
    if (error) throw error
  } catch {
    if (createdNow) await subscription.unsubscribe()
    throw new NotificationServiceError('No pudimos registrar este dispositivo. Inténtalo nuevamente.')
  }
}

export async function disablePushNotifications(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  const { error } = await getSupabaseClient().rpc('deactivate_push_subscription', {
    p_endpoint: subscription.endpoint,
  })
  if (error) throw new NotificationServiceError('No pudimos desactivar los recordatorios.')
  await subscription.unsubscribe()
}

export async function sendPushNotificationTest(): Promise<string> {
  const { data, error } = await getSupabaseClient().functions.invoke('push-notifications', {
    body: { mode: 'test' },
  })
  if (error) throw new NotificationServiceError('No pudimos realizar la prueba. Inténtalo más tarde.')
  const message = data && typeof data === 'object' && 'message' in data ? data.message : null
  return typeof message === 'string'
    ? message
    : 'El servicio procesó la prueba. La recepción depende del dispositivo y del navegador.'
}

export async function postponeDoseReminder(occurrenceId: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('postpone_dose_occurrence', {
    p_occurrence_id: occurrenceId,
  })
  if (error) {
    const message = error.code === 'P0001'
      ? 'Esta toma ya alcanzó el máximo de tres recordatorios pospuestos.'
      : 'No pudimos programar el recordatorio de 15 minutos.'
    throw new NotificationServiceError(message)
  }
  return data
}
