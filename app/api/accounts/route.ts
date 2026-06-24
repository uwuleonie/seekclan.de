import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [session.user_id])
  return userResult.rows[0] || null
}

async function upsertLinkedAccount(ownerId: string, linkedUserId: string, sessionToken: string) {
  await pool.query(
    `INSERT INTO linked_accounts (owner_id, linked_user_id, session_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (owner_id, linked_user_id) DO UPDATE SET session_token = EXCLUDED.session_token`,
    [ownerId, linkedUserId, sessionToken]
  )
}

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const result = await pool.query(
    `SELECT
       la.id, la.linked_user_id, la.session_token,
       json_build_object('username', u.username) AS users
     FROM linked_accounts la
     JOIN users u ON u.id = la.linked_user_id
     WHERE la.owner_id = $1`,
    [user.id]
  )

  return NextResponse.json({ accounts: result.rows || [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { username, password } = await req.json()
  if (!username || !password) return NextResponse.json({ error: 'Username und Passwort erforderlich' }, { status: 400 })

  const countResult = await pool.query('SELECT COUNT(*) AS count FROM linked_accounts WHERE owner_id = $1', [user.id])
  const count = parseInt(countResult.rows[0]?.count || '0', 10)
  if (count >= 5) return NextResponse.json({ error: 'Maximal 5 Accounts möglich' }, { status: 400 })

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) return NextResponse.json({ error: 'Login fehlgeschlagen' }, { status: 401 })

  const setCookie = res.headers.get('set-cookie') || ''
  const tokenMatch = setCookie.match(/session_token=([^;]+)/)
  if (!tokenMatch) return NextResponse.json({ error: 'Fehler beim Login' }, { status: 500 })
  const sessionToken = tokenMatch[1]

  const linkedUserResult = await pool.query('SELECT id FROM users WHERE username ILIKE $1', [username])
  const linkedUser = linkedUserResult.rows[0]
  if (!linkedUser) return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })

  if (linkedUser.id === user.id) return NextResponse.json({ error: 'Das ist dein eigener Account' }, { status: 400 })

  try {
    await upsertLinkedAccount(user.id, linkedUser.id, sessionToken)
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }

  const currentToken = req.cookies.get('session_token')?.value || ''
  await upsertLinkedAccount(linkedUser.id, user.id, currentToken)

  const myAccountsResult = await pool.query(
    'SELECT linked_user_id, session_token FROM linked_accounts WHERE owner_id = $1',
    [user.id]
  )
  const theirAccountsResult = await pool.query(
    'SELECT linked_user_id, session_token FROM linked_accounts WHERE owner_id = $1',
    [linkedUser.id]
  )

  const allInGroup = [
    { id: user.id, token: currentToken },
    { id: linkedUser.id, token: sessionToken },
    ...(myAccountsResult.rows || []).map(a => ({ id: a.linked_user_id, token: a.session_token })),
    ...(theirAccountsResult.rows || []).map(a => ({ id: a.linked_user_id, token: a.session_token })),
  ]

  const unique = allInGroup.filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i)

  for (const a of unique) {
    for (const b of unique) {
      if (a.id === b.id) continue
      await upsertLinkedAccount(a.id, b.id, b.token)
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id } = await req.json()
  await pool.query('DELETE FROM linked_accounts WHERE id = $1 AND owner_id = $2', [id, user.id])
  return NextResponse.json({ success: true })
}