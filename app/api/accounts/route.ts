import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function getUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const { data: session } = await supabaseAdmin.from('sessions').select('user_id').eq('token', token).single()
  if (!session) return null
  const { data: user } = await supabaseAdmin.from('users').select('id, username').eq('id', session.user_id).single()
  return user || null
}

// Verknüpfte Accounts laden
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data: linked } = await supabaseAdmin
    .from('linked_accounts')
    .select('id, linked_user_id, session_token, users:linked_user_id ( username )')
    .eq('owner_id', user.id)

  return NextResponse.json({ accounts: linked || [] })
}

// Account hinzufügen (Login mit Passwort)
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { username, password } = await req.json()
  if (!username || !password) return NextResponse.json({ error: 'Username und Passwort erforderlich' }, { status: 400 })

  // Prüfen ob schon 5 Accounts verknüpft
  const { count } = await supabaseAdmin.from('linked_accounts').select('*', { count: 'exact' }).eq('owner_id', user.id)
  if ((count || 0) >= 5) return NextResponse.json({ error: 'Maximal 5 Accounts möglich' }, { status: 400 })

  // Login prüfen
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) return NextResponse.json({ error: 'Login fehlgeschlagen' }, { status: 401 })

  // Session Token holen
  const setCookie = res.headers.get('set-cookie') || ''
  const tokenMatch = setCookie.match(/session_token=([^;]+)/)
  if (!tokenMatch) return NextResponse.json({ error: 'Fehler beim Login' }, { status: 500 })
  const sessionToken = tokenMatch[1]

  // Linked Account finden
  const { data: linkedUser } = await supabaseAdmin.from('users').select('id').ilike('username', username).single()
  if (!linkedUser) return NextResponse.json({ error: 'User nicht gefunden' }, { status: 404 })

  if (linkedUser.id === user.id) return NextResponse.json({ error: 'Das ist dein eigener Account' }, { status: 400 })

  const { error } = await supabaseAdmin.from('linked_accounts').upsert({
    owner_id: user.id,
    linked_user_id: linkedUser.id,
    session_token: sessionToken,
  }, { onConflict: 'owner_id,linked_user_id' })

  if (error) return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })

  // Aktuellen Session Token holen für die andere Richtung
  const currentToken = req.cookies.get('session_token')?.value || ''
  await supabaseAdmin.from('linked_accounts').upsert({
    owner_id: linkedUser.id,
    linked_user_id: user.id,
    session_token: currentToken,
  }, { onConflict: 'owner_id,linked_user_id' })

  // Alle bereits verknüpften Accounts von beiden holen und gegenseitig verknüpfen
  const { data: myAccounts } = await supabaseAdmin
    .from('linked_accounts')
    .select('linked_user_id, session_token')
    .eq('owner_id', user.id)

  const { data: theirAccounts } = await supabaseAdmin
    .from('linked_accounts')
    .select('linked_user_id, session_token')
    .eq('owner_id', linkedUser.id)

  // Alle Sessions der Gruppe sammeln
  const allInGroup = [
    { id: user.id, token: currentToken },
    { id: linkedUser.id, token: sessionToken },
    ...(myAccounts || []).map(a => ({ id: a.linked_user_id, token: a.session_token })),
    ...(theirAccounts || []).map(a => ({ id: a.linked_user_id, token: a.session_token })),
  ]

  // Deduplizieren
  const unique = allInGroup.filter((a, i, arr) => arr.findIndex(b => b.id === a.id) === i)

  // Jeden mit jedem verknüpfen
  for (const a of unique) {
    for (const b of unique) {
      if (a.id === b.id) continue
      await supabaseAdmin.from('linked_accounts').upsert({
        owner_id: a.id,
        linked_user_id: b.id,
        session_token: b.token,
      }, { onConflict: 'owner_id,linked_user_id' })
    }
  }

  return NextResponse.json({ success: true })
}

// Account entfernen
export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { id } = await req.json()
  await supabaseAdmin.from('linked_accounts').delete().eq('id', id).eq('owner_id', user.id)
  return NextResponse.json({ success: true })
}