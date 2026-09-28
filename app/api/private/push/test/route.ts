import { NextRequest, NextResponse } from 'next/server'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import { apiError, csrf, forbidden } from '@/app/lib/private-crud'
import { sendPush } from '@/app/lib/private-notify'

// POST /api/private/push/test — Test-Benachrichtigung an alle Geräte des Accounts
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req)) return csrf()
    const user = await getPrivateUser(req)
    if (!user) return forbidden()
    const sent = await sendPush(user.id, {
      title: 'Test-Benachrichtigung',
      body: 'Push funktioniert. Wecker und Reminder kommen jetzt auch bei geschlossener Seite an.',
      url: '/private',
      kind: 'system',
      tag: 'push-test',
    })
    return NextResponse.json({ ok: true, sent })
  } catch (err) {
    return apiError(err, 'POST push/test')
  }
}