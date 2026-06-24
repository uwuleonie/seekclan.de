import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

const ALLOWED_EMOJIS = ['🔥', '❤️', '👍']

async function getLoggedInUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  return session.user_id as string
}

// Liefert für alle übergebenen entry_ids: Anzahl je Emoji + ob der aktuell eingeloggte
// Nutzer selbst reagiert hat (für den ausgefüllten/leeren Zustand des Buttons).
// Query-Param: ?entry_ids=1,2,3
export async function GET(req: NextRequest) {
  const entryIdsParam = req.nextUrl.searchParams.get('entry_ids')
  if (!entryIdsParam) return NextResponse.json({ error: 'entry_ids erforderlich' }, { status: 400 })

  const entryIds = entryIdsParam.split(',').map(Number).filter(n => !isNaN(n))
  if (entryIds.length === 0) return NextResponse.json({ reactions: {} })

  const userId = await getLoggedInUser(req)

  let rows
  try {
    const result = await pool.query(
      'SELECT entry_id, user_id, emoji FROM changelog_reactions WHERE entry_id = ANY($1)',
      [entryIds]
    )
    rows = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const result: Record<number, Record<string, { count: number; reacted: boolean }>> = {}

  for (const entryId of entryIds) {
    result[entryId] = {}
    for (const emoji of ALLOWED_EMOJIS) {
      result[entryId][emoji] = { count: 0, reacted: false }
    }
  }

  for (const row of rows || []) {
    const bucket = result[row.entry_id]?.[row.emoji]
    if (!bucket) continue
    bucket.count++
    if (userId && row.user_id === userId) bucket.reacted = true
  }

  return NextResponse.json({ reactions: result })
}

// Body: { entry_id: number, emoji: string }
// Schaltet die Reaktion des eingeloggten Nutzers für diesen Eintrag/Emoji um (an/aus).
export async function POST(req: NextRequest) {
  const userId = await getLoggedInUser(req)
  if (!userId) return NextResponse.json({ error: 'Nur für eingeloggte Nutzer' }, { status: 401 })

  const { entry_id, emoji } = await req.json()
  if (!entry_id || !ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: 'entry_id und gültiges emoji erforderlich' }, { status: 400 })
  }

  const existingResult = await pool.query(
    'SELECT id FROM changelog_reactions WHERE entry_id = $1 AND user_id = $2 AND emoji = $3',
    [entry_id, userId, emoji]
  )
  const existing = existingResult.rows[0]

  if (existing) {
    await pool.query('DELETE FROM changelog_reactions WHERE id = $1', [existing.id])
    return NextResponse.json({ success: true, reacted: false })
  }

  await pool.query(
    'INSERT INTO changelog_reactions (entry_id, user_id, emoji) VALUES ($1, $2, $3)',
    [entry_id, userId, emoji]
  )
  return NextResponse.json({ success: true, reacted: true })
}