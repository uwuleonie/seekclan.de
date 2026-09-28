import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import { apiError, csrf, forbidden } from '@/app/lib/private-crud'
import { vapidPublicKey } from '@/app/lib/private-notify'

// Push-Benachrichtigungen (Wecker, Reminder, Termine …) für dieses Gerät an-/abmelden
// GET    /api/private/push?device=<id> → { publicKey, configured, subscribed }
// POST   /api/private/push { subscription, device_id } → Gerät anmelden
// DELETE /api/private/push { endpoint }                → Gerät abmelden

export async function GET(req: NextRequest) {
  try {
    const user = await getPrivateUser(req)
    if (!user) return forbidden()
    const device = req.nextUrl.searchParams.get('device')
    let subscribed = false
    if (device) {
      const r = await pool.query('SELECT 1 FROM private_push_subscriptions WHERE user_id = $1 AND device_id = $2 LIMIT 1', [user.id, device])
      subscribed = !!r.rows[0]
    }
    const publicKey = vapidPublicKey()
    return NextResponse.json({ publicKey, configured: !!publicKey, subscribed })
  } catch (err) {
    return apiError(err, 'GET push')
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return csrf()
    const user = await getPrivateUser(req)
    if (!user) return forbidden()
    const b = await req.json().catch(() => null)
    const sub = b?.subscription
    const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : ''
    const p256dh = sub?.keys?.p256dh
    const auth = sub?.keys?.auth
    if (!/^https:\/\//.test(endpoint) || typeof p256dh !== 'string' || typeof auth !== 'string') {
      return NextResponse.json({ error: 'Ungültige Push-Anmeldung' }, { status: 400 })
    }
    const deviceId = typeof b.device_id === 'string' ? b.device_id.slice(0, 64) : null
    const ua = (req.headers.get('user-agent') || '').slice(0, 300)

    await pool.query(
      `INSERT INTO private_push_subscriptions (user_id, endpoint, p256dh, auth, device_id, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
             device_id = EXCLUDED.device_id, user_agent = EXCLUDED.user_agent, last_used_at = NOW()`,
      [user.id, endpoint.slice(0, 1000), p256dh.slice(0, 200), auth.slice(0, 100), deviceId, ua]
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err, 'POST push')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return csrf()
    const user = await getPrivateUser(req)
    if (!user) return forbidden()
    const b = await req.json().catch(() => null)
    if (typeof b?.endpoint === 'string') {
      await pool.query('DELETE FROM private_push_subscriptions WHERE user_id = $1 AND endpoint = $2', [user.id, b.endpoint])
    } else if (typeof b?.device_id === 'string') {
      await pool.query('DELETE FROM private_push_subscriptions WHERE user_id = $1 AND device_id = $2', [user.id, b.device_id])
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiError(err, 'DELETE push')
  }
}