import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username } = await context.params

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, username, biography, banner_url, background_url, background_blur, website_xp, website_level, minecraft_username, discord_username')
    .ilike('username', username)
    .single()

  if (!user) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const mcName = user.minecraft_username || username

  const { data: clanMember } = await supabaseAdmin
    .from('clan_members')
    .select('role, join_date, stufe_override')
    .eq('display_name', mcName)
    .single()

  const { data: memberRow } = await supabaseAdmin
    .from('clan_members')
    .select('id')
    .eq('display_name', mcName)
    .single()

  const { data: badges } = memberRow ? await supabaseAdmin
    .from('clan_member_badges')
    .select('clan_badges ( id, name, icon_url, badge_categories ( name, color ) )')
    .eq('member_id', memberRow.id) : { data: [] }

  const { data: friendships } = await supabaseAdmin
    .from('friendships')
    .select('id, status, sender:sender_id ( id, username ), receiver:receiver_id ( id, username )')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq('status', 'accepted')

  return NextResponse.json({
    user,
    clanMember: clanMember || null,
    badges: badges?.map((b: any) => b.clan_badges).filter(Boolean) || [],
    friends: friendships || [],
  })
}