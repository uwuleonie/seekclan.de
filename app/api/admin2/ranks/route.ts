import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { ALLE_RECHTE, RECHT_KEYS } from '@/app/lib/rechte-def'
import { darf, mitRecht, rangAusZeile, rangCacheLeeren } from '@/app/lib/rechte'

// /api/admin2/ranks – die Ränge (Tabelle mc_ranks): ein Rang gilt für Website, Minecraft und Clan.
//   GET     alle Ränge (Lesen: admin.zugang)
//   POST    neuer Rang          (raenge.bearbeiten)
//   PUT     Rang ändern {id, …} (raenge.bearbeiten)
//   DELETE  Rang löschen {id}   (raenge.bearbeiten) – nur ohne Personen und nicht den Standard-Rang
// Ränge mit „*“ (alle Rechte, z. B. Orga) darf nur bearbeiten, wer selbst „*“ hat.

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Felder aus dem Formular prüfen und säubern */
function felder(b: Record<string, unknown>, darfAlles: boolean) {
  const rechte = Array.isArray(b.rechte) ? [...new Set(b.rechte.map(String))].filter(r => RECHT_KEYS.includes(r as never) || (darfAlles && r === ALLE_RECHTE)) : []
  const permissions = Array.isArray(b.permissions) ? [...new Set(b.permissions.map(x => String(x).trim()).filter(Boolean))].slice(0, 500) : []
  const schluessel = str(b.schluessel, 40).toLowerCase().replace(/[^a-z0-9-]/g, '') || null
  const webFarbe = /^#[0-9a-f]{6}$/i.test(str(b.web_farbe)) ? str(b.web_farbe).toLowerCase() : null
  return {
    name: str(b.name, 40).trim(), display_name: str(b.display_name, 60).trim(), chat_prefix: str(b.chat_prefix), tab_prefix: str(b.tab_prefix),
    tab_suffix: str(b.tab_suffix), color: str(b.color, 20) || '§7', name_color: str(b.name_color, 20), priority: Number.isFinite(Number(b.priority)) ? Math.round(Number(b.priority)) : 0,
    is_default: !!b.is_default, permissions, can_assign_up_to_priority: Number.isFinite(Number(b.can_assign_up_to_priority)) ? Math.round(Number(b.can_assign_up_to_priority)) : -1,
    rechte, clan: !!b.clan, team: !!b.team, nur_ingame: !!b.nur_ingame, beschreibung: str(b.beschreibung, 300).trim() || null, web_farbe: webFarbe, schluessel,
  }
}

/** „Nur im Spiel“ extra speichern – fehlt die Spalte noch (Datenbank-Befehl nicht ausgeführt), klappt der Rest trotzdem */
async function nurIngameSpeichern(zeile: Record<string, unknown>, wert: boolean) {
  try {
    return (await pool.query('UPDATE mc_ranks SET nur_ingame = $1 WHERE id = $2 RETURNING *', [wert, zeile.id])).rows[0] ?? zeile
  } catch (e) {
    if (wert) console.error('Spalte mc_ranks.nur_ingame fehlt – bitte den Datenbank-Befehl ausführen', e instanceof Error ? e.message : e)
    return zeile
  }
}

function antwort(rows: Record<string, unknown>[]) {
  return rows.map(r => ({ ...r, ...rangAusZeile(r as never), permissions: Array.isArray(r.permissions) ? r.permissions : [] }))
}

export async function GET(req: NextRequest) {
  const user = await mitRecht(req, 'admin.zugang')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const result = await pool.query(
    `SELECT r.*, (SELECT count(*)::int FROM mc_player_ranks p WHERE p.rank_id = r.id) + (SELECT count(*)::int FROM users u WHERE u.rang_id = r.id) AS personen
     FROM mc_ranks r ORDER BY r.priority DESC, r.id ASC`
  )
  return NextResponse.json({ ranks: antwort(result.rows) })
}

export async function POST(req: NextRequest) {
  const user = await mitRecht(req, 'raenge.bearbeiten')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const f = felder(await req.json().catch(() => ({})), user.rechte.includes(ALLE_RECHTE))
  if (!f.name || !f.display_name) return NextResponse.json({ error: 'Name und Anzeigename fehlen' }, { status: 400 })
  if (f.is_default) await pool.query('UPDATE mc_ranks SET is_default = false')
  const r = await pool.query(
    `INSERT INTO mc_ranks (name, display_name, chat_prefix, tab_prefix, tab_suffix, color, name_color, priority, is_default, permissions, can_assign_up_to_priority,
                           rechte, clan, team, beschreibung, web_farbe, schluessel)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,$14,$15,$16,$17) RETURNING *`,
    [f.name, f.display_name, f.chat_prefix, f.tab_prefix, f.tab_suffix, f.color, f.name_color, f.priority, f.is_default, JSON.stringify(f.permissions), f.can_assign_up_to_priority,
      JSON.stringify(f.rechte), f.clan, f.team, f.beschreibung, f.web_farbe, f.schluessel]
  )
  r.rows[0] = await nurIngameSpeichern(r.rows[0], f.nur_ingame)
  rangCacheLeeren()
  return NextResponse.json({ rank: antwort(r.rows)[0] })
}

export async function PUT(req: NextRequest) {
  const user = await mitRecht(req, 'raenge.bearbeiten')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const id = Number(b.id)
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  const alt = (await pool.query('SELECT * FROM mc_ranks WHERE id = $1', [id])).rows[0]
  if (!alt) return NextResponse.json({ error: 'Rang nicht gefunden' }, { status: 404 })
  const darfAlles = user.rechte.includes(ALLE_RECHTE)
  if (rangAusZeile(alt).rechte.includes(ALLE_RECHTE) && !darfAlles) return NextResponse.json({ error: 'Diesen Rang darf nur die Orga ändern' }, { status: 403 })
  const f = felder(b, darfAlles)
  if (!f.name || !f.display_name) return NextResponse.json({ error: 'Name und Anzeigename fehlen' }, { status: 400 })
  // Eigenen Rang nicht aus Versehen entmachten
  if (id === user.rang.id && darf(user, 'raenge.bearbeiten') && !f.rechte.includes('raenge.bearbeiten') && !f.rechte.includes(ALLE_RECHTE)) {
    return NextResponse.json({ error: 'Du würdest dir selbst das Recht „Ränge bearbeiten“ nehmen' }, { status: 400 })
  }
  if (f.is_default) await pool.query('UPDATE mc_ranks SET is_default = false WHERE id != $1', [id])
  const r = await pool.query(
    `UPDATE mc_ranks SET name=$1, display_name=$2, chat_prefix=$3, tab_prefix=$4, tab_suffix=$5, color=$6, name_color=$7, priority=$8, is_default=$9,
            permissions=$10::jsonb, can_assign_up_to_priority=$11, rechte=$12::jsonb, clan=$13, team=$14, beschreibung=$15, web_farbe=$16, schluessel=$17, updated_at=now()
     WHERE id=$18 RETURNING *`,
    [f.name, f.display_name, f.chat_prefix, f.tab_prefix, f.tab_suffix, f.color, f.name_color, f.priority, f.is_default, JSON.stringify(f.permissions), f.can_assign_up_to_priority,
      JSON.stringify(f.rechte), f.clan, f.team, f.beschreibung, f.web_farbe, f.schluessel, id]
  )
  r.rows[0] = await nurIngameSpeichern(r.rows[0], f.nur_ingame)
  rangCacheLeeren()
  return NextResponse.json({ rank: antwort(r.rows)[0] })
}

export async function DELETE(req: NextRequest) {
  const user = await mitRecht(req, 'raenge.bearbeiten')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id } = await req.json().catch(() => ({}))
  const alt = (await pool.query('SELECT * FROM mc_ranks WHERE id = $1', [id])).rows[0]
  if (!alt) return NextResponse.json({ error: 'Rang nicht gefunden' }, { status: 404 })
  if (alt.is_default) return NextResponse.json({ error: 'Den Standard-Rang kann man nicht löschen' }, { status: 400 })
  if (rangAusZeile(alt).rechte.includes(ALLE_RECHTE) && !user.rechte.includes(ALLE_RECHTE)) return NextResponse.json({ error: 'Diesen Rang darf nur die Orga löschen' }, { status: 403 })
  const n = (await pool.query('SELECT (SELECT count(*) FROM mc_player_ranks WHERE rank_id = $1) + (SELECT count(*) FROM users WHERE rang_id = $1) AS n', [id])).rows[0]
  if (Number(n.n) > 0) return NextResponse.json({ error: `Diesen Rang haben noch ${n.n} Personen – gib ihnen erst einen anderen Rang` }, { status: 400 })
  await pool.query('DELETE FROM mc_ranks WHERE id = $1', [id])
  rangCacheLeeren()
  return NextResponse.json({ success: true })
}
