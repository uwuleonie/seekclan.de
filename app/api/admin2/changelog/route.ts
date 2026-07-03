import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { deleteFile, getPublicUrl } from '@/app/lib/local-storage'

async function checkRead(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value
  if (!token) return null
  const sessionResult = await pool.query('SELECT user_id FROM sessions WHERE token = $1', [token])
  const session = sessionResult.rows[0]
  if (!session) return null
  const userResult = await pool.query('SELECT id, username, clan_role FROM users WHERE id = $1', [session.user_id])
  const user = userResult.rows[0]
  if (!user || !['administrator', 'owner', 'teammitglied'].includes(user.clan_role)) return null
  return user
}

async function checkWrite(req: NextRequest) {
  const user = await checkRead(req)
  if (!user || (user.clan_role !== 'administrator' && user.clan_role !== 'owner')) return null
  return user
}

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/

// GET /api/admin2/changelog
// Liefert alle Einträge inkl. Tags und Bildern in einem Aufruf.
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const entriesResult = await pool.query('SELECT * FROM changelog_entries ORDER BY created_at DESC')
    const entryRows = entriesResult.rows
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

    const tagLinks = tagLinksRes.rows as { entry_id: number, tag_id: number }[]
    const allTags = allTagsRes.rows
    const images = imagesRes.rows
    const tagById = new Map(allTags.map(t => [t.id, t]))

    const entries = entryRows.map(entry => ({
      ...entry,
      tags: tagLinks
        .filter(l => l.entry_id === entry.id)
        .map(l => tagById.get(l.tag_id))
        .filter(Boolean),
      images: images
        .filter(img => img.entry_id === entry.id)
        .map(img => ({
          id: img.id,
          filename: img.filename,
          url: getPublicUrl('site-content', `changelog/${img.filename}`),
        })),
    }))

    return NextResponse.json({ entries })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin2/changelog
// Body: { title, description, version?, tag_ids? }
export async function POST(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { title, description, version, tag_ids } = body as {
    title?: string, description?: string, version?: string, tag_ids?: number[]
  }

  if (!title?.trim()) return NextResponse.json({ error: 'Titel erforderlich' }, { status: 400 })
  if (!description?.trim()) return NextResponse.json({ error: 'Beschreibung erforderlich' }, { status: 400 })

  const tagIds = Array.isArray(tag_ids) ? tag_ids : []

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

  try {
    const result = await pool.query(
      'INSERT INTO changelog_entries (title, description, version) VALUES ($1, $2, $3) RETURNING *',
      [title.trim(), description.trim(), version?.trim() || null]
    )
    const entry = result.rows[0]

    if (tagIds.length > 0) {
      const values = tagIds.map((_, i) => `($1, $${i + 2})`).join(', ')
      await pool.query(`INSERT INTO changelog_entry_tags (entry_id, tag_id) VALUES ${values}`, [entry.id, ...tagIds])
    }

    return NextResponse.json({ success: true, entry })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin2/changelog
// Body: { id }
export async function DELETE(req: NextRequest) {
  const user = await checkWrite(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID erforderlich' }, { status: 400 })

  const imagesResult = await pool.query('SELECT filename FROM changelog_images WHERE entry_id = $1', [id])
  await Promise.all(imagesResult.rows.map(img => deleteFile('site-content', `changelog/${img.filename}`)))

  try {
    await pool.query('DELETE FROM changelog_entries WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}