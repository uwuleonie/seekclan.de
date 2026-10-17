import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { ALLE_RECHTE } from '@/app/lib/rechte-def'
import { alleRaenge, istUmgestellt, mitRecht, rangCacheLeeren, spielerRangSchreiben, standardRang, type Rang } from '@/app/lib/rechte'
import { formatUuid, nameToProfile } from '@/app/lib/mojang'
import CLANLISTE from './clanliste.json'
import { beitrittAusAltHistorie } from '@/app/lib/clan-historie-import'

// /api/admin2/raenge/umstellung – EINMALIGE Umstellung vom alten Durcheinander auf das Rang-System.
//
// Alte Quellen:   users.clan_role (Website-Rolle), clan_members.role (Clan-Rolle), mc_player_ranks (alte Minecraft-Ränge),
//                 clanliste.json (Clan-Liste aus dem Spiel, Oktober 2026)
// Neu:            jede Person bekommt genau EINEN der neuen Ränge (die mit mc_ranks.schluessel) – bei mehreren Quellen
//                 gewinnt der höchste. Clan-Akten (Beitritt, Stufe, Abzeichen) bleiben erhalten und bekommen die Minecraft-UUID.
//                 Nichts wird gelöscht außer alten Minecraft-Rängen, die danach niemand mehr hat.
//
//   GET                                   Vorschau
//   POST {prefixVon, mcZiel, ausfuehren}  prefixVon: {neuerRangId: alterRangId} – Prefixe/Farbe/MC-Permissions übernehmen
//                                         mcZiel:    {alterRangId: neuerRangId}  – wohin die Spieler alter Ränge kommen
//                                         ausfuehren: false = nur Vorschau neu rechnen

const WEB: Record<string, string> = { owner: 'orga', administrator: 'admin', teammitglied: 'server-team', vip: 'vip', clanmoderator: 'clan-mod', clanmitglied: 'clan', gast: 'spieler' }
const CLAN: Record<string, string> = { owner: 'orga', admin: 'admin', vip: 'vip', mod: 'clan-mod', mitglied: 'clan' }
const norm = (u: string | null | undefined) => (u ? u.replace(/-/g, '').toLowerCase() : null)

interface Kandidat { quelle: string; rang: Rang; art: 'web' | 'mc' | 'clan' | 'liste' }
interface PlanPerson {
  key: string; uuid: string | null; userId: string | null; name: string
  kandidaten: Kandidat[]; ziel: Rang; clanIds: string[]; neueAkte: boolean
}

/** Vorschlag, welcher neue Rang zu einem alten Minecraft-Rang passt (nach Name) */
function vorschlag(alt: { name: string; display_name: string }, neu: Rang[], std: Rang): Rang {
  const t = `${alt.name} ${alt.display_name}`.toLowerCase()
  const nach = (k: string) => neu.find(r => r.schluessel === k)
  if (/owner|orga|leitung|inhaber/.test(t)) return nach('orga') ?? std
  if (/admin/.test(t)) return nach('admin') ?? std
  if (/vip/.test(t)) return nach('vip') ?? std
  if (/mod/.test(t)) return nach('clan-mod') ?? std
  if (/clan|mitglied|member/.test(t)) return nach('clan') ?? std
  if (/team|supp|build|dev/.test(t)) return nach('server-team') ?? std
  return std
}

async function plan(mcZiel: Record<string, number>, mojang: boolean) {
  const raenge = await alleRaenge()
  const neu = raenge.filter(r => r.schluessel)
  const alt = (await pool.query(
    `SELECT r.id, r.name, r.display_name, r.chat_prefix, r.tab_prefix, (SELECT count(*)::int FROM mc_player_ranks p WHERE p.rank_id = r.id) AS spieler
     FROM mc_ranks r WHERE r.schluessel IS NULL ORDER BY r.priority DESC`
  )).rows
  const std = await standardRang()
  const nachSchluessel = (k: string | undefined) => (k ? neu.find(r => r.schluessel === k) : undefined)
  const zielFuerAlt = (id: number) => raenge.find(r => r.id === Number(mcZiel[id])) ?? vorschlag(alt.find(a => a.id === id) ?? { name: '', display_name: '' }, neu, std)

  const personen = new Map<string, PlanPerson>()
  /** Personen ohne UUID zusätzlich nach Name (klein) – damit Konto, Clan-Akte und Clan-Liste derselben Person zusammenfinden */
  const nachName = new Map<string, PlanPerson>()
  const person = (uuid: string | null, userId: string | null, name: string) => {
    const key = uuid ? `mc:${norm(uuid)}` : `u:${userId}`
    let p = personen.get(key) ?? (!uuid ? nachName.get(name.toLowerCase()) : undefined)
    if (!p && uuid) {
      // Gleicher Name schon ohne UUID da? Dann ist es dieselbe Person – UUID nachtragen
      const ohne = nachName.get(name.toLowerCase())
      if (ohne && !ohne.uuid) { personen.delete(ohne.key); ohne.key = key; ohne.uuid = formatUuid(uuid); personen.set(key, ohne); p = ohne }
    }
    if (!p) { p = { key, uuid: uuid ? formatUuid(uuid) : null, userId, name, kandidaten: [], ziel: std, clanIds: [], neueAkte: false }; personen.set(key, p) }
    if (userId && !p.userId) p.userId = userId
    if (!nachName.has(name.toLowerCase())) nachName.set(name.toLowerCase(), p)
    return p
  }
  const dazu = (p: PlanPerson, art: Kandidat['art'], quelle: string, r: Rang | undefined) => { if (r) p.kandidaten.push({ art, quelle, rang: r }) }

  // 1. Website-Konten
  const konten = (await pool.query('SELECT id, username, minecraft_username, minecraft_uuid, clan_role FROM users')).rows
  const kontoNachMc = new Map(konten.filter(k => k.minecraft_username).map(k => [k.minecraft_username.toLowerCase(), k]))
  for (const k of konten) {
    const p = person(k.minecraft_uuid, String(k.id), k.minecraft_username || k.username)
    if (k.clan_role && k.clan_role !== 'gast') dazu(p, 'web', `Website-Rolle „${k.clan_role}“`, nachSchluessel(WEB[k.clan_role]))
  }
  // 2. Minecraft-Ränge
  for (const pr of (await pool.query('SELECT uuid, player_name, rank_id FROM mc_player_ranks')).rows) {
    const p = person(pr.uuid, null, pr.player_name)
    const r = raenge.find(x => x.id === pr.rank_id)
    if (!r) continue
    if (r.schluessel) { if (!r.standard) dazu(p, 'mc', `Minecraft-Rang ${r.anzeige}`, r) }
    else { const z = zielFuerAlt(r.id); if (!z.standard) dazu(p, 'mc', `alter Minecraft-Rang „${r.anzeige}“`, z) }
  }
  // 3. Clan-Liste aus dem Spiel
  const liste = new Map<string, { name: string; uuid: string | null; rang: string }>()
  for (const [name, uuid, abschnitt] of CLANLISTE.spieler as [string, string | null, string][]) {
    let u = uuid
    if (!u) u = kontoNachMc.get(name.toLowerCase())?.minecraft_uuid ?? konten.find(k => k.username.toLowerCase() === name.toLowerCase())?.minecraft_uuid ?? null
    liste.set(name.toLowerCase(), { name, uuid: u, rang: (CLANLISTE.abschnitte as Record<string, string>)[abschnitt] })
  }
  // 4. Clan-Akten (/clan) – UUID über die Clan-Liste, ein verknüpftes Konto oder Mojang
  const akten = (await pool.query('SELECT id, display_name, role, minecraft_uuid FROM clan_members')).rows
  const ohneUuid: string[] = []
  for (const a of akten) {
    // Akte gehört zu einem Konto, wenn der Name der Minecraft-Name ODER der Website-Username des Kontos ist
    const kontoNachName = kontoNachMc.get(a.display_name.toLowerCase()) ?? konten.find(k => k.username.toLowerCase() === a.display_name.toLowerCase())
    let u: string | null = a.minecraft_uuid ?? liste.get(a.display_name.toLowerCase())?.uuid ?? kontoNachName?.minecraft_uuid ?? null
    if (!u && mojang && !kontoNachName) { const prof = await nameToProfile(a.display_name); u = prof?.uuid ?? null }
    if (!u) { ohneUuid.push(a.display_name) }
    const konto = u ? konten.find(k => norm(k.minecraft_uuid) === norm(u)) ?? kontoNachName : kontoNachName
    const p = person(u ?? konto?.minecraft_uuid ?? null, konto ? String(konto.id) : (u ? null : `cm-${a.id}`), a.display_name)
    p.clanIds.push(a.id)
    dazu(p, 'clan', `Clan-Rolle „${a.role}“`, nachSchluessel(CLAN[String(a.role ?? '').toLowerCase()]))
  }
  for (const e of liste.values()) {
    const konto = e.uuid ? konten.find(k => norm(k.minecraft_uuid) === norm(e.uuid)) : kontoNachMc.get(e.name.toLowerCase())
    const p = person(e.uuid, konto ? String(konto.id) : (e.uuid ? null : `liste-${e.name}`), e.name)
    if (!konto) p.name = e.name
    dazu(p, 'liste', 'Clan-Liste im Spiel', nachSchluessel(e.rang))
  }
  // Ziel: Die Clan-Liste aus dem Spiel ist der neueste Stand und schlägt alte Clan-Rollen und alte Minecraft-Ränge.
  // Website-Rollen zählen weiter mit (sie tragen die Website-Rechte) – davon gewinnt der höchste Rang.
  for (const p of personen.values()) {
    const ausListe = p.kandidaten.some(k => k.art === 'liste')
    // Ausnahme: Ein alter Minecraft-Rang ab Admin aufwärts (z. B. Orga) wird von der Clan-Liste nicht heruntergestuft
    const adminPrio = nachSchluessel('admin')?.prioritaet ?? 90
    const zaehlt = p.kandidaten.filter(k => !ausListe || k.art === 'liste' || k.art === 'web' || (k.art === 'mc' && k.rang.prioritaet >= adminPrio))
    p.ziel = zaehlt.reduce((best, k) => (k.rang.prioritaet > best.prioritaet ? k.rang : best), std)
    p.neueAkte = p.ziel.clan && !p.clanIds.length && !!p.uuid
  }
  const wichtig = [...personen.values()].filter(p => p.kandidaten.length || p.clanIds.length)
  return { neu, alt, std, personen: wichtig, ohneUuid, zielFuerAlt }
}

async function zugang(req: NextRequest) {
  const u = await mitRecht(req, 'raenge.bearbeiten')
  return u && u.rechte.includes(ALLE_RECHTE) ? u : null
}

export async function GET(req: NextRequest) {
  if (!(await zugang(req))) return NextResponse.json({ error: 'Nur die Orga darf umstellen' }, { status: 403 })
  return vorschau({}, false)
}

async function vorschau(mcZiel: Record<string, number>, mojang: boolean) {
  const p = await plan(mcZiel, mojang)
  return NextResponse.json({
    umgestellt: await istUmgestellt(),
    neueRaenge: p.neu.map(r => ({ id: r.id, schluessel: r.schluessel, anzeige: r.anzeige, prioritaet: r.prioritaet, farbe: r.farbe })),
    alteRaenge: p.alt.map(a => ({ id: a.id, name: a.name, anzeige: a.display_name, chatPrefix: a.chat_prefix, tabPrefix: a.tab_prefix, spieler: a.spieler, ziel: p.zielFuerAlt(a.id).id })),
    personen: p.personen
      .sort((a, b) => b.ziel.prioritaet - a.ziel.prioritaet || a.name.localeCompare(b.name))
      .map(x => ({
        name: x.name, uuid: x.uuid, konto: !!x.userId && !x.userId.startsWith('cm-') && !x.userId.startsWith('liste-'), ziel: x.ziel.id,
        quellen: x.kandidaten.map(k => `${k.quelle} → ${k.rang.anzeige}`), akte: x.clanIds.length > 0, neueAkte: x.neueAkte,
        konflikt: new Set(x.kandidaten.map(k => k.rang.id)).size > 1,
        // Website-Rechte, die die Person durch den neuen Rang verliert (z. B. Server-Team, das im Clan-Mod-Rang landet)
        verliert: [...new Set(x.kandidaten.filter(k => k.art === 'web').flatMap(k => k.rang.rechte))]
          .filter(r => !x.ziel.rechte.includes(ALLE_RECHTE) && !x.ziel.rechte.includes(r)),
      })),
    ohneUuid: p.ohneUuid,
  })
}

export async function POST(req: NextRequest) {
  const user = await zugang(req)
  if (!user) return NextResponse.json({ error: 'Nur die Orga darf umstellen' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const mcZiel: Record<string, number> = b.mcZiel && typeof b.mcZiel === 'object' ? b.mcZiel : {}
  const prefixVon: Record<string, number | null> = b.prefixVon && typeof b.prefixVon === 'object' ? b.prefixVon : {}
  if (!b.ausfuehren) return vorschau(mcZiel, false)

  const p = await plan(mcZiel, true)
  if (p.neu.length < 2) return NextResponse.json({ error: 'Die neuen Ränge fehlen – bitte erst die Datenbank-Befehle ausführen' }, { status: 400 })
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    // Prefixe, Farbe und Minecraft-Permissions alter Ränge übernehmen
    for (const [neuId, altId] of Object.entries(prefixVon)) {
      if (!altId) continue
      await c.query(
        `UPDATE mc_ranks n SET chat_prefix = a.chat_prefix, tab_prefix = a.tab_prefix, tab_suffix = a.tab_suffix, color = a.color, name_color = a.name_color,
                permissions = a.permissions, updated_at = now()
         FROM mc_ranks a WHERE n.id = $1 AND a.id = $2`, [Number(neuId), Number(altId)])
    }
    let gesetzt = 0, akten = 0
    for (const x of p.personen) {
      if (x.uuid) {
        await spielerRangSchreiben(c, x.uuid, x.name, x.ziel.id, 'umstellung')
        await c.query(`UPDATE users SET rang_id = NULL WHERE minecraft_uuid IS NOT NULL AND lower(replace(minecraft_uuid, '-', '')) = $1`, [norm(x.uuid)])
        for (const id of x.clanIds) await c.query('UPDATE clan_members SET minecraft_uuid = $1 WHERE id = $2', [x.uuid, id])
        if (x.neueAkte) {
          // Beitritt aus dem alten Clan-Verlauf, sonst leer (unbekannt)
          await c.query(`INSERT INTO clan_members (display_name, role, join_date, minecraft_uuid) VALUES ($1, $2, $3, $4)`, [x.name, x.ziel.anzeige, beitrittAusAltHistorie(x.name), x.uuid])
          akten++
        }
      } else if (x.userId && !x.userId.startsWith('cm-') && !x.userId.startsWith('liste-')) {
        await c.query('UPDATE users SET rang_id = $1 WHERE id = $2', [x.ziel.standard ? null : x.ziel.id, x.userId])
      } else continue
      gesetzt++
    }
    // Spieler alter Ränge, die oben nicht vorkamen (z. B. alter Standard-Rang) → Zielrang
    for (const a of p.alt) {
      await c.query('UPDATE mc_player_ranks SET rank_id = $1 WHERE rank_id = $2', [p.zielFuerAlt(a.id).id, a.id])
    }
    // Alte Ränge ohne Spieler entfernen
    const weg = await c.query(
      `DELETE FROM mc_ranks r WHERE r.schluessel IS NULL
         AND NOT EXISTS (SELECT 1 FROM mc_player_ranks p WHERE p.rank_id = r.id) AND NOT EXISTS (SELECT 1 FROM users u WHERE u.rang_id = r.id)
       RETURNING name`
    )
    await c.query(
      `INSERT INTO system_einstellungen (key, value) VALUES ('raenge_umgestellt', 'true'::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb`
    )
    await c.query('COMMIT')
    rangCacheLeeren()
    return NextResponse.json({ success: true, gesetzt, neueAkten: akten, geloescht: weg.rows.map(r => r.name), ohneUuid: p.ohneUuid })
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    console.error('raenge/umstellung', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Umstellung fehlgeschlagen' }, { status: 500 })
  } finally {
    c.release()
  }
}
