'use client'

// Push-Benachrichtigungen im Browser an-/abmelden.
// iPhone/iPad: funktioniert nur, wenn die Seite über "Teilen → Zum Home-Bildschirm"
// als App installiert wurde (Apple-Vorgabe seit iOS 16.4).

import { getDeviceId } from './device'

export type PushState = 'unsupported' | 'ios-install' | 'not-configured' | 'denied' | 'off' | 'on'

const SW_URL = '/private-sw.js'

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: '/private' })
  } catch (err) {
    console.warn('Service Worker nicht registriert', err)
    return null
  }
}

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function getPushState(): Promise<{ state: PushState; publicKey: string | null }> {
  if (typeof window === 'undefined') return { state: 'unsupported', publicKey: null }
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!supported) return { state: isIos() && !isStandalone() ? 'ios-install' : 'unsupported', publicKey: null }

  const res = await fetch(`/api/private/push?device=${encodeURIComponent(getDeviceId())}`, { cache: 'no-store' })
  const info = res.ok ? await res.json() : { configured: false, publicKey: null, subscribed: false }
  if (!info.configured) return { state: 'not-configured', publicKey: null }
  if (Notification.permission === 'denied') return { state: 'denied', publicKey: info.publicKey }

  const reg = await navigator.serviceWorker.getRegistration('/private')
  const sub = await reg?.pushManager.getSubscription()
  return { state: sub && info.subscribed ? 'on' : 'off', publicKey: info.publicKey }
}

export async function enablePush(publicKey: string): Promise<PushState> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready)
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
  }
  const res = await fetch('/api/private/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), device_id: getDeviceId() }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Anmeldung fehlgeschlagen')
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/private')
  const sub = await reg?.pushManager.getSubscription()
  await fetch('/api/private/push', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub ? { endpoint: sub.endpoint } : { device_id: getDeviceId() }),
  })
  await sub?.unsubscribe().catch(() => {})
  return 'off'
}