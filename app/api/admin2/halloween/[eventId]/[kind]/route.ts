import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { deleteFile } from '@/app/lib/local-storage'
import { checkWrite } from '@/app/lib/home-tiles'
import { rowToItem, rowToPumpkin, rowToQuestion } from '@/app/lib/halloween'
import { parseItemForm, parsePumpkin, parseQuestion, storeHwImage } from '@/app/lib/halloween-admin'

// POST /api/admin2/halloween/[eventId]/[kind]  (nur Administrator/Owner)
//   questions → JSON { difficulty, question, answers[2–4], correctIndex, timeLimit, active? }
//   pumpkins  → JSON { pagePath, anchor, x, y, size, difficulty }   (kommt aus dem Platzier-Modus)
//   items     → FormData { name, description, price, stock, perUserLimit, rewardType, templateId, position, active, file? }
//   reset     → JSON { confirm: 'RESET' } → löscht ALLE Funde und Käufe dieses Events (z. B. nach dem Testen)

type Ctx = { params: Promise<{ eventId: string; kind: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
  if (!checkOrigin(req)) return csrfError()
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { eventId, kind } = await ctx.params
  const id = Number(eventId)
  const cfg = (await pool.query('SELECT 1 FROM hw_config WHERE event_id = $1', [id]).catch(() => ({ rows: [] }))).rows[0]
  if (!cfg) return NextResponse.json({ error: 'Halloween ist für dieses Event nicht eingeschaltet' }, { status: 404 })

  try {
    if (kind === 'questions') {
      const b = await req.json().catch(() => ({}))
      const v = parseQuestion(b)
      if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })
      const r = await pool.query(
        `INSERT INTO hw_questions (event_id, difficulty, question, answers, correct_index, time_limit, active)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7) RETURNING *`,
        [id, v.difficulty, v.question, JSON.stringify(v.answers), v.correctIndex, v.timeLimit, v.active]
      )
      return NextResponse.json({ question: rowToQuestion(r.rows[0]) })
    }

    if (kind === 'pumpkins') {
      const b = await req.json().catch(() => ({}))
      const v = parsePumpkin(b)
      if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })
      const n = (await pool.query('SELECT COUNT(*)::int AS n FROM hw_pumpkins WHERE event_id = $1', [id])).rows[0].n
      if (n >= 1000) return NextResponse.json({ error: 'Maximal 1000 Kürbisse pro Event' }, { status: 400 })
      const r = await pool.query(
        `INSERT INTO hw_pumpkins (event_id, page_path, anchor, x, y, size, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [id, v.pagePath, v.anchor, v.x, v.y, v.size, v.difficulty]
      )
      return NextResponse.json({ pumpkin: { ...rowToPumpkin(r.rows[0]), foundBy: 0 } })
    }

    if (kind === 'items') {
      const form = await req.formData().catch(() => null)
      if (!form) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
      const v = parseItemForm(form)
      if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })
      let filename: string | null = null
      const file = form.get('file')
      if (file instanceof File && file.size > 0) {
        try { filename = await storeHwImage(file) } catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 400 }) }
      }
      try {
        const r = await pool.query(
          `INSERT INTO hw_items (event_id, name, description, image_filename, price, stock, per_user_limit, reward_type, template_id, position, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
          [id, v.name, v.description, filename, v.price, v.stock, v.perUserLimit, v.rewardType, v.templateId, v.position, v.active]
        )
        return NextResponse.json({ item: { ...rowToItem(r.rows[0]), sold: 0 } })
      } catch (err) {
        if (filename) await deleteFile('site-content', `halloween/${filename}`).catch(() => {})
        throw err
      }
    }

    if (kind === 'reset') {
      const b = await req.json().catch(() => ({})) as { confirm?: string }
      if (b.confirm !== 'RESET') return NextResponse.json({ error: 'Bitte bestätigen' }, { status: 400 })
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('DELETE FROM hw_purchases WHERE event_id = $1', [id])
        await client.query('DELETE FROM hw_finds WHERE event_id = $1', [id])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unbekannt' }, { status: 404 })
  } catch (err) {
    console.error('Halloween admin POST', kind, err)
    return NextResponse.json({ error: (err as Error).message || 'Serverfehler' }, { status: 500 })
  }
}