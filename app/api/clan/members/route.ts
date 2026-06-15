import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

export async function GET() {
  try {
    const { data: members, error } = await supabaseAdmin
      .from('clan_members')
      .select(`
        id,
        display_name,
        role,
        join_date,
        discord_tag,
        clan_member_badges (
          badge_id,
          clan_badges (
            id,
            name,
            icon_url
          )
        )
      `)
      .order('join_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 })
    }

    // Badges sauber formatieren
    const formatted = (members || []).map(member => ({
      ...member,
      badges: member.clan_member_badges?.map((b: any) => b.clan_badges) || [],
      clan_member_badges: undefined,
    }))

    return NextResponse.json({ members: formatted })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}