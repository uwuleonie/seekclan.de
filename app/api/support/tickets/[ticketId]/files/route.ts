import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { saveFile } from '@/app/lib/local-storage'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const s = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  if (!s.rows[0]) return null
  const u = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [s.rows[0].user_id])
  return u.rows[0] || null
}

// POST: Datei zu einem Ticket hochladen (multipart/form-data)
// Felder: file (Pflicht), type ('map' | 'image' | 'other')
export async function POST(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const ticketRes = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [ticketId])
  const ticket = ticketRes.rows[0]
  if (!ticket) return NextResponse.json({ error: 'Ticket nicht gefunden' }, { status: 404 })

  const isOwner = ticket.user_id === user.id
  const isStaff = ['admin', 'mod', 'administrator', 'owner', 'teammitglied'].includes(user.clan_role?.toLowerCase() ?? '')
  const partRes = await pool.query('SELECT 1 FROM support_ticket_participants WHERE ticket_id = $1 AND user_id = $2', [ticketId, user.id])
  if (!isOwner && !isStaff && partRes.rows.length === 0) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })

  const type = (formData.get('type') as string) || 'other'

  // Map-Dateien: nur .zip erlaubt
  if (type === 'map' && !file.name.toLowerCase().endsWith('.zip')) {
    return NextResponse.json({ error: 'Nur .zip-Dateien erlaubt' }, { status: 400 })
  }

  // Bilder: nur jpg/png/gif/webp
  if (type === 'image') {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Nur JPG, PNG, GIF oder WebP erlaubt' }, { status: 400 })
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() || 'bin'
  const filename = `ticket_${ticketId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

  await saveFile('support-files', filename, buffer)

  // In DB speichern
  const ins = await pool.query(
    `INSERT INTO support_ticket_files (ticket_id, uploader_id, filename, original_name, size_bytes, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [ticketId, user.id, filename, file.name, file.size, file.type]
  )

  return NextResponse.json({ success: true, id: ins.rows[0].id, filename, original_name: file.name })
}