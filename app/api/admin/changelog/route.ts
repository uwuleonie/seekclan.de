import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'

async function checkStaff(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const { data: session } = await supabaseAdmin.from('sessions').select('user_id').eq('token', token).single()
  if (!session) return null
  const { data: user } = await supabaseAdmin.from('users').select('id, clan_role').eq('id', session.user_id).single()
  if (!user) return null
  const staff = user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'
  return staff ? user : null
}

// VERSION_PATTERN: erlaubt z.B. "1.0.0", "2.3.10" — wird nur erzwungen, wenn der Tag
// "SMP" ausgewählt ist (siehe POST unten).
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/

type EntryRow = {
  id: number
  title: string
  description: string
  version: string | null
  created_at: string
}

type Tag = {
  id: number
  name: string
  color: string
  requires_version: boolean
}

// Liefert alle Changelog-Einträge inkl. ihrer Tags und Bilder, neueste zuerst.
// Öffentlich lesbar (für die /changelog-Seite), kein Staff-Check bei GET.
export async function GET() {
  const { data: entries, error } = await supabaseAdmin
    .from('changelog_entries')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const entryRows = (entries || []) as EntryRow[]
  const entryIds = entryRows.map(e => e.id)

  if (entryIds.length === 0) return NextResponse.json({ entries: [] })

  const [tagLinksRes, allTagsRes, imagesRes] = await Promise.all([
    supabaseAdmin
      .from('changelog_entry_tags')
      .select('entry_id, tag_id')
      .in('entry_id', entryIds),
    supabaseAdmin
      .from('changelog_tags')
      .select('id, name, color, requires_version'),
    supabaseAdmin
      .from('changelog_images')
      .select('id, entry_id, filename, position')
      .in('entry_id', entryIds)
      .order('position', { ascending: true }),
  ])

  const tagLinks = (tagLinksRes.data || []) as { entry_id: number; tag_id: number }[]
  const allTags = (allTagsRes.data || []) as Tag[]
  const images = imagesRes.data || []
  const tagById = new Map(allTags.map(t => [t.id, t]))

  const entries_with_relations = entryRows.map(entry => ({
    ...entry,
    tags: tagLinks
      .filter(l => l.entry_id === entry.id)
      .map(l => tagById.get(l.tag_id))
      .filter((t): t is Tag => t !== undefined),
    images: images
      .filter(img => img.entry_id === entry.id)
      .map(img => ({
        id: img.id,
        filename: img.filename,
        url: supabaseAdmin.storage.from('site-content').getPublicUrl(`changelog/${img.filename}`).data.publicUrl,
      })),
  }))

  return NextResponse.json({ entries: entries_with_relations })
}

// Body: { title, description, version, tag_ids: number[] }
export async function POST(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { title, description, version, tag_ids } = await req.json()

  if (!title?.trim()) return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })
  if (!description?.trim()) return NextResponse.json({ error: 'Beschreibung erforderlich' }, { status: 400 })

  const tagIds: number[] = Array.isArray(tag_ids) ? tag_ids : []

  // Prüfen, ob mindestens einer der ausgewählten Tags eine Pflicht-Version erfordert
  // (z. B. "SMP" oder "Website" — per Häkchen beim Erstellen eines Tags festgelegt).
  let versionRequired = false
  if (tagIds.length > 0) {
    const { data: selectedTags } = await supabaseAdmin
      .from('changelog_tags')
      .select('id, requires_version')
      .in('id', tagIds)
    versionRequired = (selectedTags || []).some(t => t.requires_version)
  }

  if (versionRequired) {
    if (!version?.trim()) {
      return NextResponse.json({ error: 'Für einen der ausgewählten Tags ist eine Version erforderlich (Format: 1.0.0)' }, { status: 400 })
    }
    if (!VERSION_PATTERN.test(version.trim())) {
      return NextResponse.json({ error: 'Version muss dem Format 1.0.0 folgen' }, { status: 400 })
    }
  }

  const { data: entry, error: insertError } = await supabaseAdmin
    .from('changelog_entries')
    .insert({
      title: title.trim(),
      description: description.trim(),
      version: version?.trim() || null,
    })
    .select('*')
    .single()

  if (insertError || !entry) return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })

  if (tagIds.length > 0) {
    await supabaseAdmin
      .from('changelog_entry_tags')
      .insert(tagIds.map(tag_id => ({ entry_id: entry.id, tag_id })))
  }

  return NextResponse.json({ success: true, entry })
}

// Body: { id: number }
export async function DELETE(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  // Zugehörige Bilder im Storage löschen, bevor der Eintrag (und per Cascade die DB-Zeilen) entfernt wird
  const { data: images } = await supabaseAdmin
    .from('changelog_images')
    .select('filename')
    .eq('entry_id', id)

  if (images && images.length > 0) {
    await supabaseAdmin.storage.from('site-content').remove(images.map(img => `changelog/${img.filename}`))
  }

  const { error } = await supabaseAdmin.from('changelog_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })

  return NextResponse.json({ success: true })
}