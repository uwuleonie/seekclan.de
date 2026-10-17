import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { darfRangGeben } from '@/app/lib/rechte-def'
import { mitRecht, rangNachId, rangSetzen, rangVon, standardRang, uuidSql } from '@/app/lib/rechte'
import { isValidMcName, nameToProfile } from '@/app/lib/mojang'
import { akteVerknuepfen, kontoLoesen, kontoVerknuepfen, minecraftProfil, VerknuepfungsFehler } from '@/app/lib/minecraft-konto'

// /api/admin2/personen – alle Personen mit ihrem Rang, egal ob Website-Konto, Minecraft-Spieler oder beides.
//   GET  ?q=Name            Liste (ohne Suche: alle mit besonderem Rang und alle Clan-Mitglieder)
//        &alle=1            zusätzlich alle Website-Konten (für /admin2/personen)
//   POST {key, rangId}      Rang geben (key: „u:<Konto-ID>“, „mc:<UUID>“ oder „cm:<Clan-Akte>“)
//   POST {mcName, rangId}   Rang an einen Minecraft-Namen geben (UUID kommt von Mojang, der Spieler muss nicht online sein)
//   PATCH {key, minecraft}  Minecraft-Account (Name oder UUID) einem Konto oder einer Clan-Akte zuweisen – siehe unten

const N = uuidSql

export async function GET(req: NextRequest) {
  const user = await mitRecht(req, 'admin.zugang')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 40)
  const alle = req.nextUrl.searchParams.get('alle') === '1'
  const std = await standardRang()
  const r = await pool.query(
    `WITH personen AS (
       SELECT 'u:' || u.id AS key, u.id::text AS user_id, u.username, COALESCE(u.anzeigename, u.username) AS name, u.minecraft_username AS mc_name,
              u.minecraft_uuid AS uuid, COALESCE(pr.rank_id, u.rang_id) AS rang_id, pr.assigned_by, pr.assigned_at, u.last_seen_at, COALESCE(u.is_banned, false) AS gesperrt,
              COALESCE(u.is_deactivated, false) AS deaktiviert, u.last_login_at, u.created_at
         FROM users u
         LEFT JOIN mc_player_ranks pr ON u.minecraft_uuid IS NOT NULL AND ${N('pr.uuid')} = ${N('u.minecraft_uuid')}
       UNION ALL
       -- je Spieler nur eine Zeile, auch wenn die UUID einmal mit und einmal ohne Bindestriche gespeichert ist
       SELECT * FROM (
         SELECT DISTINCT ON (${N('pr.uuid')}) 'mc:' || pr.uuid, NULL, NULL, pr.player_name, pr.player_name, pr.uuid, pr.rank_id, pr.assigned_by, pr.assigned_at, NULL::timestamptz, false, false, NULL::timestamptz, NULL::timestamptz
           FROM mc_player_ranks pr
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.minecraft_uuid IS NOT NULL AND ${N('u.minecraft_uuid')} = ${N('pr.uuid')})
          ORDER BY ${N('pr.uuid')}, pr.assigned_at DESC NULLS LAST
       ) mc
       UNION ALL
       SELECT 'cm:' || cm.id, NULL, NULL, cm.display_name, cm.display_name, NULL, NULL, NULL, NULL, NULL, false, false, NULL::timestamptz, NULL::timestamptz
         FROM clan_members cm WHERE cm.minecraft_uuid IS NULL
          -- Akte ohne UUID, die per Name zu einem Konto gehört, steht beim Konto (nicht doppelt)
          AND NOT EXISTS (SELECT 1 FROM users u WHERE lower(cm.display_name) IN (lower(u.username), lower(COALESCE(u.minecraft_username, ''))))
     )
     SELECT p.*, cm.id AS clan_id, cm.join_date AS clan_seit,
            COALESCE(r.priority, $2) AS prio
       FROM personen p
       LEFT JOIN LATERAL (
         SELECT x.id, x.join_date FROM clan_members x
          WHERE (p.uuid IS NOT NULL AND x.minecraft_uuid IS NOT NULL AND ${N('x.minecraft_uuid')} = ${N('p.uuid')}) OR p.key = 'cm:' || x.id
             OR (p.user_id IS NOT NULL AND x.minecraft_uuid IS NULL AND lower(x.display_name) IN (lower(p.username), lower(COALESCE(p.mc_name, ''))))
          ORDER BY (x.minecraft_uuid IS NOT NULL) DESC LIMIT 1
       ) cm ON true
       LEFT JOIN mc_ranks r ON r.id = p.rang_id
      WHERE CASE WHEN $1 = '' THEN (COALESCE(p.rang_id, $3) <> $3 OR cm.id IS NOT NULL OR ($4 AND p.user_id IS NOT NULL))
                 ELSE (p.name ILIKE '%' || $1 || '%' OR p.username ILIKE '%' || $1 || '%' OR p.mc_name ILIKE '%' || $1 || '%') END
      ORDER BY prio DESC, lower(p.name) ASC
      LIMIT ${alle ? 5000 : 400}`,
    [q, std.prioritaet, std.id, alle]
  )
  return NextResponse.json({
    personen: r.rows.map(p => ({
      key: p.key, userId: p.user_id, username: p.username, name: p.name, mcName: p.mc_name, uuid: p.uuid,
      rangId: p.rang_id ?? std.id, vergebenVon: p.assigned_by, vergebenAm: p.assigned_at, zuletztOnline: p.last_seen_at, gesperrt: p.gesperrt,
      clanId: p.clan_id, clanSeit: p.clan_seit, deaktiviert: p.deaktiviert, letzterLogin: p.last_login_at, kontoSeit: p.created_at,
    })),
    standardRang: std.id,
  })
}

export async function POST(req: NextRequest) {
  const user = await mitRecht(req, 'raenge.vergeben')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const neu = await rangNachId(Number(b.rangId))
  if (!neu) return NextResponse.json({ error: 'Rang gibt es nicht' }, { status: 400 })

  // Person bestimmen
  let person: { userId?: string; uuid?: string; name?: string } | null = null
  const key = String(b.key ?? '')
  if (key.startsWith('u:')) person = { userId: key.slice(2) }
  else if (key.startsWith('mc:')) {
    const pr = (await pool.query(`SELECT uuid, player_name FROM mc_player_ranks WHERE ${N('uuid')} = ${N('$1')}`, [key.slice(3)])).rows[0]
    const cm = pr ? null : (await pool.query(`SELECT display_name FROM clan_members WHERE minecraft_uuid IS NOT NULL AND ${N('minecraft_uuid')} = ${N('$1')}`, [key.slice(3)])).rows[0]
    person = pr ? { uuid: pr.uuid, name: pr.player_name } : { uuid: key.slice(3), name: cm?.display_name }
  } else if (key.startsWith('cm:') || b.mcName) {
    // Clan-Akte ohne UUID oder neuer Name: UUID bei Mojang nachschlagen
    let name = String(b.mcName ?? '').trim()
    let clanId: string | null = null
    if (key.startsWith('cm:')) {
      const cm = (await pool.query('SELECT id, display_name FROM clan_members WHERE id = $1', [key.slice(3)])).rows[0]
      if (!cm) return NextResponse.json({ error: 'Clan-Mitglied nicht gefunden' }, { status: 404 })
      name = cm.display_name; clanId = cm.id
    }
    if (!isValidMcName(name)) return NextResponse.json({ error: 'Ungültiger Minecraft-Name' }, { status: 400 })
    const profil = await nameToProfile(name)
    if (!profil) return NextResponse.json({ error: `„${name}“ gibt es bei Minecraft nicht (oder Mojang antwortet gerade nicht)` }, { status: 404 })
    if (clanId) await pool.query('UPDATE clan_members SET minecraft_uuid = $1, display_name = $2 WHERE id = $3', [profil.uuid, profil.name, clanId])
    const konto = (await pool.query(`SELECT id FROM users WHERE minecraft_uuid IS NOT NULL AND ${N('minecraft_uuid')} = ${N('$1')}`, [profil.uuid])).rows[0]
    person = konto ? { userId: konto.id } : { uuid: profil.uuid, name: profil.name }
  }
  if (!person) return NextResponse.json({ error: 'Person nicht gefunden' }, { status: 404 })

  const aktuell = await rangVon(person)
  if (!darfRangGeben(user, aktuell, neu)) {
    return NextResponse.json({ error: 'Diesen Rang darfst du nicht vergeben (oder die Person hat einen höheren Rang als deine Vergabe-Grenze)' }, { status: 403 })
  }
  try {
    await rangSetzen(person, neu.id, user.username)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fehler' }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}

// PATCH {key, minecraft}  Minecraft-Account zuweisen, ohne dass die Person /link im Spiel machen muss.
//   minecraft: Minecraft-Name oder UUID (wird bei Mojang geprüft) – leer = Verbindung lösen (nur bei Konten)
//   key „u:<Konto-ID>“ (Recht konten.verwalten) oder „cm:<Clan-Akte>“ (Recht clan.verwalten)
export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const key = String(b.key ?? '')
  const eingabe = String(b.minecraft ?? '').trim()
  const istKonto = key.startsWith('u:')
  const user = await mitRecht(req, istKonto ? 'konten.verwalten' : 'clan.verwalten')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  if (!istKonto && !key.startsWith('cm:')) return NextResponse.json({ error: 'Nur für Website-Konten und Clan-Akten' }, { status: 400 })
  try {
    if (!eingabe) {
      if (!istKonto) return NextResponse.json({ error: 'Bitte einen Minecraft-Namen oder eine UUID angeben' }, { status: 400 })
      await kontoLoesen(key.slice(2))
      return NextResponse.json({ success: true })
    }
    const profil = await minecraftProfil(eingabe)
    if (!profil) return NextResponse.json({ error: `„${eingabe}“ gibt es bei Minecraft nicht (oder Mojang antwortet gerade nicht)` }, { status: 404 })
    if (istKonto) await kontoVerknuepfen(key.slice(2), profil.uuid, profil.name, user.username)
    else await akteVerknuepfen(key.slice(3), profil.uuid, profil.name)
    return NextResponse.json({ success: true, uuid: profil.uuid, name: profil.name })
  } catch (e) {
    if (e instanceof VerknuepfungsFehler) return NextResponse.json({ error: e.message }, { status: 409 })
    console.error('personen PATCH', e)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
