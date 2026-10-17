import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht, rangJoin, rangNameSql } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// GET /api/admin2/accounts – alle Website-Konten mit Rang (höchster Rang zuerst)
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, COALESCE(u.anzeigename, u.username) AS name, u.minecraft_username, u.is_banned, u.last_login_at,
              r.id AS rang_id, ${rangNameSql('r')} AS rang, COALESCE(r.priority, 0) AS rang_prio
       FROM users u ${rangJoin('u', 'r')}
       ORDER BY rang_prio DESC, lower(COALESCE(u.anzeigename, u.username)) ASC`
    )
    return NextResponse.json({ accounts: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
