import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

// GET /api/admin2/overview
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const safeQuery = async (q: string, params?: any[]) => {
      try { return (await pool.query(q, params)).rows } catch { return [] }
    }

    const [ticketsRows, ideasRows, conceptsRows, chatRows] = await Promise.all([
      safeQuery(`SELECT COUNT(*) AS count FROM support_tickets WHERE status = 'open'`),
      safeQuery(`
        SELECT i.id, i.title, i.tag, i.created_at, u.username AS author_username
        FROM ideas i
        LEFT JOIN users u ON u.id = i.author_id
        ORDER BY i.created_at DESC LIMIT 5
      `),
      safeQuery(`
        SELECT c.id, c.title, c.is_text_only, c.is_finished,
          COUNT(n.id) AS total,
          COUNT(CASE WHEN n.status = 'fertig' THEN 1 END) AS done
        FROM admin_concepts c
        LEFT JOIN admin_concept_nodes n ON n.concept_id = c.id
        WHERE c.is_finished = false
        GROUP BY c.id
        ORDER BY c.created_at DESC LIMIT 4
      `),
      safeQuery(`
        SELECT m.content, m.created_at, u.username, u.clan_role
        FROM admin_team_messages m
        JOIN users u ON u.id = m.user_id
        WHERE m.channel = 'team-lounge'
        ORDER BY m.created_at DESC LIMIT 3
      `),
    ])

    // GitHub-Commits von der API holen (letzten 5 Commits auf main)
    let commits: any[] = []
    try {
      const githubToken = process.env.GITHUB_TOKEN
      const githubRepo = process.env.GITHUB_REPO || 'uwuleonie/seekclan.de'
      const headers: Record<string, string> = { 'Accept': 'application/vnd.github.v3+json' }
      if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`

      const ghRes = await fetch(
        `https://api.github.com/repos/${githubRepo}/commits?per_page=5`,
        { headers, next: { revalidate: 300 } }
      )
      if (ghRes.ok) {
        const data = await ghRes.json()
        commits = data.map((c: any) => ({
          sha: c.sha?.slice(0, 7),
          message: c.commit?.message?.split('\n')[0] || '',
          author: c.commit?.author?.name || '',
          date: c.commit?.author?.date || '',
          url: c.html_url,
        }))
      }
    } catch { /* GitHub nicht erreichbar, kein Problem */ }

    const openTickets = parseInt(ticketsRows[0]?.count || '0', 10)
    const openConcepts = conceptsRows.length
    const openIdeas = ideasRows.length

    const concepts = conceptsRows.map((c: any) => ({
      id: c.id,
      title: c.title,
      isTextOnly: c.is_text_only,
      isFinished: c.is_finished,
      progress: Number(c.total) > 0 ? Math.round((Number(c.done) / Number(c.total)) * 100) : 0,
    }))

    return NextResponse.json({
      openTickets,
      openConcepts,
      openIdeas,
      ideas: ideasRows,
      concepts,
      chat: [...chatRows].reverse(),
      commits,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}