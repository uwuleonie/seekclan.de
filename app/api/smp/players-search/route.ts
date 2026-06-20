import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

// Sucht Spieler mit Seek-Account (verknüpftem Minecraft-Account), deren Name
// der Suchanfrage ähnelt. Wird für die Permission-Suchleisten verwendet.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (q.length < 2) return NextResponse.json({ players: [] })

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('minecraft_uuid, minecraft_username')
    .not('minecraft_uuid', 'is', null)
    .ilike('minecraft_username', `%${q}%`)
    .limit(8)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const players = (data || [])
    .filter(u => u.minecraft_uuid && u.minecraft_username)
    .map(u => ({ uuid: u.minecraft_uuid as string, player_name: u.minecraft_username as string }))

  return NextResponse.json({ players })
}