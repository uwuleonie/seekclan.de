import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { pool } from '@/app/lib/db'
import { getPrivateUser } from '@/app/lib/private-auth'
import { thumbPath } from '@/app/lib/private-storage'
import { forbidden, notFound, parseId } from '../../_shared'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/private/files/[id]/thumb — kleines WebP-Vorschaubild (nur für Bilder vorhanden)
export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await getPrivateUser(req)
  if (!user) return forbidden()
  const id = parseId((await params).id)
  if (!id) return notFound()

  const r = await pool.query(
    `SELECT storage_key FROM private_files WHERE id = $1 AND user_id = $2 AND has_thumb = TRUE`,
    [id, user.id]
  )
  if (!r.rows[0]) return notFound()

  try {
    const buf = await fs.readFile(thumbPath(user.id, r.rows[0].storage_key))
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/webp',
        // Vorschaubilder ändern sich nie → lange im Browser behalten (privat, nicht in fremden Caches)
        'Cache-Control': 'private, max-age=604800, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return notFound()
  }
}