import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { checkOrigin } from '@/app/lib/csrf'
import { getPrivateUser } from '@/app/lib/private-auth'
import { badRequest, forbidden, serverError } from '../_shared'

// POST /api/private/files/folders — { name }
async function handlePOST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'CSRF' }, { status: 403 })
  const user = await getPrivateUser(req)
  if (!user) return forbidden()

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!name) return badRequest('Name fehlt')

  const r = await pool.query(
    `INSERT INTO private_file_folders (user_id, name) VALUES ($1, $2)
     RETURNING id, name, created_at, 0 AS file_count`,
    [user.id, name]
  )
  return NextResponse.json(r.rows[0])
}


export async function POST(req: NextRequest) {
  try {
    return await handlePOST(req)
  } catch (err) {
    return serverError(err, 'POST /api/private/files/folders')
  }
}