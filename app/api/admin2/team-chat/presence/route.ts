import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { kontenMitRecht, mitRecht, rangJoin, rangNameSql } from '@/app/lib/rechte'

async function checkRead(req: NextRequest) {
  return mitRecht(req, 'admin.zugang')
}

// GET /api/admin2/team-chat/presence?channel=admin-chat
// Liefert alle Team-Mitglieder mit last_seen_at (aktualisiert sich schon bei
// jedem /api/auth/me-Aufruf, kein eigenes Presence-System nötig). Mit
// ?channel=admin-chat werden Teammitglieder rausgefiltert, weil die dort
// ohnehin keinen Zugriff haben - die Mitgliederliste soll das widerspiegeln.
export async function GET(req: NextRequest) {
  const user = await checkRead(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })

  const channel = req.nextUrl.searchParams.get('channel')
  const recht = channel === 'admin-chat' ? 'admin.verwalten' : 'admin.zugang'

  try {
    const leute = await kontenMitRecht(recht)
    const result = leute.length
      ? await pool.query(
        `SELECT u.id, u.username, COALESCE(u.anzeigename, u.username) AS name, u.minecraft_username AS mc, ${rangNameSql('r')} AS rang, u.last_seen_at
         FROM users u ${rangJoin('u', 'r')}
         WHERE u.id = ANY($1::uuid[])
         ORDER BY u.last_seen_at DESC NULLS LAST`,
        [leute.map(l => l.id)]
      )
      : { rows: [] }
    return NextResponse.json({ members: result.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}