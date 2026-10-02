import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { deleteFile } from '@/app/lib/local-storage'
import { checkRead, checkWrite } from '@/app/lib/home-tiles'
import { parseDate, rowToEvent } from '@/app/lib/site-events'
import { getHalloweenById, rowToItem, rowToPumpkin, rowToQuestion } from '@/app/lib/halloween'
import { intOrNull, storeHwAudio } from '@/app/lib/halloween-admin'

// GET   /api/admin2/halloween/[eventId] → alles für die Verwaltung: Einstellungen, Fragen, Kürbisse, Shop, Käufe, Spieler
// PATCH /api/admin2/halloween/[eventId] → Einstellungen (FormData):
//       enabled, candyFind, candyEasy, candyMedium, candyHard, shopUntil (leer = bis Event-Ende),
//       music (Datei) oder removeMusic = 'true'

type Ctx = { params: Promise<{ eventId: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const id = Number((await ctx.params).eventId)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const hw = await getHalloweenById(id)
  if (!hw) return NextResponse.json({ error: 'Halloween ist für dieses Event nicht eingeschaltet' }, { status: 404 })

  try {
    const [evR, qR, pR, iR, buyR, plR] = await Promise.all([
      pool.query('SELECT * FROM site_events WHERE id = $1', [id]),
      pool.query(
        `SELECT q.*,
                (SELECT COUNT(*) FROM hw_finds f WHERE f.question_id = q.id)::int AS asked,
                (SELECT COUNT(*) FROM hw_finds f WHERE f.question_id = q.id AND f.result = 'correct')::int AS right_count
         FROM hw_questions q WHERE q.event_id = $1 ORDER BY q.difficulty, q.id`, [id]),
      pool.query(
        `SELECT p.*, (SELECT COUNT(*) FROM hw_finds f WHERE f.pumpkin_id = p.id)::int AS found_by
         FROM hw_pumpkins p WHERE p.event_id = $1 ORDER BY p.page_path, p.id`, [id]),
      pool.query(
        `SELECT i.*, (SELECT COUNT(*) FROM hw_purchases b WHERE b.item_id = i.id)::int AS sold
         FROM hw_items i WHERE i.event_id = $1 ORDER BY i.position, i.id`, [id]),
      pool.query(
        `SELECT b.*, u.username, u.minecraft_username
         FROM hw_purchases b JOIN users u ON u.id = b.user_id
         WHERE b.event_id = $1 ORDER BY b.created_at DESC LIMIT 500`, [id]),
      pool.query(
        `SELECT u.id, u.username, u.minecraft_username,
                COUNT(*)::int AS found,
                COALESCE(SUM(f.candies), 0)::int AS earned,
                COUNT(*) FILTER (WHERE f.result = 'correct')::int AS correct,
                COUNT(*) FILTER (WHERE f.result = 'wrong')::int AS wrong,
                COUNT(*) FILTER (WHERE f.result = 'timeout')::int AS timeout,
                (SELECT COALESCE(SUM(b.price), 0) FROM hw_purchases b WHERE b.event_id = $1 AND b.user_id = u.id)::int AS spent,
                MAX(f.started_at) AS last_at
         FROM hw_finds f JOIN users u ON u.id = f.user_id
         WHERE f.event_id = $1
         GROUP BY u.id, u.username, u.minecraft_username
         ORDER BY earned DESC, found DESC`, [id]),
    ])

    let templates: { id: number; name: string }[] = []
    try {
      templates = (await pool.query('SELECT id, name FROM admin_item_templates ORDER BY name')).rows.map(t => ({ id: Number(t.id), name: t.name }))
    } catch { /* Tabelle gibt es nicht → keine Mailbox-Items */ }

    return NextResponse.json({
      event: rowToEvent(evR.rows[0]),
      config: {
        enabled: hw.enabled, candyFind: hw.candyFind, candy: hw.candy,
        shopUntil: hw.shopUntil, music: hw.music,
      },
      questions: qR.rows.map(x => ({ ...rowToQuestion(x), asked: x.asked, rightCount: x.right_count })),
      pumpkins: pR.rows.map(x => ({ ...rowToPumpkin(x), foundBy: x.found_by })),
      items: iR.rows.map(x => ({ ...rowToItem(x), sold: x.sold })),
      purchases: buyR.rows.map(x => ({
        id: Number(x.id), itemId: x.item_id == null ? null : Number(x.item_id), itemName: x.item_name, price: x.price,
        status: x.status, note: x.note || '', at: x.created_at,
        user: x.minecraft_username || x.username, username: x.username,
      })),
      players: plR.rows.map(x => ({
        id: String(x.id), name: x.minecraft_username || x.username, username: x.username,
        found: x.found, earned: x.earned, spent: x.spent, candies: x.earned - x.spent,
        correct: x.correct, wrong: x.wrong, timeout: x.timeout, lastAt: x.last_at,
      })),
      templates,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Serverfehler' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!checkOrigin(req)) return csrfError()
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const id = Number((await ctx.params).eventId)
  const cur = (await pool.query('SELECT * FROM hw_config WHERE event_id = $1', [id])).rows[0]
  if (!cur) return NextResponse.json({ error: 'Halloween ist für dieses Event nicht eingeschaltet' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })

  const val = (k: string, fallback: number) => {
    if (!form.has(k)) return fallback
    return intOrNull(form.get(k), 0, 1000)
  }
  const candyFind = val('candyFind', cur.candy_find)
  const candyEasy = val('candyEasy', cur.candy_easy)
  const candyMedium = val('candyMedium', cur.candy_medium)
  const candyHard = val('candyHard', cur.candy_hard)
  if ([candyFind, candyEasy, candyMedium, candyHard].some(n => n === null)) return NextResponse.json({ error: 'Süßigkeiten: bitte ganze Zahlen von 0 bis 1000' }, { status: 400 })

  const enabled = form.has('enabled') ? form.get('enabled') !== 'false' : cur.enabled
  let shopUntil: Date | null = cur.shop_until
  if (form.has('shopUntil')) {
    const raw = String(form.get('shopUntil') || '')
    shopUntil = raw ? parseDate(raw) : null
    if (raw && !shopUntil) return NextResponse.json({ error: 'Datum „Shop offen bis“ ungültig' }, { status: 400 })
  }

  let music: string | null = cur.music_filename
  let newMusic: string | null = null
  try {
    const file = form.get('music')
    if (file instanceof File && file.size > 0) { newMusic = await storeHwAudio(file); music = newMusic }
    else if (form.get('removeMusic') === 'true') music = null
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  try {
    await pool.query(
      `UPDATE hw_config SET enabled = $1, candy_find = $2, candy_easy = $3, candy_medium = $4, candy_hard = $5,
              shop_until = $6, music_filename = $7, updated_at = NOW()
       WHERE event_id = $8`,
      [enabled, candyFind, candyEasy, candyMedium, candyHard, shopUntil, music, id]
    )
    // Alte Musikdatei löschen, wenn sie ersetzt/entfernt wurde und kein anderes Jahr sie noch benutzt
    if (cur.music_filename && cur.music_filename !== music) {
      const used = (await pool.query('SELECT 1 FROM hw_config WHERE music_filename = $1 LIMIT 1', [cur.music_filename])).rows[0]
      if (!used) await deleteFile('site-content', `halloween/${cur.music_filename}`)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (newMusic) await deleteFile('site-content', `halloween/${newMusic}`).catch(() => {})
    return NextResponse.json({ error: (err as Error).message || 'Serverfehler' }, { status: 500 })
  }
}