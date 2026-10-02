import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { countPumpkins, getBalance, getHalloweenBySlug, getUser, isAdmin, isRunning, rowToItem, shopOpen } from '@/app/lib/halloween'

// GET /api/halloween/shop?slug=halloween-2026
// Alles für die Event-Seite /halloween/2026: Event-Infos, Shop-Artikel, eigener Stand, Rangliste, Musik.
// Ist das Event beendet (in /admin2/events „Sofort beenden“), kommt event: null.

export async function GET(req: NextRequest) {
  const slug = String(req.nextUrl.searchParams.get('slug') || '')
  if (!/^halloween-\d{4}$/.test(slug)) return NextResponse.json({ event: null }, { status: 404 })
  const ev = await getHalloweenBySlug(slug)
  if (!ev || !ev.active || !ev.enabled) return NextResponse.json({ event: null })

  const user = await getUser(req)
  try {
    const [itemsR, lbR, playersR, total] = await Promise.all([
      pool.query(
        `SELECT i.*,
                (SELECT COUNT(*) FROM hw_purchases p WHERE p.item_id = i.id)::int AS sold
                ${user ? ', (SELECT COUNT(*) FROM hw_purchases p WHERE p.item_id = i.id AND p.user_id = $2)::int AS mine' : ''}
         FROM hw_items i WHERE i.event_id = $1 AND i.active = TRUE ORDER BY i.position ASC, i.id ASC`,
        user ? [ev.id, user.id] : [ev.id]
      ),
      pool.query(
        `SELECT u.username, u.minecraft_username, SUM(f.candies)::int AS candies, COUNT(*)::int AS found
         FROM hw_finds f JOIN users u ON u.id = f.user_id
         WHERE f.event_id = $1
         GROUP BY u.id, u.username, u.minecraft_username
         ORDER BY candies DESC, found DESC, MIN(f.started_at) ASC
         LIMIT 10`,
        [ev.id]
      ),
      pool.query('SELECT COUNT(DISTINCT user_id)::int AS n FROM hw_finds WHERE event_id = $1', [ev.id]),
      countPumpkins(ev.id),
    ])

    const items = itemsR.rows.map(x => {
      const it = rowToItem(x)
      return {
        id: it.id, name: it.name, description: it.description, image: it.image, price: it.price,
        rewardType: it.rewardType,
        left: it.stock == null ? null : Math.max(0, it.stock - x.sold),
        perUserLimit: it.perUserLimit, mine: x.mine ?? 0,
      }
    })

    let me = null
    if (user) {
      const bal = await getBalance(ev.id, user.id)
      const pr = await pool.query(
        'SELECT id, item_name, price, status, created_at FROM hw_purchases WHERE event_id = $1 AND user_id = $2 ORDER BY created_at DESC',
        [ev.id, user.id]
      )
      me = {
        loggedIn: true, username: user.username, hasMinecraft: !!user.minecraft_uuid, ...bal, total,
        purchases: pr.rows.map(p => ({ id: Number(p.id), name: p.item_name, price: p.price, status: p.status, at: p.created_at })),
      }
    }

    return NextResponse.json({
      event: {
        slug: ev.slug, title: ev.title, subtitle: ev.subtitle, accent: ev.accent,
        startsAt: ev.startsAt, endsAt: ev.endsAt, shopUntil: ev.shopUntil || ev.endsAt,
        running: isRunning(ev), shopOpen: shopOpen(ev), music: ev.music,
        // Administrator/Owner können vor dem Start schon testen
        preview: !isRunning(ev) && isAdmin(user) && Date.now() < new Date(ev.shopUntil || ev.endsAt).getTime(),
        candy: { find: ev.candyFind, ...ev.candy },
      },
      items,
      me,
      leaderboard: lbR.rows.map(r => ({ name: r.minecraft_username || r.username, candies: r.candies, found: r.found })),
      stats: { players: playersR.rows[0].n, pumpkins: total },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Halloween shop:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}