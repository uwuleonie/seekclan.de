import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

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

// Findet zusammenhängende Komponenten (Union-Find) unter den Nodes eines
// Konzepts, basierend auf den Edges (über deren Outputs). Zwei Nodes gehören
// zur selben Gruppe, wenn irgendein Ausgang des einen zum anderen führt -
// unabhängig von der Richtung, da es hier nicht um Ablauf-Reihenfolge geht,
// sondern nur darum "gehören diese Bausteine sichtbar zusammen".
function groupConnectedNodes(nodeIds: string[], edges: { source_node_id: string, target_node_id: string }[]) {
  const parent = new Map<string, string>()
  nodeIds.forEach(id => parent.set(id, id))
  const find = (id: string): string => {
    while (parent.get(id) !== id) {
      parent.set(id, parent.get(parent.get(id)!)!)
      id = parent.get(id)!
    }
    return id
  }
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  edges.forEach(e => union(e.source_node_id, e.target_node_id))

  const groups = new Map<string, string[]>()
  nodeIds.forEach(id => {
    const root = find(id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(id)
  })
  return [...groups.values()]
}

// GET /api/admin2/concepts
// Liefert alle Konzepte. Bausteine, die über Verbindungen zusammenhängen,
// werden zu einer gemeinsamen "Gruppe" zusammengefasst - eine Gruppe zählt in
// der Fortschrittsanzeige als EIN Posten (z.B. 1 von 3 verbundenen Bausteinen
// fertig = 33%). Einzelne, nicht verbundene Bausteine bilden ihre eigene
// Gruppe mit nur einem Mitglied. Der Gruppenname ist standardmäßig der Titel
// des zuerst erstellten Bausteins der Gruppe, kann aber über
// group_name_override auf einem beliebigen Mitglied überschrieben werden.
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const conceptsResult = await pool.query(
      `SELECT c.id, c.title, c.created_at, c.owner_id, u.username AS owner_username,
              c.is_text_only, c.content_text, c.is_finished
       FROM admin_concepts c
       LEFT JOIN users u ON u.id = c.owner_id
       ORDER BY c.created_at ASC`
    )

    const nodesResult = await pool.query(
      `SELECT id, concept_id, title, status, group_name_override, created_at
       FROM admin_concept_nodes ORDER BY created_at ASC`
    )

    const edgesResult = await pool.query(
      `SELECT e.concept_id, o.node_id AS source_node_id, e.target_node_id
       FROM admin_concept_edges e
       JOIN admin_concept_node_outputs o ON o.id = e.source_output_id`
    )

    const tagsResult = await pool.query(
      `SELECT l.concept_id, t.id, t.name, t.color
       FROM admin_concept_tag_links l
       JOIN admin_concept_tags t ON t.id = l.tag_id`
    )

    const concepts = conceptsResult.rows.map(concept => {
      const nodes = nodesResult.rows.filter(n => n.concept_id === concept.id)
      const edges = edgesResult.rows.filter(e => e.concept_id === concept.id)
      const nodeIds = nodes.map(n => n.id)
      const componentGroups = groupConnectedNodes(nodeIds, edges)

      const groups = componentGroups.map(memberIds => {
        const members = nodes.filter(n => memberIds.includes(n.id))
        members.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        const nameOverride = members.find(m => m.group_name_override)?.group_name_override
        const doneCount = members.filter(m => m.status === 'fertig').length
        return {
          name: nameOverride || members[0]?.title || 'Baustein',
          nameOverride: nameOverride || null,
          mainNodeId: members[0]?.id,
          members: members.map(m => ({ id: m.id, title: m.title, status: m.status })),
          doneCount,
          totalCount: members.length,
          progress: members.length > 0 ? Math.round((doneCount / members.length) * 100) : 0,
        }
      })

      const totalDone = nodes.filter(n => n.status === 'fertig').length
      const overallProgress = nodes.length > 0 ? Math.round((totalDone / nodes.length) * 100) : 0

      // Baustein-Konzepte gelten automatisch als fertig, sobald alle Bausteine
      // fertig sind (und es überhaupt welche gibt). Text-Konzepte haben keine
      // Bausteine, an denen sich das ablesen ließe - dort zählt der manuell
      // gesetzte is_finished-Wert aus der DB.
      const isFinished = concept.is_text_only
        ? concept.is_finished
        : nodes.length > 0 && overallProgress === 100

      return {
        id: concept.id, title: concept.title, groups, doneCount: totalDone, totalCount: nodes.length, progress: overallProgress,
        ownerId: concept.owner_id, ownerUsername: concept.owner_username,
        isTextOnly: concept.is_text_only, contentText: concept.content_text, isFinished,
        tags: tagsResult.rows.filter(t => t.concept_id === concept.id).map(t => ({ id: t.id, name: t.name, color: t.color })),
      }
    })

    return NextResponse.json({ concepts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/concepts
export async function POST(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { title, isTextOnly } = body as { title?: string, isTextOnly?: boolean }
  if (!title?.trim()) {
    return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })
  }

  try {
    const result = await pool.query(
      `INSERT INTO admin_concepts (title, created_by, owner_id, is_text_only) VALUES ($1, $2, $2, $3) RETURNING id`,
      [title.trim(), user.id, isTextOnly !== false]
    )
    return NextResponse.json({ id: result.rows[0].id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}