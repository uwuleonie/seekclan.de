import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { getBalance, getHalloweenBySlug, getUser, isAdmin, shopOpen } from '@/app/lib/halloween'

// POST /api/halloween/buy   Body: { slug, itemId }
// Kauft einen Artikel mit Süßigkeiten. Alles in einer Transaktion mit Sperre pro Spieler,
// damit doppeltes Klicken nicht doppelt abbucht.
// Belohnung „mailbox“: das Item kommt sofort in die Ingame-Mailbox (Minecraft-Account muss verknüpft sein).
// Belohnung „manual“: Kauf steht in /admin2/halloween → Käufe und wird von Hand vergeben.

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return csrfError()
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Bitte einloggen' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { slug?: string; itemId?: number }
  const slug = String(body.slug || '')
  const itemId = Number(body.itemId)
  if (!/^halloween-\d{4}$/.test(slug) || !Number.isInteger(itemId)) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

  const ev = await getHalloweenBySlug(slug)
  // Vor dem Start dürfen Administrator/Owner den Shop schon testen
  const adminPreview = !!ev && isAdmin(user) && ev.active && ev.enabled && Date.now() < new Date(ev.shopUntil || ev.endsAt).getTime()
  if (!ev || (!shopOpen(ev) && !adminPreview)) return NextResponse.json({ error: 'Der Shop ist gerade geschlossen' }, { status: 409 })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Sperre pro Spieler + Event bis zum Ende der Transaktion
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hw-buy:${ev.id}:${user.id}`])

    const ir = await client.query('SELECT * FROM hw_items WHERE id = $1 AND event_id = $2 AND active = TRUE FOR UPDATE', [itemId, ev.id])
    const item = ir.rows[0]
    if (!item) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Diesen Artikel gibt es nicht mehr' }, { status: 404 }) }

    if (item.stock != null) {
      const sold = (await client.query('SELECT COUNT(*)::int AS n FROM hw_purchases WHERE item_id = $1', [itemId])).rows[0].n
      if (sold >= item.stock) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Leider ausverkauft' }, { status: 409 }) }
    }
    if (item.per_user_limit != null) {
      const mine = (await client.query('SELECT COUNT(*)::int AS n FROM hw_purchases WHERE item_id = $1 AND user_id = $2', [itemId, user.id])).rows[0].n
      if (mine >= item.per_user_limit) { await client.query('ROLLBACK'); return NextResponse.json({ error: `Du kannst diesen Artikel nur ${item.per_user_limit}× kaufen` }, { status: 409 }) }
    }

    const bal = (await client.query(
      `SELECT (SELECT COALESCE(SUM(candies), 0) FROM hw_finds WHERE event_id = $1 AND user_id = $2)
            - (SELECT COALESCE(SUM(price), 0) FROM hw_purchases WHERE event_id = $1 AND user_id = $2) AS n`,
      [ev.id, user.id]
    )).rows[0].n
    if (Number(bal) < item.price) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Nicht genug Süßigkeiten' }, { status: 409 }) }

    let status = 'offen'
    if (item.reward_type === 'mailbox') {
      if (!user.minecraft_uuid) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Verknüpfe zuerst deinen Minecraft-Account, damit wir dir das Item schicken können' }, { status: 409 }) }
      const t = (await client.query('SELECT item_data FROM admin_item_templates WHERE id = $1', [item.template_id])).rows[0]
      if (!t) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Dieses Item ist gerade nicht verfügbar – sag dem Team Bescheid' }, { status: 409 }) }
      await client.query(
        'INSERT INTO mailbox_items (receiver_uuid, receiver_name, item_data, sender_name) VALUES ($1, $2, $3, $4)',
        [user.minecraft_uuid, user.minecraft_username || user.username, t.item_data, 'Halloween-Shop']
      )
      status = 'zugestellt'
    }

    await client.query(
      'INSERT INTO hw_purchases (event_id, item_id, item_name, user_id, price, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [ev.id, itemId, item.name, user.id, item.price, status]
    )
    await client.query('COMMIT')

    const balance = await getBalance(ev.id, user.id)
    return NextResponse.json({
      ok: true, status, balance,
      message: status === 'zugestellt' ? 'Gekauft! Das Item liegt in deiner Ingame-Mailbox.' : 'Gekauft! Das Team gibt dir die Belohnung bald.',
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('Halloween buy:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  } finally {
    client.release()
  }
}