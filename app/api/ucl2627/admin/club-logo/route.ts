import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

async function checkAdmin(req: NextRequest) {
  return mitRecht(req, 'admin.verwalten')
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await checkAdmin(req)
    if (!admin) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

    const { club_id, logo_url } = await req.json()
    if (!club_id) return NextResponse.json({ error: 'club_id fehlt' }, { status: 400 })

    await pool.query(
      'UPDATE ucl_clubs SET logo_url = $1 WHERE id = $2',
      [logo_url || null, club_id]
    )
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}