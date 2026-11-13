export type PushAvailability =
  | 'available'
  | 'requires-installation'
  | 'insecure-context'
  | 'unsupported'

export interface PushSupport {
  availability: PushAvailability
  message: string
}

export interface PushNotificationState {
  support: PushSupport
  permission: NotificationPermission | 'unsupported'
  currentDeviceActive: boolean
  activeDevices: number
  lastTestAt: string | null
  lastTestStatus: string | null
}
