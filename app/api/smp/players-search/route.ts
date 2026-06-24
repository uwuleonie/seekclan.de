import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// Sucht Spieler mit Seek-Account (verknüpftem Minecraft-Account), deren Name
// der Suchanfrage ähnelt. Wird für die Permission-Suchleisten verwendet.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (q.length < 2) return NextResponse.json({ players: [] })

  let result
  try {
    result = await pool.query(
      `SELECT minecraft_uuid, minecraft_username FROM users
       WHERE minecraft_uuid IS NOT NULL AND minecraft_username ILIKE $1
       LIMIT 8`,
      [`%${q}%`]
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const players = result.rows
    .filter(u => u.minecraft_uuid && u.minecraft_username)
    .map(u => ({ uuid: u.minecraft_uuid as string, player_name: u.minecraft_username as string }))

  return NextResponse.json({ players })
}