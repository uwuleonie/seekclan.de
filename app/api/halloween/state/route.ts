import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { cleanPath, countPumpkins, getBalance, getCurrentHalloween, getUser, isAdmin, isRunning, rowToPumpkin } from '@/app/lib/halloween'

// GET /api/halloween/state?path=/clan[&place=1]
// Für die Kürbis-Ebene auf jeder Seite:
//  • event    – das aktuelle Halloween-Event (oder null → nichts anzeigen)
//  • pumpkins – Kürbisse auf dieser Seite, die der Spieler noch nicht gefunden hat
//  • me       – eingeloggt?, gefunden / gesamt, Süßigkeiten
//  • canPlace – Administrator/Owner dürfen Kürbisse platzieren
// Mit place=1 (nur Admins) kommen alle Kürbisse der Seite, auch schon gefundene.
// Vor dem Start können Administrator/Owner schon alles testen (preview: true) – danach in /admin2/halloween „Testdaten löschen“.

export async function GET(req: NextRequest) {
  const path = cleanPath(req.nextUrl.searchParams.get('path')) || '/'
  const user = await getUser(req)
  const admin = isAdmin(user)
  const place = admin && req.nextUrl.searchParams.get('place') === '1'

  const event = await getCurrentHalloween()
  if (!event) return NextResponse.json({ event: null, canPlace: admin }, { headers: { 'Cache-Control': 'no-store' } })

  const running = isRunning(event)
  const publicEvent = { id: event.id, slug: event.slug, title: event.title, accent: event.accent, startsAt: event.startsAt, endsAt: event.endsAt, running, preview: !running && admin }

  // Vor dem Start sehen nur Administrator/Owner die Kürbisse (zum Testen), alle anderen nichts
  if (!running && !admin) {
    return NextResponse.json({ event: publicEvent, pumpkins: [], me: null, canPlace: admin }, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    // Offene Fragen, deren Zeit längst abgelaufen ist, als „Zeit abgelaufen“ abschließen
    if (user) {
      await pool.query(
        `UPDATE hw_finds SET result = 'timeout', answered_at = NOW()
         WHERE event_id = $1 AND user_id = $2 AND result = 'pending' AND deadline < NOW() - INTERVAL '10 seconds'`,
        [event.id, user.id]
      )
    }

    const pr = await pool.query(
      `SELECT p.*, ${user ? 'EXISTS (SELECT 1 FROM hw_finds f WHERE f.pumpkin_id = p.id AND f.user_id = $3)' : 'FALSE'} AS found,
              (SELECT COUNT(*) FROM hw_finds f2 WHERE f2.pumpkin_id = p.id)::int AS found_by
       FROM hw_pumpkins p
       WHERE p.event_id = $1 AND p.page_path = $2 AND p.active = TRUE
       ORDER BY p.id`,
      user ? [event.id, path, user.id] : [event.id, path]
    )
    const pumpkins = pr.rows
      .filter(x => place || !x.found)
      .map(x => ({ ...rowToPumpkin(x), found: !!x.found, ...(place ? { foundBy: x.found_by } : {}) }))
      // Nur Admins brauchen Schwierigkeit/Position im Detail – für alle anderen reicht das Nötigste
      .map(p => (place ? p : { id: p.id, anchor: p.anchor, x: p.x, y: p.y, size: p.size }))

    const total = await countPumpkins(event.id)
    const me = user ? { loggedIn: true, ...(await getBalance(event.id, user.id)), total } : { loggedIn: false, total }

    return NextResponse.json({ event: publicEvent, pumpkins, me, canPlace: admin }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Halloween state:', (err as Error).message)
    return NextResponse.json({ event: null, canPlace: admin }, { headers: { 'Cache-Control': 'no-store' } })
  }
}