import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function checkLoggedIn(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

// GET /api/public/concepts/[token]
// Zugänglich für JEDEN eingeloggten Seek-Account, unabhängig von der Rolle -
// das ist der ganze Sinn des Freigabe-Links. Nur der Besitz eines gültigen
// Tokens und ein gültiges Login sind nötig.
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const user = await checkLoggedIn(req)
  if (!user) return NextResponse.json({ error: 'Bitte einloggen' }, { status: 401 })

  const { token } = await context.params

  const shareResult = await pool.query(
    `SELECT s.permission, c.id, c.title, c.is_text_only, c.content_text
     FROM admin_concept_shares s
     JOIN admin_concepts c ON c.id = s.concept_id
     WHERE s.token = $1`,
    [token]
  )
  const share = shareResult.rows[0]
  if (!share) return NextResponse.json({ error: 'Link ungültig oder abgelaufen' }, { status: 404 })

  const nodesResult = await pool.query(
    `SELECT id, title, description, status FROM admin_concept_nodes WHERE concept_id = $1 ORDER BY created_at ASC`,
    [share.id]
  )

  return NextResponse.json({
    concept: {
      title: share.title,
      isTextOnly: share.is_text_only,
      contentText: share.content_text,
      nodes: nodesResult.rows,
      canEdit: share.permission === 'edit',
    },
  })
}

// PATCH /api/public/concepts/[token]
// Body: { contentText } - nur für Text-Konzepte, nur wenn permission = 'edit'.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const user = await checkLoggedIn(req)
  if (!user) return NextResponse.json({ error: 'Bitte einloggen' }, { status: 401 })

  const { token } = await context.params
  const shareResult = await pool.query(
    `SELECT s.permission, c.id FROM admin_concept_shares s JOIN admin_concepts c ON c.id = s.concept_id WHERE s.token = $1`,
    [token]
  )
  const share = shareResult.rows[0]
  if (!share) return NextResponse.json({ error: 'Link ungültig oder abgelaufen' }, { status: 404 })
  if (share.permission !== 'edit') return NextResponse.json({ error: 'Nur Ansehen erlaubt' }, { status: 403 })

  const { contentText } = await req.json().catch(() => ({})) as { contentText?: string }
  if (contentText === undefined) return NextResponse.json({ error: 'contentText erforderlich' }, { status: 400 })

  await pool.query('UPDATE admin_concepts SET content_text = $1, updated_at = now() WHERE id = $2', [contentText, share.id])
  return NextResponse.json({ success: true })
}