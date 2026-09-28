import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { pool } from '@/app/lib/db'
import { getPrivateUser } from '@/app/lib/private-auth'
import { notify } from '@/app/lib/private-notify'

// Tägliche Nachrichten-Zusammenfassung (von Claude Cowork als geplante Aufgabe erstellt)
//
// GET  /api/private/news/briefing?days=14  → letzte Zusammenfassungen (eingeloggt)
// POST /api/private/news/briefing          → neue Zusammenfassung speichern
//      Header: Authorization: Bearer <NEWS_INGEST_TOKEN>   (Umgebungsvariable auf dem Server)
//      Body:   { date: "2026-09-28", briefings: [{ category: "de"|"welt"|"wirtschaft", headline, items: [{ title, summary, source, url }] }] }

const CATS = ['de', 'welt', 'wirtschaft'] as const
const LABEL: Record<string, string> = { de: 'Deutschland', welt: 'Welt', wirtschaft: 'Wirtschaft' }

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.NEWS_INGEST_TOKEN || ''
  if (expected.length < 24) return false // ohne (ausreichend langes) Token ist Einspielen gesperrt
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(got), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const url = (v: unknown) => { const s = str(v, 1000); return /^https?:\/\//i.test(s) ? s : null }

export async function GET(req: NextRequest) {
  try {
    const user = await getPrivateUser(req)
    if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
    const days = Math.min(60, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 14))
    const r = await pool.query(
      `SELECT news_date, category, headline, items, updated_at FROM private_news_briefings
       WHERE news_date >= CURRENT_DATE - $1::int ORDER BY news_date DESC, category`,
      [days]
    )
    const rows = r.rows.map(x => ({
      ...x,
      news_date: x.news_date instanceof Date
        ? `${x.news_date.getFullYear()}-${String(x.news_date.getMonth() + 1).padStart(2, '0')}-${String(x.news_date.getDate()).padStart(2, '0')}`
        : String(x.news_date).slice(0, 10),
    }))
    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    const e = err as { code?: string }
    if (e?.code === '42P01') return NextResponse.json({ error: 'Datenbank-Tabelle fehlt – SQL für Phase 5 ausführen' }, { status: 500 })
    console.error('Briefing GET:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req)) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 401 })
  try {
    const body = await req.json().catch(() => null)
    const date = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : new Date().toISOString().slice(0, 10)
    const list = Array.isArray(body?.briefings) ? body.briefings : []
    let saved = 0
    for (const b of list.slice(0, 6)) {
      const category = CATS.includes(b?.category) ? b.category : null
      if (!category) continue
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 12).map((i: Record<string, unknown>) => ({
        title: str(i?.title, 200), summary: str(i?.summary, 900), source: str(i?.source, 80), url: url(i?.url),
      })).filter((i: { title: string }) => i.title)
      if (!items.length) continue
      await pool.query(
        `INSERT INTO private_news_briefings (news_date, category, headline, items)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (news_date, category) DO UPDATE SET headline = EXCLUDED.headline, items = EXCLUDED.items, updated_at = NOW()`,
        [date, category, str(b.headline, 300) || null, JSON.stringify(items)]
      )
      saved++
    }
    if (!saved) return NextResponse.json({ error: 'Keine gültigen Einträge' }, { status: 400 })

    // Glocke + Push an alle Nutzer des Privatbereichs (einmal pro Tag)
    const users = await pool.query(`SELECT id FROM users WHERE clan_role IN ('administrator', 'owner')`)
    const cats = list.map((b: { category?: string }) => LABEL[b?.category ?? '']).filter(Boolean).join(', ')
    for (const u of users.rows) {
      await notify(String(u.id), {
        kind: 'news',
        title: 'Deine Nachrichten sind da',
        body: `Zusammenfassung vom ${new Date(date).toLocaleDateString('de-DE')}: ${cats}`,
        url: '/private/aktuell',
        tag: `news-${date}`,
        dedupeKey: `news:${date}:${u.id}`,
      }).catch(() => null)
    }
    return NextResponse.json({ ok: true, saved })
  } catch (err) {
    const e = err as { code?: string }
    if (e?.code === '42P01') return NextResponse.json({ error: 'Datenbank-Tabelle fehlt – SQL für Phase 5 ausführen' }, { status: 500 })
    console.error('Briefing POST:', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}