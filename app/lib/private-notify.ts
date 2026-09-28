import webpush from 'web-push'
import { pool } from '@/app/lib/db'

// Neuigkeiten-Glocke + Push-Benachrichtigungen.
//
// notify() macht zwei Dinge:
//  1. Eintrag in private_notifications → erscheint in der Glocke (auf allen Geräten)
//  2. Push an alle registrierten Geräte des Accounts → klingelt auch bei geschlossener Seite
//
// Push braucht drei Umgebungsvariablen (einmalig auf dem Server erzeugen, siehe Anleitung):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (z.B. mailto:deine@mail.de)
// Fehlen sie, funktioniert die Glocke trotzdem — nur ohne Push.

export type NotifyKind = 'file' | 'reminder' | 'alarm' | 'timer' | 'event' | 'exam' | 'homework' | 'news' | 'sport' | 'system'

export interface NotifyInput {
  kind: NotifyKind
  title: string
  body?: string
  url?: string
  /** Gerät, von dem die Aktion kam (bekommt dann keinen Hinweis) */
  deviceId?: string | null
  /** Wecker/Timer: Push soll dauerhaft sichtbar bleiben und klingeln */
  urgent?: boolean
  /** Eindeutiger Schlüssel gegen doppelte Hinweise (z.B. "event:12:2026-09-30T08:00") */
  dedupeKey?: string
  /** Push mit gleichem Tag ersetzt den vorherigen (z.B. viele Fotos → nur ein Hinweis) */
  tag?: string
}

let vapidReady: boolean | null = null
function pushConfigured(): boolean {
  if (vapidReady !== null) return vapidReady
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return (vapidReady = false)
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@seekclan.de', pub, priv)
    vapidReady = true
  } catch (err) {
    console.error('Push: VAPID-Schlüssel ungültig', err)
    vapidReady = false
  }
  return vapidReady
}

export function vapidPublicKey(): string | null {
  return pushConfigured() ? process.env.VAPID_PUBLIC_KEY! : null
}

/** Hinweis anlegen + Push senden. Gibt false zurück, wenn es ein Duplikat war. */
export async function notify(userId: string, n: NotifyInput): Promise<boolean> {
  if (n.dedupeKey) {
    const r = await pool.query(
      `INSERT INTO private_notify_sent (key) VALUES ($1) ON CONFLICT (key) DO NOTHING RETURNING key`,
      [n.dedupeKey]
    )
    if (!r.rows[0]) return false
  }

  await pool.query(
    `INSERT INTO private_notifications (user_id, kind, title, body, url, device_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, n.kind, n.title.slice(0, 200), n.body?.slice(0, 1000) ?? null, n.url ?? null, n.deviceId ?? null]
  )

  await sendPush(userId, {
    title: n.title,
    body: n.body ?? '',
    url: n.url ?? '/private',
    kind: n.kind,
    urgent: !!n.urgent,
    tag: n.tag ?? n.dedupeKey ?? `${n.kind}-${Date.now()}`,
  }, n.deviceId ?? null)
  return true
}

export async function sendPush(
  userId: string,
  payload: Record<string, unknown>,
  skipDeviceId: string | null = null
): Promise<number> {
  if (!pushConfigured()) return 0
  const subs = await pool.query(
    `SELECT id, endpoint, p256dh, auth FROM private_push_subscriptions
     WHERE user_id = $1 AND ($2::text IS NULL OR device_id IS DISTINCT FROM $2)`,
    [userId, skipDeviceId]
  )
  let sent = 0
  await Promise.all(subs.rows.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 6, urgency: payload.urgent ? 'high' : 'normal' }
      )
      sent++
      await pool.query('UPDATE private_push_subscriptions SET last_used_at = NOW() WHERE id = $1', [s.id])
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      // 404/410 = Gerät hat Push abbestellt oder die App gelöscht → Eintrag entfernen
      if (status === 404 || status === 410) {
        await pool.query('DELETE FROM private_push_subscriptions WHERE id = $1', [s.id])
      } else {
        console.error('Push fehlgeschlagen', status, (err as Error).message)
      }
    }
  }))
  return sent
}