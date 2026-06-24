import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { pool } from '@/app/lib/db'

async function checkStaff(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user) return null
  const staff = user.clan_role?.toLowerCase() === 'admin' || user.clan_role?.toLowerCase() === 'mod'
  return staff ? user : null
}

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

export async function GET() {
  let entryRows: EntryRow[]
  try {
    const result = await pool.query('SELECT * FROM changelog_entries ORDER BY created_at DESC')
    entryRows = result.rows
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  const entryIds = entryRows.map(e => e.id)

  if (entryIds.length === 0) return NextResponse.json({ entries: [] })

  const [tagLinksRes, allTagsRes, imagesRes] = await Promise.all([
    pool.query('SELECT entry_id, tag_id FROM changelog_entry_tags WHERE entry_id = ANY($1)', [entryIds]),
    pool.query('SELECT id, name, color, requires_version FROM changelog_tags'),
    pool.query(
      'SELECT id, entry_id, filename, position FROM changelog_images WHERE entry_id = ANY($1) ORDER BY position ASC',
      [entryIds]
    ),
  ])

  const tagLinks = tagLinksRes.rows as { entry_id: number; tag_id: number }[]
  const allTags = allTagsRes.rows as Tag[]
  const images = imagesRes.rows
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

export async function POST(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { title, description, version, tag_ids } = await req.json()

  if (!title?.trim()) return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })
  if (!description?.trim()) return NextResponse.json({ error: 'Beschreibung erforderlich' }, { status: 400 })

  const tagIds: number[] = Array.isArray(tag_ids) ? tag_ids : []

  let versionRequired = false
  if (tagIds.length > 0) {
    const selectedTagsResult = await pool.query(
      'SELECT id, requires_version FROM changelog_tags WHERE id = ANY($1)',
      [tagIds]
    )
    versionRequired = selectedTagsResult.rows.some(t => t.requires_version)
  }

  if (versionRequired) {
    if (!version?.trim()) {
      return NextResponse.json({ error: 'Für einen der ausgewählten Tags ist eine Version erforderlich (Format: 1.0.0)' }, { status: 400 })
    }
    if (!VERSION_PATTERN.test(version.trim())) {
      return NextResponse.json({ error: 'Version muss dem Format 1.0.0 folgen' }, { status: 400 })
    }
  }

  let entry
  try {
    const result = await pool.query(
      'INSERT INTO changelog_entries (title, description, version) VALUES ($1, $2, $3) RETURNING *',
      [title.trim(), description.trim(), version?.trim() || null]
    )
    entry = result.rows[0]
  } catch (err: any) {
    return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })
  }

  if (!entry) return NextResponse.json({ error: 'Fehler beim Erstellen' }, { status: 500 })

  if (tagIds.length > 0) {
    const values = tagIds.map((_, i) => `($1, $${i + 2})`).join(', ')
    await pool.query(
      `INSERT INTO changelog_entry_tags (entry_id, tag_id) VALUES ${values}`,
      [entry.id, ...tagIds]
    )
  }

  return NextResponse.json({ success: true, entry })
}

export async function DELETE(req: NextRequest) {
  const staff = await checkStaff(req)
  if (!staff) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  const imagesResult = await pool.query('SELECT filename FROM changelog_images WHERE entry_id = $1', [id])
  const images = imagesResult.rows

  if (images && images.length > 0) {
    await supabaseAdmin.storage.from('site-content').remove(images.map(img => `changelog/${img.filename}`))
  }

  try {
    await pool.query('DELETE FROM changelog_entries WHERE id = $1', [id])
  } catch (err: any) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}