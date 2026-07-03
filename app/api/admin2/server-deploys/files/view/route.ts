import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { readFileContent } from '@/app/lib/sftp'

async function checkAccess(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner'].includes(user.clan_role)) return null
  return user
}

// GET /api/admin2/server-deploys/files/view?path=logs/latest.log
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path fehlt' }, { status: 400 })

  try {
    const buffer = await readFileContent(path)
    return NextResponse.json({ path, content: buffer.toString('utf-8') })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}