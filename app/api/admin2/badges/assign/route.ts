import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { mitRecht } from '@/app/lib/rechte'

// /api/admin2/badges/assign – Abzeichen einem Clan-Mitglied geben (POST) oder wegnehmen (DELETE): {member_id, badge_id}

export async function POST(req: NextRequest) {
  if (!(await mitRecht(req, 'clan.verwalten'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { member_id, badge_id } = await req.json().catch(() => ({}))
  if (!member_id || !badge_id) return NextResponse.json({ error: 'member_id und badge_id fehlen' }, { status: 400 })
  await pool.query(
    'INSERT INTO clan_member_badges (member_id, badge_id) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM clan_member_badges WHERE member_id = $1 AND badge_id = $2)',
    [member_id, badge_id]
  )
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await mitRecht(req, 'clan.verwalten'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { member_id, badge_id } = await req.json().catch(() => ({}))
  await pool.query('DELETE FROM clan_member_badges WHERE member_id = $1 AND badge_id = $2', [member_id, badge_id])
  return NextResponse.json({ success: true })
}
