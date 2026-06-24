import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username } = await context.params

  const userResult = await pool.query(
    `SELECT id, username, display_name, biography, banner_url, background_url, background_blur,
            website_xp, website_level, minecraft_username, discord_username, discord_id,
            profile_picture_url, accent_color, card_opacity, profile_theme, steam_id, steam_username,
            steam_avatar, favorite_games, last_seen_at
     FROM users WHERE username ILIKE $1`,
    [username]
  )
  const user = userResult.rows[0]

  if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const mcName = user.minecraft_username || username

  const clanMemberResult = await pool.query(
    'SELECT role, join_date, stufe_override, id FROM clan_members WHERE display_name = $1',
    [mcName]
  )
  const clanMember = clanMemberResult.rows[0]

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
       json_build_object('id', s.id, 'username', s.username) AS sender,
       json_build_object('id', r.id, 'username', r.username) AS receiver
     FROM friendships f
     JOIN users s ON s.id = f.sender_id
     JOIN users r ON r.id = f.receiver_id
     WHERE (f.sender_id = $1 OR f.receiver_id = $1) AND f.status = 'accepted'`,
    [user.id]
  )

  return NextResponse.json({
    user,
    clanMember: clanMember ? { role: clanMember.role, join_date: clanMember.join_date, stufe_override: clanMember.stufe_override } : null,
    badges,
    friends: friendshipsResult.rows || [],
  })
}