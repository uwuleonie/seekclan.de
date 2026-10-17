import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { readFileContent } from '@/app/lib/sftp'
import { mitRecht } from '@/app/lib/rechte'

async function checkAccess(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

// GET /api/admin2/server-deploys/files/view?path=logs/latest.log
export async function GET(req: NextRequest) {
  const user = await checkAccess(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'path fehlt' }, { status: 400 })

  try {
    const buffer = await readFileContent(path)
    return NextResponse.json({ path, content: buffer.toString('utf-8') })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}