import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { verifyPluginKey } from '@/app/lib/plugin-auth'

// GET /api/internal/lobby-config — Plugin lädt NPCs und Kompass
export async function GET(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [npcResult, compassResult] = await Promise.all([
      pool.query(
        `SELECT id, name, display_name, skin_username, skin_uuid,
                world, pos_x, pos_y, pos_z, yaw, pitch,
                action_type, action_value, dialog, bubble_text
         FROM lobby_npcs ORDER BY id ASC`
      ),
      pool.query(
        `SELECT id, label, server_id, material, lore, sort_order
         FROM lobby_compass_items WHERE enabled = true ORDER BY sort_order ASC`
      ),
    ])

    return NextResponse.json({
      npcs: npcResult.rows,
      compass: compassResult.rows,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/internal/lobby-config — Plugin setzt NPC-Position via /setnpchere
export async function POST(req: NextRequest) {
  if (!await verifyPluginKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { npc_id, world, pos_x, pos_y, pos_z, yaw, pitch } = body as {
    npc_id?: number
    world?: string
    pos_x?: number
    pos_y?: number
    pos_z?: number
    yaw?: number
    pitch?: number
  }

  if (!npc_id || world === undefined || pos_x === undefined || pos_y === undefined || pos_z === undefined) {
    return NextResponse.json({ error: 'npc_id, world, pos_x, pos_y, pos_z erforderlich' }, { status: 400 })
  }

  await pool.query(
    `UPDATE lobby_npcs SET world = $1, pos_x = $2, pos_y = $3, pos_z = $4, yaw = $5, pitch = $6 WHERE id = $7`,
    [world, pos_x, pos_y, pos_z, yaw ?? 0, pitch ?? 0, npc_id]
  )

  return NextResponse.json({ success: true })
}