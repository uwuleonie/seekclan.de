import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { canEditConcept } from '../../../lib/conceptAccess'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

// POST /api/admin2/concepts/[conceptId]/parse-text
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conceptId: string }> }
) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { conceptId } = await context.params
  if (!(await canEditConcept(user.id, user.clan_role, conceptId))) {
    return NextResponse.json({ error: 'Kein Bearbeitungszugriff auf dieses Konzept' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { text } = body as { text?: string }

  if (!text?.trim()) {
    return NextResponse.json({ error: 'Text darf nicht leer sein' }, { status: 400 })
  }

  const lines = text.split('\n')
  const blocks: { title: string, description: string }[] = []
  let current: { title: string, description: string[] } | null = null

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line.trim().startsWith('#')) {
      if (current) blocks.push({ title: current.title, description: current.description.join('\n').trim() })
      current = { title: line.replace(/^#+\s*/, '').trim(), description: [] }
    } else if (current) {
      current.description.push(line)
    }
  }
  if (current) blocks.push({ title: current.title, description: current.description.join('\n').trim() })

  const validBlocks = blocks.filter(b => b.title.length > 0)
  if (validBlocks.length === 0) {
    return NextResponse.json({ error: 'Kein Baustein erkannt - jeder Baustein braucht eine Zeile, die mit "#" beginnt' }, { status: 400 })
  }

  try {
    const existingResult = await pool.query(
      `SELECT COALESCE(MAX(position_y), -160) AS max_y FROM admin_concept_nodes WHERE concept_id = $1`,
      [conceptId]
    )
    const startY = existingResult.rows[0].max_y + 160

    const createdNodeIds: string[] = []
    for (let i = 0; i < validBlocks.length; i++) {
      const block = validBlocks[i]
      const nodeResult = await pool.query(
        `INSERT INTO admin_concept_nodes (concept_id, title, description, status, position_x, position_y)
         VALUES ($1, $2, $3, 'offen', $4, $5)
         RETURNING id`,
        [conceptId, block.title, block.description, 80, startY + i * 160]
      )
      const nodeId = nodeResult.rows[0].id
      createdNodeIds.push(nodeId)

      if (i < validBlocks.length - 1) {
        await pool.query(
          `INSERT INTO admin_concept_node_outputs (node_id, label, sort_order) VALUES ($1, '', 0)`,
          [nodeId]
        )
      }
    }

    for (let i = 0; i < createdNodeIds.length - 1; i++) {
      const outputResult = await pool.query(
        `SELECT id FROM admin_concept_node_outputs WHERE node_id = $1 LIMIT 1`,
        [createdNodeIds[i]]
      )
      const outputId = outputResult.rows[0]?.id
      if (outputId) {
        await pool.query(
          `INSERT INTO admin_concept_edges (concept_id, source_output_id, target_node_id) VALUES ($1, $2, $3)`,
          [conceptId, outputId, createdNodeIds[i + 1]]
        )
      }
    }

    return NextResponse.json({ createdCount: validBlocks.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}