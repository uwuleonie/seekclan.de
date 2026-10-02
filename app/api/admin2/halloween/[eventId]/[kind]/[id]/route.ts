import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { deleteFile } from '@/app/lib/local-storage'
import { checkWrite } from '@/app/lib/home-tiles'
import { rowToItem, rowToPumpkin, rowToQuestion } from '@/app/lib/halloween'
import { parseItemForm, parsePumpkin, parseQuestion, storeHwImage } from '@/app/lib/halloween-admin'

// PATCH / DELETE /api/admin2/halloween/[eventId]/[kind]/[id]  (nur Administrator/Owner)
//   questions/[id] PATCH JSON (ganze Frage oder nur { active })    · DELETE
//   pumpkins/[id]  PATCH JSON (einzelne Felder: difficulty, size, x, y, anchor, active) · DELETE
//   items/[id]     PATCH FormData (ganzer Artikel, file?, removeImage?) oder JSON { active } · DELETE
//   purchases/[id] PATCH JSON { status: offen|erledigt|zugestellt, note } · DELETE = stornieren (Süßigkeiten zurück)
//   players/[userId] DELETE = Fortschritt dieses Spielers löschen (Funde + Käufe)

type Ctx = { params: Promise<{ eventId: string; kind: string; id: string }> }

async function removeItemImage(filename: string | null) {
  if (!filename) return
  // Bilder können von übernommenen Jahren mitbenutzt werden → nur löschen, wenn nirgends mehr verwendet
  const used = (await pool.query('SELECT 1 FROM hw_items WHERE image_filename = $1 LIMIT 1', [filename])).rows[0]
  if (!used) await deleteFile('site-content', `halloween/${filename}`)
}

async function readCtx(req: NextRequest, ctx: Ctx) {
  if (!checkOrigin(req)) return { res: csrfError() }
  const user = await checkWrite(req)
  if (!user) return { res: NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 }) }
  const p = await ctx.params
  const eventId = Number(p.eventId)
  if (!Number.isInteger(eventId)) return { res: NextResponse.json({ error: 'Ungültige ID' }, { status: 400 }) }
  return { eventId, kind: p.kind, id: p.id }
}

const notFound = () => NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const c = await readCtx(req, ctx)
  if ('res' in c) return c.res
  const { eventId, kind } = c
  const id = Number(c.id)
  if (!Number.isInteger(id)) return notFound()

  try {
    if (kind === 'questions') {
      const b = await req.json().catch(() => ({})) as Record<string, unknown>
      if (Object.keys(b).length === 1 && typeof b.active === 'boolean') {
        const r = await pool.query('UPDATE hw_questions SET active = $1 WHERE id = $2 AND event_id = $3 RETURNING *', [b.active, id, eventId])
        return r.rows[0] ? NextResponse.json({ question: rowToQuestion(r.rows[0]) }) : notFound()
      }
      const v = parseQuestion(b)
      if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })
      const r = await pool.query(
        `UPDATE hw_questions SET difficulty = $1, question = $2, answers = $3::jsonb, correct_index = $4, time_limit = $5, active = $6
         WHERE id = $7 AND event_id = $8 RETURNING *`,
        [v.difficulty, v.question, JSON.stringify(v.answers), v.correctIndex, v.timeLimit, v.active, id, eventId]
      )
      return r.rows[0] ? NextResponse.json({ question: rowToQuestion(r.rows[0]) }) : notFound()
    }

    if (kind === 'pumpkins') {
      const b = await req.json().catch(() => ({})) as Record<string, unknown>
      const v = parsePumpkin(b, true)
      if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })
      const cols: Record<string, string> = { pagePath: 'page_path', anchor: 'anchor', x: 'x', y: 'y', size: 'size', difficulty: 'difficulty', active: 'active' }
      const sets: string[] = []
      const vals: unknown[] = []
      for (const [k, col] of Object.entries(cols)) {
        const val = (v as Record<string, unknown>)[k]
        if (val !== undefined) { vals.push(val); sets.push(`${col} = $${vals.length}`) }
      }
      if (!sets.length) return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })
      vals.push(id, eventId)
      const r = await pool.query(`UPDATE hw_pumpkins SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND event_id = $${vals.length} RETURNING *`, vals)
      return r.rows[0] ? NextResponse.json({ pumpkin: rowToPumpkin(r.rows[0]) }) : notFound()
    }

    if (kind === 'items') {
      const cur = (await pool.query('SELECT * FROM hw_items WHERE id = $1 AND event_id = $2', [id, eventId])).rows[0]
      if (!cur) return notFound()
      if ((req.headers.get('content-type') || '').includes('application/json')) {
        const b = await req.json().catch(() => ({})) as { active?: boolean }
        if (typeof b.active !== 'boolean') return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
        const r = await pool.query('UPDATE hw_items SET active = $1 WHERE id = $2 RETURNING *', [b.active, id])
        return NextResponse.json({ item: rowToItem(r.rows[0]) })
      }
      const form = await req.formData().catch(() => null)
      if (!form) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
      const v = parseItemForm(form)
      if ('error' in v) return NextResponse.json({ error: v.error }, { status: 400 })

      let filename: string | null = cur.image_filename
      let newFile: string | null = null
      const file = form.get('file')
      if (file instanceof File && file.size > 0) {
        try { newFile = await storeHwImage(file); filename = newFile } catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 400 }) }
      } else if (form.get('removeImage') === 'true') filename = null

      try {
        const r = await pool.query(
          `UPDATE hw_items SET name = $1, description = $2, image_filename = $3, price = $4, stock = $5, per_user_limit = $6,
                  reward_type = $7, template_id = $8, position = $9, active = $10
           WHERE id = $11 RETURNING *`,
          [v.name, v.description, filename, v.price, v.stock, v.perUserLimit, v.rewardType, v.templateId, v.position, v.active, id]
        )
        if (cur.image_filename && cur.image_filename !== filename) await removeItemImage(cur.image_filename)
        return NextResponse.json({ item: rowToItem(r.rows[0]) })
      } catch (err) {
        if (newFile) await deleteFile('site-content', `halloween/${newFile}`).catch(() => {})
        throw err
      }
    }

    if (kind === 'purchases') {
      const b = await req.json().catch(() => ({})) as { status?: string; note?: string }
      const status = String(b.status || '')
      if (!['offen', 'erledigt', 'zugestellt'].includes(status)) return NextResponse.json({ error: 'Status ungültig' }, { status: 400 })
      const note = typeof b.note === 'string' ? b.note.trim().slice(0, 300) || null : null
      const r = await pool.query('UPDATE hw_purchases SET status = $1, note = $2 WHERE id = $3 AND event_id = $4 RETURNING id', [status, note, id, eventId])
      return r.rows[0] ? NextResponse.json({ ok: true }) : notFound()
    }

    return notFound()
  } catch (err) {
    console.error('Halloween admin PATCH', kind, err)
    return NextResponse.json({ error: (err as Error).message || 'Serverfehler' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const c = await readCtx(req, ctx)
  if ('res' in c) return c.res
  const { eventId, kind } = c

  try {
    if (kind === 'players') {
      const userId = String(c.id)
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return notFound()
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('DELETE FROM hw_purchases WHERE event_id = $1 AND user_id = $2', [eventId, userId])
        await client.query('DELETE FROM hw_finds WHERE event_id = $1 AND user_id = $2', [eventId, userId])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
      return NextResponse.json({ ok: true })
    }

    const id = Number(c.id)
    if (!Number.isInteger(id)) return notFound()

    if (kind === 'questions') {
      const r = await pool.query('DELETE FROM hw_questions WHERE id = $1 AND event_id = $2 RETURNING id', [id, eventId])
      return r.rows[0] ? NextResponse.json({ ok: true }) : notFound()
    }
    if (kind === 'pumpkins') {
      // Achtung: Funde dieses Kürbisses (und ihre Süßigkeiten) werden mit gelöscht
      const r = await pool.query('DELETE FROM hw_pumpkins WHERE id = $1 AND event_id = $2 RETURNING id', [id, eventId])
      return r.rows[0] ? NextResponse.json({ ok: true }) : notFound()
    }
    if (kind === 'items') {
      const r = await pool.query('DELETE FROM hw_items WHERE id = $1 AND event_id = $2 RETURNING image_filename', [id, eventId])
      if (!r.rows[0]) return notFound()
      await removeItemImage(r.rows[0].image_filename)
      return NextResponse.json({ ok: true })
    }
    if (kind === 'purchases') {
      // Stornieren: Kauf löschen → der Preis zählt nicht mehr als ausgegeben, der Spieler hat die Süßigkeiten wieder
      const r = await pool.query('DELETE FROM hw_purchases WHERE id = $1 AND event_id = $2 RETURNING id', [id, eventId])
      return r.rows[0] ? NextResponse.json({ ok: true }) : notFound()
    }
    return notFound()
  } catch (err) {
    console.error('Halloween admin DELETE', kind, err)
    return NextResponse.json({ error: (err as Error).message || 'Serverfehler' }, { status: 500 })
  }
}