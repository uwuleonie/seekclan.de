import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht, darf } from '@/app/lib/rechte'

async function getUser(req: NextRequest) {
  return mitRecht(req)
}

// GET /api/admin2/scoreboard-config — Admin-Panel laedt die Configs ALLER Server
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user || !darf(user, 'admin.zugang')) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }
  const result = await pool.query(
    `SELECT DISTINCT ON (server_name) server_name, title, lines
     FROM lobby_scoreboard_config
     ORDER BY server_name, id DESC`
  )
  const configs: Record<string, { title: string; lines: unknown }> = {}
  for (const row of result.rows) {
    configs[row.server_name] = {
      title: row.title,
      lines: typeof row.lines === 'string' ? JSON.parse(row.lines) : row.lines,
    }
  }
  return NextResponse.json({ configs })
}

// POST /api/admin2/scoreboard-config — Config fuer einen Server speichern
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user || !darf(user, 'admin.verwalten')) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const { title, lines, server_name = 'lobby' } = body
  if (!title || !Array.isArray(lines)) return NextResponse.json({ error: 'title und lines erforderlich' }, { status: 400 })

  // Nur Felder speichern, die das Plugin auch nutzt
  const clean = lines.slice(0, 15).map((l: any) => ({
    id: String(l.id ?? ''),
    type: ['static', 'animated', 'empty'].includes(l.type) ? l.type : 'static',
    text: typeof l.text === 'string' ? l.text : '',
    frames: Array.isArray(l.frames) ? l.frames.map((f: any) => String(f)) : [],
    interval: Math.max(1, Math.min(30, Number(l.interval) || 2)),
  }))

  await pool.query(
    `INSERT INTO lobby_scoreboard_config (title, lines, server_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (server_name) DO UPDATE SET title = $1, lines = $2`,
    [title, JSON.stringify(clean), server_name]
  )
  return NextResponse.json({ success: true })
}