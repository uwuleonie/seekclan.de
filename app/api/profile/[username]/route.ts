import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { rangVon, uuidSql } from '@/app/lib/rechte'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username } = await context.params

  const userResult = await pool.query(
    `SELECT id, username, display_name, biography, banner_url, background_url, background_blur,
            website_xp, website_level, minecraft_username, discord_username, discord_id,
            profile_picture_url, accent_color, card_opacity, profile_theme, steam_id, steam_username,
            steam_avatar, favorite_games, status_text, glass_config, last_seen_at, minecraft_uuid, anzeigename
     FROM users WHERE username ILIKE $1`,
    [username]
  )
  const user = userResult.rows[0]

  if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  // Rang (Rang-System) und Clan-Akte (über die Minecraft-UUID, sonst über den Minecraft-Namen)
  const rang = await rangVon({ userId: user.id, uuid: user.minecraft_uuid })
  const clanMemberResult = await pool.query(
    `SELECT id, join_date, stufe_override FROM clan_members
      WHERE ($1::text IS NOT NULL AND minecraft_uuid IS NOT NULL AND ${uuidSql('minecraft_uuid')} = ${uuidSql('$1')})
         OR (minecraft_uuid IS NULL AND lower(display_name) = lower($2))
      LIMIT 1`,
    [user.minecraft_uuid, user.minecraft_username || username]
  )
  const akte = clanMemberResult.rows[0]
  // Clan-Infos nur, solange die Person einen Clan-Rang hat
  const clanMember = akte && rang.clan ? akte : null
  // Anzeigename: Spitzname (nach der Minecraft-Verknüpfung) > Minecraft-Name > Username
  const { minecraft_uuid: _uuid, anzeigename, ...oeffentlich } = user
  oeffentlich.display_name = anzeigename || user.minecraft_username || user.username
  // name = derselbe Anzeigename, analog zu den übrigen APIs (username bleibt für Links)
  oeffentlich.name = oeffentlich.display_name

  let badges: any[] = []
  if (clanMember) {
    const badgesResult = await pool.query(
      `SELECT
         cb.id, cb.name, cb.icon_url,
         json_build_object('name', bc.name, 'color', bc.color) AS badge_categories
       FROM clan_member_badges cmb
       JOIN clan_badges cb ON cb.id = cmb.badge_id
       LEFT JOIN badge_categories bc ON bc.id = cb.category_id
       WHERE cmb.member_id = $1`,
      [clanMember.id]
    )
    badges = badgesResult.rows
  }

  const friendshipsResult = await pool.query(
    `SELECT
       f.id, f.status,
       json_build_object('id', s.id, 'username', s.username, 'name', COALESCE(s.anzeigename, s.username)) AS sender,
       json_build_object('id', r.id, 'username', r.username, 'name', COALESCE(r.anzeigename, r.username)) AS receiver
     FROM friendships f
     JOIN users s ON s.id = f.sender_id
     JOIN users r ON r.id = f.receiver_id
     WHERE (f.sender_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'`,
    [user.id]
  )

  return NextResponse.json({
    user: oeffentlich,
    rang: { anzeige: rang.anzeige, farbe: rang.farbe, standard: rang.standard },
    clanMember: clanMember ? { role: rang.anzeige, farbe: rang.farbe, join_date: clanMember.join_date, stufe_override: clanMember.stufe_override } : null,
    badges,
    friends: friendshipsResult.rows || [],
  })
}