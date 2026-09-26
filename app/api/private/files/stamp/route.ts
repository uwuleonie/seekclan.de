import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { getPrivateUser } from '@/app/lib/private-auth'
import { forbidden, serverError } from '../_shared'

// GET /api/private/files/stamp?device=<id>
// Sehr leichte Abfrage, die alle paar Sekunden läuft:
//  - stamp:  ändert sich bei jeder Änderung (neue Datei, umbenannt, gelöscht, Ordner …)
//  - unseen: fertige, noch nicht angesehene Dateien, die von einem ANDEREN Gerät kamen
async function handleGET(req: NextRequest) {
  const user = await getPrivateUser(req)
  if (!user) return forbidden()

  const device = req.nextUrl.searchParams.get('device') || ''

  const r = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM private_files WHERE user_id = $1 AND status = 'ready') AS file_count,
       (SELECT MAX(updated_at) FROM private_files WHERE user_id = $1 AND status = 'ready') AS file_max,
       (SELECT COUNT(*)::int FROM private_file_folders WHERE user_id = $1) AS folder_count,
       (SELECT MAX(updated_at) FROM private_file_folders WHERE user_id = $1) AS folder_max,
       (SELECT COUNT(*)::int FROM private_files
         WHERE user_id = $1 AND status = 'ready' AND seen_at IS NULL
           AND device_id IS DISTINCT FROM $2) AS unseen`,
    [user.id, device]
  )
  const row = r.rows[0]
  const t = (d: Date | null) => (d ? new Date(d).getTime() : 0)

  return NextResponse.json(
    {
      stamp: `${row.file_count}.${t(row.file_max)}.${row.folder_count}.${t(row.folder_max)}`,
      unseen: row.unseen,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}


export async function GET(req: NextRequest) {
  try {
    return await handleGET(req)
  } catch (err) {
    return serverError(err, 'GET /api/private/files/stamp')
  }
}