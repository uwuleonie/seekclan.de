import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { listDirectory } from '@/app/lib/sftp'
import { mitRecht } from '@/app/lib/rechte'

async function checkAccess(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

// GET /api/admin2/server-deploys/files/list?path=plugins
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const path = req.nextUrl.searchParams.get('path') || ''

  try {
    const entries = await listDirectory(path)
    return NextResponse.json({ path, entries })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}