// Diese Route ist bewusst OHNE Login-Check — sie ist der Zugang für
// Leute, denen Leonie einen Link gegeben hat. Der Token ist das Passwort.
import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

// GET /api/private/leonie/shares/validate?token=XYZ
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Kein Token angegeben.' }, { status: 400 })

  const shareResult = await pool.query(
    `SELECT id, note_id, share_all, label, expires_at
     FROM leonie_note_shares
     WHERE token = $1`,
    [token]
  )
  const share = shareResult.rows[0]
  if (!share) {
    return NextResponse.json({ error: 'Dieser Link ist ungültig.' }, { status: 404 })
  }

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Dieser Link ist abgelaufen.' }, { status: 410 })
  }

  let notes
  if (share.share_all) {
    const result = await pool.query(
      `SELECT n.id, n.title, n.content, n.created_at, n.updated_at,
              f.name AS folder_name, f.color AS folder_color
       FROM leonie_notes n
       LEFT JOIN leonie_folders f ON f.id = n.folder_id
       ORDER BY n.updated_at DESC`
    )
    notes = result.rows
  } else {
    const result = await pool.query(
      `SELECT n.id, n.title, n.content, n.created_at, n.updated_at,
              f.name AS folder_name, f.color AS folder_color
       FROM leonie_notes n
       LEFT JOIN leonie_folders f ON f.id = n.folder_id
       WHERE n.id = $1`,
      [share.note_id]
    )
    notes = result.rows
  }

  return NextResponse.json({
    share_all: share.share_all,
    label: share.label,
    notes,
  })
}