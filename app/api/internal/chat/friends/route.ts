import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/chat/friends?minecraft_uuid=...
// Liefert die Liste der akzeptierten Website-Freunde eines Spielers, anhand
// seiner Minecraft-UUID aufgelöst. Wird vom Plugin für die Ingame-Freundesliste
// und den /chat friend Sichtbarkeitsfilter genutzt.
//
// WICHTIG: Wenn der anfragende Spieler keinen verknüpften Website-Account hat,
// gibt es naturgemäß keine Website-Freundschaften für ihn - leere Liste statt
// Fehler, das ist ein normaler, erwarteter Fall (siehe Konzept: Spieler ohne
// Account können trotzdem ingame chatten, nur eben ohne Freundesliste).
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const minecraftUuid = req.nextUrl.searchParams.get('minecraft_uuid')
  if (!minecraftUuid) {
    return NextResponse.json({ error: 'minecraft_uuid erforderlich' }, { status: 400 })
  }

  const userResult = await pool.query('SELECT id FROM users WHERE minecraft_uuid = $1', [minecraftUuid])
  const user = userResult.rows[0]

  if (!user) {
    return NextResponse.json({ friends: [] })
  }

  const friendsResult = await pool.query(
    `SELECT
       u.minecraft_username, u.minecraft_uuid, u.username
     FROM friendships f
     JOIN users u ON u.id = (CASE WHEN f.sender_id = $1 THEN f.receiver_id ELSE f.sender_id END)
     WHERE f.status = 'accepted' AND (f.sender_id = $1 OR f.receiver_id = $1)`,
    [user.id]
  )

  // Nur Freunde, die selbst auch eine Minecraft-UUID verknüpft haben, sind für
  // die INGAME-Freundesliste relevant (ein reiner Website-Freund ohne
  // Minecraft-Account kann ingame ohnehin nicht angezeigt/angeschrieben werden).
  const ingameFriends = friendsResult.rows.filter(f => f.minecraft_uuid)

  return NextResponse.json({
    friends: ingameFriends.map(f => ({
      minecraft_username: f.minecraft_username,
      minecraft_uuid: f.minecraft_uuid,
    })),
  })
}