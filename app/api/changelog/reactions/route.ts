import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

const ALLOWED_EMOJIS = ['🔥', '❤️', '👍']

async function getLoggedInUser(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const { data: session } = await supabaseAdmin.from('sessions').select('user_id').eq('token', token).single()
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

  const { data: rows, error } = await supabaseAdmin
    .from('changelog_reactions')
    .select('entry_id, user_id, emoji')
    .in('entry_id', entryIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Struktur: { [entry_id]: { [emoji]: { count, reacted: boolean } } }
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

  const { data: existing } = await supabaseAdmin
    .from('changelog_reactions')
    .select('id')
    .eq('entry_id', entry_id)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .single()

  if (existing) {
    await supabaseAdmin.from('changelog_reactions').delete().eq('id', existing.id)
    return NextResponse.json({ success: true, reacted: false })
  }

  await supabaseAdmin.from('changelog_reactions').insert({ entry_id, user_id: userId, emoji })
  return NextResponse.json({ success: true, reacted: true })
}