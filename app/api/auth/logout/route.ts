import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('session_token')?.value

    if (token) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token])
    }

    const response = NextResponse.json({ success: true })
    response.cookies.delete('session_token')
    return response
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}