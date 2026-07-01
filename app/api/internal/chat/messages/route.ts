import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'
import { indexLinksInMessage } from '@/app/lib/link-detection'

type SenderInput = {
  minecraft_uuid: string
  minecraft_username: string
}

type LocationInput = {
  // Entweder claim_name/claim_group_name (wenn im Claim) ODER chunk_x/chunk_z (wenn Wildnis).
  // Wird vom Plugin fertig aufgelöst mitgeschickt (ClaimManager kennt den Claim/die Gruppe
  // schon, das Plugin muss also nicht "label" selbst zusammenbauen - die Route entscheidet
  // nur noch die FORMATIERUNG dieses Labels, nicht die zugrunde liegenden Daten).
  claim_name?: string | null
  claim_group_name?: string | null
  chunk_x?: number | null
  chunk_z?: number | null
}

// Sucht die users.id zu einer Minecraft-UUID, falls der Spieler verknüpft ist.
// Gibt null zurück, wenn nicht verknüpft (dann läuft alles über den
// Minecraft-UUID-Fallback aus Block 6 statt über users.id).
async function resolveUserId(minecraftUuid: string): Promise<string | null> {
  const result = await pool.query('SELECT id FROM users WHERE minecraft_uuid = $1', [minecraftUuid])
  return result.rows[0]?.id || null
}

function buildLocationLabel(location: LocationInput | undefined): { label: string | null, chunkX: number | null, chunkZ: number | null } {
  if (!location) return { label: null, chunkX: null, chunkZ: null }

  if (location.claim_group_name) {
    return { label: `Gruppe: ${location.claim_group_name}`, chunkX: null, chunkZ: null }
  }
  if (location.claim_name) {
    return { label: location.claim_name, chunkX: null, chunkZ: null }
  }
  if (location.chunk_x !== undefined && location.chunk_x !== null && location.chunk_z !== undefined && location.chunk_z !== null) {
    return { label: 'Wildnis', chunkX: location.chunk_x, chunkZ: location.chunk_z }
  }
  return { label: null, chunkX: null, chunkZ: null }
}

// Fügt einen Teilnehmer (Sender oder Ziel) als Mitglied einer Konversation hinzu,
// falls er es noch nicht ist - funktioniert sowohl für verknüpfte (userId gesetzt)
// als auch nicht-verknüpfte Spieler (nur minecraftUuid gesetzt).
async function ensureMember(
  conversationId: string,
  userId: string | null,
  minecraftUuid: string | null,
  minecraftUsername: string | null
) {
  if (userId) {
    await pool.query(
      `INSERT INTO conversation_members (conversation_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conversationId, userId]
    )
  } else if (minecraftUuid) {
    await pool.query(
      `INSERT INTO conversation_members (conversation_id, member_minecraft_uuid, member_minecraft_username)
       VALUES ($1, $2, $3)
       ON CONFLICT (conversation_id, member_minecraft_uuid) DO UPDATE SET member_minecraft_username = EXCLUDED.member_minecraft_username`,
      [conversationId, minecraftUuid, minecraftUsername]
    )
  }
}

// Findet oder erstellt die direct-Konversation zwischen Sender und Ziel.
// Beide Seiten können jeweils verknüpft ODER nicht-verknüpft sein - alle vier
// Kombinationen werden unterstützt (siehe Konzept: "auch wenn beide keinen
// Account haben wird die Konversation trotzdem erstellt").
async function findOrCreateDirectConversation(
  senderUserId: string | null, senderMcUuid: string | null,
  targetUserId: string | null, targetMcUuid: string | null
): Promise<string> {
  // Suche nach einer direct-Konversation, die GENAU diese zwei Teilnehmer hat
  // (unabhängig davon ob über user_id oder member_minecraft_uuid identifiziert).
  const existingResult = await pool.query(
    `SELECT c.id
     FROM conversations c
     WHERE c.type = 'direct'
       AND EXISTS (
         SELECT 1 FROM conversation_members cm1 WHERE cm1.conversation_id = c.id
           AND ((($1::uuid IS NOT NULL AND cm1.user_id = $1) OR ($2::text IS NOT NULL AND cm1.member_minecraft_uuid = $2)))
       )
       AND EXISTS (
         SELECT 1 FROM conversation_members cm2 WHERE cm2.conversation_id = c.id
           AND ((($3::uuid IS NOT NULL AND cm2.user_id = $3) OR ($4::text IS NOT NULL AND cm2.member_minecraft_uuid = $4)))
       )
     LIMIT 1`,
    [senderUserId, senderMcUuid, targetUserId, targetMcUuid]
  )
  if (existingResult.rows[0]) return existingResult.rows[0].id

  const newConvResult = await pool.query(
    `INSERT INTO conversations (type) VALUES ('direct') RETURNING id`
  )
  const conversationId = newConvResult.rows[0].id
  return conversationId
}

// Findet oder erstellt die feste GC-Konversation für eine Claim-Gruppe, hält
// die Mitgliederliste synchron mit den aktuellen Claim-Besitzern dieser Gruppe,
// und liefert den aktuellen Gruppennamen mit zurück (für das location_label
// der Nachricht - claim_groups.name kann vom Spieler auf der Website gesetzt
// werden, das Plugin selbst kennt/cached diesen Namen nicht).
async function findOrCreateGcConversation(claimGroupId: string): Promise<{ conversationId: string, groupName: string }> {
  const existingResult = await pool.query(
    `SELECT id FROM conversations WHERE type = 'gc' AND claim_group_id = $1 LIMIT 1`,
    [claimGroupId]
  )

  let conversationId: string
  if (existingResult.rows[0]) {
    conversationId = existingResult.rows[0].id
  } else {
    const newConvResult = await pool.query(
      `INSERT INTO conversations (type, claim_group_id) VALUES ('gc', $1) RETURNING id`,
      [claimGroupId]
    )
    conversationId = newConvResult.rows[0].id
  }

  // Mitgliederliste synchron halten: alle aktuellen distinct Claim-Besitzer
  // dieser Gruppe sollen Mitglied der GC sein. Wer keinen Claim mehr in der
  // Gruppe hat, wird NICHT automatisch entfernt (der Chatlog bleibt für
  // ehemalige Mitglieder einsehbar, siehe Konzept Abschnitt 13.4) - nur
  // NEUE Besitzer werden ergänzt.
  const ownersResult = await pool.query(
    `SELECT DISTINCT owner_uuid, owner_name FROM claims WHERE group_id = $1`,
    [claimGroupId]
  )
  for (const owner of ownersResult.rows) {
    const userId = await resolveUserId(owner.owner_uuid)
    await ensureMember(conversationId, userId, userId ? null : owner.owner_uuid, userId ? null : owner.owner_name)
  }

  // Gruppenname auflösen: claim_groups.name (vom Spieler über die Website
  // gesetzt) falls vorhanden, sonst Fallback auf den Namen des Gruppen-Owners.
  const groupResult = await pool.query(
    'SELECT name, owner_name FROM claim_groups WHERE id = $1',
    [claimGroupId]
  )
  const group = groupResult.rows[0]
  const groupName = group?.name || (group?.owner_name ? `${group.owner_name}s Gruppe` : `Gruppe #${claimGroupId}`)

  return { conversationId, groupName }
}

// Findet die EINE globale Konversation, oder legt sie an, falls sie noch nicht existiert.
async function findOrCreateGlobalConversation(): Promise<string> {
  const existingResult = await pool.query(`SELECT id FROM conversations WHERE type = 'global' LIMIT 1`)
  if (existingResult.rows[0]) return existingResult.rows[0].id

  const newConvResult = await pool.query(`INSERT INTO conversations (type, name) VALUES ('global', 'Globaler Chat') RETURNING id`)
  return newConvResult.rows[0].id
}

// POST /api/internal/chat/messages
// Body: {
//   kind: 'msg' | 'gc' | 'global',
//   sender: { minecraft_uuid, minecraft_username },
//   content: string,
//   location?: { claim_name?, claim_group_name?, chunk_x?, chunk_z? },
//   // nur bei kind='msg':
//   target?: { minecraft_uuid, minecraft_username },
//   // nur bei kind='gc':
//   claim_group_id?: string,
// }
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Ungültiger API Key' }, { status: 401 })
  }

  const body = await req.json()
  const { kind, sender, content, location, target, claim_group_id } = body as {
    kind: 'msg' | 'gc' | 'global'
    sender: SenderInput
    content: string
    location?: LocationInput
    target?: SenderInput
    claim_group_id?: string
  }

  if (!kind || !sender?.minecraft_uuid || !content?.trim()) {
    return NextResponse.json({ error: 'kind, sender und content sind erforderlich' }, { status: 400 })
  }

  const senderUserId = await resolveUserId(sender.minecraft_uuid)
  let resolvedGroupName: string | null = null

  let conversationId: string
  try {
    if (kind === 'msg') {
      if (!target?.minecraft_uuid) {
        return NextResponse.json({ error: 'target erforderlich für kind=msg' }, { status: 400 })
      }
      const targetUserId = await resolveUserId(target.minecraft_uuid)
      conversationId = await findOrCreateDirectConversation(
        senderUserId, senderUserId ? null : sender.minecraft_uuid,
        targetUserId, targetUserId ? null : target.minecraft_uuid
      )
      await ensureMember(conversationId, senderUserId, senderUserId ? null : sender.minecraft_uuid, sender.minecraft_username)
      await ensureMember(conversationId, targetUserId, targetUserId ? null : target.minecraft_uuid, target.minecraft_username)
    } else if (kind === 'gc') {
      if (!claim_group_id) {
        return NextResponse.json({ error: 'claim_group_id erforderlich für kind=gc' }, { status: 400 })
      }
      const gcResult = await findOrCreateGcConversation(claim_group_id)
      conversationId = gcResult.conversationId
      resolvedGroupName = gcResult.groupName
    } else if (kind === 'global') {
      conversationId = await findOrCreateGlobalConversation()
      await ensureMember(conversationId, senderUserId, senderUserId ? null : sender.minecraft_uuid, sender.minecraft_username)
    } else {
      return NextResponse.json({ error: 'Ungültiges kind' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Konversation konnte nicht aufgelöst werden: ${err.message}` }, { status: 500 })
  }

  // Bei kind='gc' wird der Gruppenname von der Route selbst aufgelöst
  // (claim_groups.name), das Plugin muss ihn nicht mitschicken/kennen -
  // überschreibt ein eventuell mitgeschicktes location.claim_group_name.
  const effectiveLocation: LocationInput | undefined = resolvedGroupName
    ? { ...location, claim_group_name: resolvedGroupName }
    : location

  const { label, chunkX, chunkZ } = buildLocationLabel(effectiveLocation)

  let message
  try {
    const result = await pool.query(
      `INSERT INTO messages (
         conversation_id, sender_id, sender_minecraft_uuid, content,
         location_label, location_chunk_x, location_chunk_z
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [
        conversationId,
        senderUserId,
        senderUserId ? null : sender.minecraft_uuid,
        content.trim(),
        label, chunkX, chunkZ,
      ]
    )
    message = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: `Nachricht konnte nicht gespeichert werden: ${err.message}` }, { status: 500 })
  }

  await indexLinksInMessage(message.id, conversationId, content.trim(), {
    userId: senderUserId, minecraftUuid: senderUserId ? null : sender.minecraft_uuid, minecraftUsername: senderUserId ? null : sender.minecraft_username,
  })

  return NextResponse.json({
    conversation_id: conversationId,
    message_id: message.id,
    created_at: message.created_at,
    group_name: resolvedGroupName,
  })
}