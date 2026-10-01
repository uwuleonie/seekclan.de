import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin, csrfError } from '@/app/lib/csrf'
import { checkRead, checkWrite } from '@/app/lib/home-tiles'
import { getLegalPage, isLegalSlug, sanitizeLegalHtml, MAX_LEGAL_BYTES } from '@/app/lib/legal'

// Impressum / Datenschutzerklärung bearbeiten (/admin2/rechtliches)
// GET /api/admin2/legal/impressum              → aktueller Text + Liste der gespeicherten Versionen (Team)
// GET /api/admin2/legal/impressum?version=12   → Text einer alten Version (Team)
// PUT /api/admin2/legal/impressum              → speichern (nur Administrator/Owner)
//     Body: { title, html, note? }

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { slug } = await ctx.params
  if (!isLegalSlug(slug)) return NextResponse.json({ error: 'Unbekannte Seite' }, { status: 404 })

  const versionId = Number(req.nextUrl.searchParams.get('version'))
  try {
    if (versionId) {
      const r = await pool.query('SELECT id, title, content_html, created_at FROM legal_page_versions WHERE id = $1 AND slug = $2', [versionId, slug])
      if (!r.rows[0]) return NextResponse.json({ error: 'Version nicht gefunden' }, { status: 404 })
      return NextResponse.json({ version: { id: Number(r.rows[0].id), title: r.rows[0].title, html: r.rows[0].content_html, createdAt: r.rows[0].created_at } })
    }

    const page = await getLegalPage(slug)
    let versions: { id: number; createdAt: string; by: string | null; note: string | null }[] = []
    let tableMissing = false
    try {
      const v = await pool.query(
        `SELECT v.id, v.created_at, v.note, u.username
         FROM legal_page_versions v LEFT JOIN users u ON u.id = v.created_by
         WHERE v.slug = $1 ORDER BY v.created_at DESC LIMIT 50`,
        [slug]
      )
      versions = v.rows.map(x => ({ id: Number(x.id), createdAt: x.created_at, by: x.username ?? null, note: x.note ?? null }))
    } catch (err) {
      if ((err as { code?: string }).code === '42P01') tableMissing = true
      else throw err
    }
    return NextResponse.json({ page, versions, tableMissing }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Rechtliches GET:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  if (!checkOrigin(req)) return csrfError()
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff – nur Administrator/Owner' }, { status: 403 })
  const { slug } = await ctx.params
  if (!isLegalSlug(slug)) return NextResponse.json({ error: 'Unbekannte Seite' }, { status: 404 })

  const body = await req.json().catch(() => null) as { title?: string; html?: string; note?: string } | null
  const title = String(body?.title ?? '').trim().slice(0, 120)
  const raw = String(body?.html ?? '')
  const note = String(body?.note ?? '').trim().slice(0, 200) || null
  if (!title) return NextResponse.json({ error: 'Überschrift fehlt' }, { status: 400 })
  if (Buffer.byteLength(raw) > MAX_LEGAL_BYTES) return NextResponse.json({ error: 'Text ist zu lang' }, { status: 400 })
  const html = sanitizeLegalHtml(raw)
  if (html.replace(/<[^>]+>/g, '').trim().length < 20) return NextResponse.json({ error: 'Der Text ist (fast) leer – so wird nichts gespeichert.' }, { status: 400 })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO legal_pages (slug, title, content_html, updated_at, updated_by)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, content_html = EXCLUDED.content_html, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [slug, title, html, user.id]
    )
    await client.query(
      'INSERT INTO legal_page_versions (slug, title, content_html, note, created_by) VALUES ($1, $2, $3, $4, $5)',
      [slug, title, html, note, user.id]
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    const e = err as { code?: string }
    if (e.code === '42P01') return NextResponse.json({ error: 'Datenbank-Tabelle fehlt – bitte zuerst das SQL ausführen' }, { status: 500 })
    console.error('Rechtliches PUT:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  } finally {
    client.release()
  }

  return NextResponse.json({ ok: true, page: await getLegalPage(slug) })
}