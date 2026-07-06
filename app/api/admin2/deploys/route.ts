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

// GET /api/admin2/deploys?branch=main
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const branch = req.nextUrl.searchParams.get('branch') || 'main'
  const githubRepo = process.env.GITHUB_REPO || 'uwuleonie/seekclan.de'
  const githubToken = process.env.GITHUB_TOKEN

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'seekclan-admin',
  }
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`

  const repoUrl = `https://github.com/${githubRepo}`

  try {
    const [commitsRes, branchesRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${githubRepo}/commits?sha=${branch}&per_page=30`, { headers }),
      fetch(`https://api.github.com/repos/${githubRepo}/branches`, { headers }),
    ])

    if (!commitsRes.ok) {
      const err = await commitsRes.json().catch(() => ({}))
      return NextResponse.json({
        commits: [], branches: [], repoUrl, repoName: githubRepo,
        error: err.message || `GitHub API Fehler: ${commitsRes.status}`,
      })
    }

    const [commitsData, branchesData] = await Promise.all([
      commitsRes.json(),
      branchesRes.ok ? branchesRes.json() : [],
    ])

    const commits = commitsData.map((c: any) => ({
      sha: c.sha?.slice(0, 7),
      message: c.commit?.message?.split('\n')[0] || '',
      author: c.commit?.author?.name || c.author?.login || 'Unbekannt',
      date: c.commit?.author?.date || '',
      url: c.html_url,
      verified: c.commit?.verification?.verified || false,
    }))

    const branches = (Array.isArray(branchesData) ? branchesData : []).map((b: any) => ({
      name: b.name,
      sha: b.commit?.sha?.slice(0, 7),
      url: `${repoUrl}/tree/${b.name}`,
    }))

    return NextResponse.json({ commits, branches, repoUrl, repoName: githubRepo })
  } catch (err: any) {
    return NextResponse.json({
      commits: [], branches: [], repoUrl, repoName: githubRepo,
      error: err.message || 'Verbindung zu GitHub fehlgeschlagen',
    })
  }
}