import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import fs from 'fs'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return NextResponse.json({ error: 'Session ungültig' }, { status: 401 })

  const result = await pool.query(
    `SELECT username, banner_url, background_url, profile_picture_url, accent_color, display_name, status_text, glass_config
     FROM users WHERE id = $1`,
    [session.user_id]
  )

  const uploadRoot = process.env.UPLOAD_ROOT || '/vm_hdd/uploads'
  const testPath = `${uploadRoot}/profile-media/a62ce460-a329-4054-9998-ea9e3ff528d7/banner_1788688743132.jpg`

  return NextResponse.json({
    user: result.rows[0] || null,
    uploadRoot,
    testPathExists: fs.existsSync(testPath),
    vmHddExists: fs.existsSync('/vm_hdd'),
    vmHddUploadsExists: fs.existsSync('/vm_hdd/uploads'),
    uploadsContents: fs.existsSync('/vm_hdd/uploads') ? fs.readdirSync('/vm_hdd/uploads') : 'nicht vorhanden',
  })
}