import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { darfRangGeben } from '@/app/lib/rechte-def'
import { mitRecht, rangSetzen, rangVon, standardRang, uuidSql } from '@/app/lib/rechte'

// /api/admin2/clan-members/[memberId] – eine Clan-Akte (clan_members)
//   PATCH  {join_date?, stufe_override?, discord_tag?}
//   DELETE aus dem Clan entfernen: Clan-Rang → Standard-Rang. Die Akte (Beitritt, Abzeichen) bleibt als ehemaliges Mitglied
//          erhalten; mit ?endgueltig=1 wird sie samt Abzeichen gelöscht.
//          ?austritt=verlassen|geworfen|entfernt → so steht es in der Clan-Historie (ohne Angabe: entfernt)

export async function PATCH(req: NextRequest, context: { params: Promise<{ memberId: string }> }) {
  if (!(await mitRecht(req, 'clan.verwalten'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { memberId } = await context.params
  const b = await req.json().catch(() => ({}))
  const sets: string[] = []
  const vals: unknown[] = []
  if (b.join_date !== undefined) {
    const d = new Date(b.join_date)
    if (isNaN(d.getTime()) || d.getFullYear() < 2015 || +d > Date.now() + 86_400_000) return NextResponse.json({ error: 'Ungültiges Datum – bitte ein Datum ab 2015 und nicht in der Zukunft' }, { status: 400 })
    vals.push(d.toISOString()); sets.push(`join_date = $${vals.length}`)
  }
  if (b.stufe_override !== undefined) {
    const s = b.stufe_override === null ? null : Number(b.stufe_override)
    if (s !== null && !(Number.isInteger(s) && s >= 0 && s <= 5)) return NextResponse.json({ error: 'Stufe 0–5 oder leer' }, { status: 400 })
    vals.push(s); sets.push(`stufe_override = $${vals.length}`)
  }
  if (b.discord_tag !== undefined) { vals.push(b.discord_tag ? String(b.discord_tag).slice(0, 60) : null); sets.push(`discord_tag = $${vals.length}`) }
  if (!sets.length) return NextResponse.json({ error: 'Nichts zu ändern' }, { status: 400 })
  vals.push(memberId)
  await pool.query(`UPDATE clan_members SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ memberId: string }> }) {
  const user = await mitRecht(req, 'clan.verwalten')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { memberId } = await context.params
  const akte = (await pool.query('SELECT id, minecraft_uuid, display_name FROM clan_members WHERE id = $1', [memberId])).rows[0]
  if (!akte) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  // Clan-Rang wegnehmen
  if (akte.minecraft_uuid) {
    const konto = (await pool.query(`SELECT id FROM users WHERE minecraft_uuid IS NOT NULL AND ${uuidSql('minecraft_uuid')} = ${uuidSql('$1')}`, [akte.minecraft_uuid])).rows[0]
    const person = konto ? { userId: konto.id as string } : { uuid: akte.minecraft_uuid as string, name: akte.display_name as string }
    const aktuell = await rangVon(person)
    if (aktuell.clan) {
      const std = await standardRang()
      if (!darfRangGeben(user, aktuell, std)) return NextResponse.json({ error: 'Diese Person hat einen höheren Rang, als du vergeben darfst' }, { status: 403 })
      const a = req.nextUrl.searchParams.get('austritt')
      const austritt = a === 'verlassen' || a === 'geworfen' || a === 'entfernt' ? a : 'entfernt'
      await rangSetzen(person, std.id, user.username, { austritt })
    }
  }
  if (req.nextUrl.searchParams.get('endgueltig') === '1') {
    await pool.query('DELETE FROM clan_member_badges WHERE member_id = $1', [memberId])
    await pool.query('DELETE FROM clan_members WHERE id = $1', [memberId])
  }
  return NextResponse.json({ success: true })
}
