import { pool } from '@/app/lib/db'
import { alleRaenge, istUmgestellt, standardRang, uuidSql, type Rang } from '@/app/lib/rechte'

// Clan und Team aus dem Rang-System – für /clan, /team und das Admin-Panel (Clan & Abzeichen).
//
//  - Auf /clan steht, wer einen Clan-Rang hat (mc_ranks.clan). Auf /team, wer einen Team-Rang hat (mc_ranks.team).
//  - Die Clan-Akte (Tabelle clan_members) hält Beitrittsdatum, feste Stufe, Discord und Abzeichen. Sie bleibt auch,
//    wenn jemand den Rang wechselt – sie wird nur nicht mehr angezeigt.
//  - Name: Spitzname > Minecraft-Name > Name in der Akte (siehe users.anzeigename).

const N = uuidSql
/** Alte Clan-Rollen (vor der Umstellung) → Rang-Schlüssel */
const ALTE_CLAN_ROLLE: Record<string, string> = { owner: 'orga', admin: 'admin', vip: 'vip', mod: 'clan-mod', mitglied: 'clan' }

export interface ClanPerson {
  /** Clan-Akte (clan_members.id) oder null, wenn die Person keine hat */
  akteId: string | null
  /** Schlüssel für /api/admin2/personen (Rang vergeben) */
  key: string
  name: string
  /** Minecraft-Name für den Kopf */
  mcName: string
  /** Website-Username (Profil-Link) */
  username: string | null
  uuid: string | null
  rang: Pick<Rang, 'id' | 'schluessel' | 'anzeige' | 'farbe' | 'prioritaet' | 'clan' | 'team' | 'beschreibung'>
  beitritt: string | null
  /** Seit wann der Rang gilt (für „im Team seit“) */
  rangSeit: string | null
  stufe_override: number | null
  discord_tag: string | null
  badges: { id: string; name: string; icon_url: string }[]
}

export async function clanUndTeam(): Promise<ClanPerson[]> {
  const [raenge, std, umgestellt] = await Promise.all([alleRaenge(), standardRang(), istUmgestellt()])
  // „Nur im Spiel“-Ränge zählen auf der Website nicht (Person ist dann nicht auf /clan oder /team)
  const rang = (id: number | null | undefined) => { const r = raenge.find(x => x.id === Number(id)); return r?.nurIngame ? std : r }
  const nachSchluessel = (k: string | undefined) => (k ? raenge.find(r => r.schluessel === k) : undefined)

  const [akten, ohneAkte, nurKonto, badges] = await Promise.all([
    // 1. Clan-Akten
    pool.query(
      `SELECT cm.id AS akte_id, cm.display_name, cm.role AS alte_rolle, cm.join_date, cm.discord_tag, cm.stufe_override, cm.minecraft_uuid AS uuid,
              u.id AS user_id, u.username, u.anzeigename, u.minecraft_username, u.minecraft_uuid AS konto_uuid, u.rang_id, pr.player_name, pr.rank_id, pr.assigned_at
         FROM clan_members cm
         -- Konto zur Akte: über die UUID, sonst über den Minecraft-Namen, sonst über den Website-Usernamen (genau eins)
         LEFT JOIN LATERAL (
           SELECT x.* FROM users x
            WHERE (cm.minecraft_uuid IS NOT NULL AND x.minecraft_uuid IS NOT NULL AND ${N('x.minecraft_uuid')} = ${N('cm.minecraft_uuid')})
               OR (cm.minecraft_uuid IS NULL AND (lower(x.minecraft_username) = lower(cm.display_name) OR lower(x.username) = lower(cm.display_name)))
            ORDER BY (cm.minecraft_uuid IS NOT NULL AND x.minecraft_uuid IS NOT NULL AND ${N('x.minecraft_uuid')} = ${N('cm.minecraft_uuid')}) DESC,
                     (lower(x.minecraft_username) = lower(cm.display_name)) DESC NULLS LAST
            LIMIT 1
         ) u ON true
         LEFT JOIN mc_player_ranks pr ON pr.uuid IS NOT NULL AND ${N('pr.uuid')} = ${N('COALESCE(cm.minecraft_uuid, u.minecraft_uuid)')}`
    ),
    // 2. Spieler mit Clan-/Team-Rang ohne Akte
    pool.query(
      `SELECT pr.uuid, pr.player_name, pr.rank_id, pr.assigned_at, u.id AS user_id, u.username, u.anzeigename, u.minecraft_username
         FROM mc_player_ranks pr
         JOIN mc_ranks r ON r.id = pr.rank_id AND (COALESCE(r.clan, false) OR COALESCE(r.team, false))
         LEFT JOIN users u ON u.minecraft_uuid IS NOT NULL AND ${N('u.minecraft_uuid')} = ${N('pr.uuid')}
        WHERE NOT EXISTS (SELECT 1 FROM clan_members cm WHERE cm.minecraft_uuid IS NOT NULL AND ${N('cm.minecraft_uuid')} = ${N('pr.uuid')})`
    ),
    // 3. Website-Konten ohne Minecraft mit Clan-/Team-Rang
    pool.query(
      `SELECT u.id AS user_id, u.username, u.anzeigename, u.rang_id
         FROM users u JOIN mc_ranks r ON r.id = u.rang_id AND (COALESCE(r.clan, false) OR COALESCE(r.team, false))
        WHERE u.minecraft_uuid IS NULL
          AND NOT EXISTS (SELECT 1 FROM clan_members cm WHERE cm.minecraft_uuid IS NULL AND lower(cm.display_name) = lower(u.username))`
    ),
    pool.query(
      `SELECT cmb.member_id, cb.id, cb.name, cb.icon_url FROM clan_member_badges cmb JOIN clan_badges cb ON cb.id = cmb.badge_id`
    ),
  ])

  const badgesVon = new Map<string, ClanPerson['badges']>()
  for (const b of badges.rows) {
    const l = badgesVon.get(b.member_id) ?? []
    l.push({ id: b.id, name: b.name, icon_url: b.icon_url })
    badgesVon.set(b.member_id, l)
  }
  const kurz = (r: Rang): ClanPerson['rang'] => ({ id: r.id, schluessel: r.schluessel, anzeige: r.anzeige, farbe: r.farbe, prioritaet: r.prioritaet, clan: r.clan, team: r.team, beschreibung: r.beschreibung })

  const out: ClanPerson[] = []
  for (const a of akten.rows) {
    let r = rang(a.rank_id) ?? rang(a.rang_id)
    if (!umgestellt && (!r || r.standard)) r = nachSchluessel(ALTE_CLAN_ROLLE[String(a.alte_rolle ?? '').toLowerCase()]) ?? r
    const uuid = a.uuid ?? a.konto_uuid ?? null
    out.push({
      akteId: a.akte_id, key: a.user_id ? `u:${a.user_id}` : uuid ? `mc:${uuid}` : `cm:${a.akte_id}`,
      name: a.anzeigename || a.minecraft_username || a.player_name || a.display_name, mcName: a.minecraft_username || a.player_name || a.display_name,
      username: a.username ?? null, uuid, rang: kurz(r ?? std), beitritt: a.join_date, rangSeit: a.assigned_at ?? null,
      stufe_override: a.stufe_override ?? null, discord_tag: a.discord_tag ?? null, badges: badgesVon.get(a.akte_id) ?? [],
    })
  }
  // Wer über seine Akte schon drin ist (auch wenn die Akte noch keine UUID hat), kommt nicht ein zweites Mal
  const schonDa = { konten: new Set(akten.rows.map(a => a.user_id).filter(Boolean).map(String)), uuids: new Set<string>() }
  for (const a of akten.rows) for (const x of [a.uuid, a.konto_uuid]) if (x) schonDa.uuids.add(String(x).replace(/-/g, '').toLowerCase())
  for (const p of ohneAkte.rows) {
    if ((p.user_id && schonDa.konten.has(String(p.user_id))) || schonDa.uuids.has(String(p.uuid).replace(/-/g, '').toLowerCase())) continue
    const r = rang(p.rank_id) ?? std
    out.push({
      akteId: null, key: p.user_id ? `u:${p.user_id}` : `mc:${p.uuid}`, name: p.anzeigename || p.minecraft_username || p.player_name, mcName: p.minecraft_username || p.player_name,
      username: p.username ?? null, uuid: p.uuid, rang: kurz(r), beitritt: null, rangSeit: p.assigned_at ?? null, stufe_override: null, discord_tag: null, badges: [],
    })
  }
  for (const u of nurKonto.rows) {
    if (schonDa.konten.has(String(u.user_id))) continue
    const r = rang(u.rang_id) ?? std
    out.push({
      akteId: null, key: `u:${u.user_id}`, name: u.anzeigename || u.username, mcName: u.username, username: u.username, uuid: null,
      rang: kurz(r), beitritt: null, rangSeit: null, stufe_override: null, discord_tag: null, badges: [],
    })
  }
  return out
}
