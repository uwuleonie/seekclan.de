import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'
import { editMessage, findLastMessageBySender } from '@/app/lib/message-edit'

// POST /api/internal/chat/edit-last
// Body: { minecraft_uuid, new_content }
//
// Für /edit-last (Konzeptdokument Abschnitt 6): bearbeitet die zuletzt gesendete
// eigene Nachricht des Spielers, unabhängig davon über welchen Kanal sie gesendet
// wurde (Global/GC/MSG/Gruppe).

async function resolveUserId(minecraftUuid: string): Promise<string | null> {
  const result = await pool.query('SELECT id FROM users WHERE minecraft_uuid = $1', [minecraftUuid])
  return result.rows[0]?.id || null
}

export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const { minecraft_uuid, new_content } = await req.json()
  if (!minecraft_uuid || !new_content?.trim()) {
    return NextResponse.json({ error: 'minecraft_uuid und new_content erforderlich' }, { status: 400 })
  }

  const userId = await resolveUserId(minecraft_uuid)
  const lastMessage = await findLastMessageBySender(userId, userId ? null : minecraft_uuid)

  if (!lastMessage) {
    return NextResponse.json({ error: 'Keine eigene Nachricht zum Bearbeiten gefunden' }, { status: 404 })
  }

  const result = await editMessage(lastMessage.id, new_content, {
    userId, minecraftUuid: userId ? null : minecraft_uuid,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}