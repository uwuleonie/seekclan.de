import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/chat/last-msg-target?minecraft_uuid=...
// Liefert den Minecraft-Namen/UUID der Person, an die der Spieler zuletzt eine
// direct-Nachricht (per /msg) geschickt hat - für /r (Reply) und /chat msg.
//
// Bewusst KEINE eigene Tabelle dafür: wird einfach aus der letzten eigenen
// Nachricht in einer direct-Konversation abgeleitet (über die ANDERE Person
// in derselben Konversation), spart eine zusätzliche Schreiblast bei jeder
// Nachricht nur für dieses eine Feature.
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const minecraftUuid = req.nextUrl.searchParams.get('minecraft_uuid')
  if (!minecraftUuid) {
    return NextResponse.json({ error: 'minecraft_uuid erforderlich' }, { status: 400 })
  }

  const userResult = await pool.query('SELECT id FROM users WHERE minecraft_uuid = $1', [minecraftUuid])
  const userId = userResult.rows[0]?.id || null

  // Letzte Nachricht, die DIESER Spieler (egal ob verknüpft oder nicht) in
  // einer direct-Konversation geschrieben hat.
  const lastMessageResult = await pool.query(
    `SELECT m.conversation_id
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.type = 'direct'
       AND ((($1::uuid IS NOT NULL AND m.sender_id = $1)) OR (($2::text IS NOT NULL AND m.sender_minecraft_uuid = $2)))
     ORDER BY m.created_at DESC
     LIMIT 1`,
    [userId, userId ? null : minecraftUuid]
  )

  const lastConversationId = lastMessageResult.rows[0]?.conversation_id
  if (!lastConversationId) {
    return NextResponse.json({ target: null })
  }

  // Den ANDEREN Teilnehmer dieser Konversation finden (egal ob über user_id
  // oder member_minecraft_uuid identifiziert), und seine Minecraft-Daten liefern.
  const otherMemberResult = await pool.query(
    `SELECT
       COALESCE(u.minecraft_username, cm.member_minecraft_username) AS minecraft_username,
       COALESCE(u.minecraft_uuid, cm.member_minecraft_uuid) AS minecraft_uuid
     FROM conversation_members cm
     LEFT JOIN users u ON u.id = cm.user_id
     WHERE cm.conversation_id = $1
       AND NOT (
         (($2::uuid IS NOT NULL AND cm.user_id = $2)) OR (($3::text IS NOT NULL AND cm.member_minecraft_uuid = $3))
       )
     LIMIT 1`,
    [lastConversationId, userId, userId ? null : minecraftUuid]
  )

  const other = otherMemberResult.rows[0]
  if (!other?.minecraft_uuid) {
    return NextResponse.json({ target: null })
  }

  return NextResponse.json({
    target: { minecraft_username: other.minecraft_username, minecraft_uuid: other.minecraft_uuid },
  })
}