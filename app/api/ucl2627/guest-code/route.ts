import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

function generateCode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

// POST: Gastcode erstellen oder abrufen
export async function POST(req: NextRequest) {
  try {
    const { gast_name } = await req.json()
    if (!gast_name?.trim()) return NextResponse.json({ error: 'Kein Gastname' }, { status: 400 })

    const existing = await pool.query('SELECT code FROM ucl_guest_codes WHERE gast_name = $1', [gast_name.trim()])
    if (existing.rows[0]) return NextResponse.json({ code: existing.rows[0].code })

    let code = generateCode()
    for (let i = 0; i < 5; i++) {
      const check = await pool.query('SELECT 1 FROM ucl_guest_codes WHERE code = $1', [code])
      if (!check.rows.length) break
      code = generateCode()
    }

    await pool.query('INSERT INTO ucl_guest_codes (gast_name, code) VALUES ($1, $2)', [gast_name.trim(), code])
    return NextResponse.json({ code })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET: Mit Code einloggen
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')?.trim()
    if (!code) return NextResponse.json({ error: 'Kein Code' }, { status: 400 })

    const res = await pool.query('SELECT gast_name FROM ucl_guest_codes WHERE code = $1', [code])
    if (!res.rows[0]) return NextResponse.json({ error: 'Ungültiger Code' }, { status: 404 })

    return NextResponse.json({ gast_name: res.rows[0].gast_name })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}