import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'
import { eintragen, eintragPruefen, historieCacheLeeren } from '@/app/lib/clan-historie'

// /api/admin2/clan-historie – Clan-Historie von Hand pflegen (Recht: Clan verwalten). Lesen: /api/clan/historie
//   POST   {zeit?, genau?, art, spieler, von?, rang?, notiz?}   neuer Eintrag (ohne zeit: jetzt)
//   PATCH  {id, …dieselben Felder}                             Eintrag ändern
//   DELETE {id}                                                Eintrag löschen

export async function POST(req: NextRequest) {
  const user = await mitRecht(req, 'clan.verwalten')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const e = eintragPruefen(await req.json().catch(() => ({})))
  if (typeof e === 'string') return NextResponse.json({ error: e }, { status: 400 })
  const neu = await eintragen({ ...e, quelle: 'website', erstelltVon: user.username })
  if (!neu) return NextResponse.json({ error: 'Nicht gespeichert – fehlt die Tabelle clan_historie?' }, { status: 500 })
  return NextResponse.json({ success: true, eintrag: neu })
}

export async function PATCH(req: NextRequest) {
  const user = await mitRecht(req, 'clan.verwalten')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = Number(b.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  const e = eintragPruefen(b)
  if (typeof e === 'string') return NextResponse.json({ error: e }, { status: 400 })
  const r = await pool.query(
    `UPDATE clan_historie SET zeit = $1, zeit_genau = $2, art = $3, spieler = $4, von = $5, rang = $6, notiz = $7 WHERE id = $8`,
    [new Date(e.zeit!).toISOString(), e.genau !== false, e.art, e.spieler, e.von ?? null, e.rang ?? null, e.notiz ?? null, id]
  )
  historieCacheLeeren()
  if (!r.rowCount) return NextResponse.json({ error: 'Eintrag gibt es nicht' }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await mitRecht(req, 'clan.verwalten')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  await pool.query('DELETE FROM clan_historie WHERE id = $1', [Number(id)])
  historieCacheLeeren()
  return NextResponse.json({ success: true })
}
