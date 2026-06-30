import { NextRequest, NextResponse } from 'next/server'
import { saveFile, getPublicUrl } from '@/app/lib/local-storage'
import { pool } from '@/app/lib/db'

async function checkAdmin(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null

  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null

  const userResult = await pool.query(
    'SELECT username, clan_role FROM users WHERE id = $1',
    [session.user_id]
  )
  const user = userResult.rows[0]

  if (!user || user.clan_role !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const admin = await checkAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

  const fileName = `badge_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    await saveFile('badge-icons', fileName, buffer)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Upload fehlgeschlagen' }, { status: 500 })
  }

  const url = getPublicUrl('badge-icons', fileName)
  return NextResponse.json({ url })
}