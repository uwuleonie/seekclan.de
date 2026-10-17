import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/app/lib/db'
import { clanUndTeam } from '@/app/lib/clan'
import { darfRangGeben } from '@/app/lib/rechte-def'
import { alleRaenge, mitRecht, rangSetzen, rangVon, uuidSql } from '@/app/lib/rechte'
import { isValidMcName, nameToProfile } from '@/app/lib/mojang'

// /api/admin2/clan-members – der Clan im Admin-Panel (Clan & Abzeichen)
//   GET   alle mit Clan-Rang + alle Clan-Akten (auch ehemalige), mit Rang und Akte
//   POST  {mcName, join_date, discord_tag, rangId?} – jemanden in den Clan aufnehmen: Clan-Akte anlegen und Clan-Rang geben
// Lesen: admin.zugang · Ändern: clan.verwalten (Rang vergeben zusätzlich nach den Regeln von raenge.vergeben)

export async function GET(req: NextRequest) {
  if (!(await mitRecht(req, 'admin.zugang'))) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const leute = await clanUndTeam()
  return NextResponse.json({
    members: leute.filter(p => p.rang.clan || p.akteId).map(p => ({ ...p, aktiv: p.rang.clan })),
  })
}

export async function POST(req: NextRequest) {
  const user = await mitRecht(req, 'clan.verwalten')
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const name = String(b.mcName ?? '').trim()
  if (!isValidMcName(name)) return NextResponse.json({ error: 'Ungültiger Minecraft-Name' }, { status: 400 })
  const beitritt = b.join_date ? new Date(b.join_date) : new Date()
  if (isNaN(beitritt.getTime()) || beitritt.getFullYear() < 2015 || +beitritt > Date.now() + 86_400_000) return NextResponse.json({ error: 'Ungültiges Datum – bitte ein Datum ab 2015 und nicht in der Zukunft' }, { status: 400 })

  const profil = await nameToProfile(name)
  if (!profil) return NextResponse.json({ error: `„${name}“ gibt es bei Minecraft nicht (oder Mojang antwortet gerade nicht)` }, { status: 404 })
  const N = uuidSql
  const da = (await pool.query(`SELECT id FROM clan_members WHERE minecraft_uuid IS NOT NULL AND ${N('minecraft_uuid')} = ${N('$1')}`, [profil.uuid])).rows[0]
  const raenge = await alleRaenge()
  const ziel = raenge.find(r => r.id === Number(b.rangId)) ?? raenge.find(r => r.schluessel === 'clan') ?? raenge.find(r => r.clan)
  if (!ziel?.clan) return NextResponse.json({ error: 'Kein Clan-Rang gefunden' }, { status: 400 })

  const konto = (await pool.query(`SELECT id FROM users WHERE minecraft_uuid IS NOT NULL AND ${N('minecraft_uuid')} = ${N('$1')}`, [profil.uuid])).rows[0]
  const person = konto ? { userId: konto.id as string } : { uuid: profil.uuid, name: profil.name }
  const aktuell = await rangVon(person)
  // Nur hochstufen, wenn die Person nicht schon einen höheren Rang hat (z. B. Admin bleibt Admin)
  if (aktuell.prioritaet < ziel.prioritaet || !aktuell.clan) {
    if (!darfRangGeben(user, aktuell, ziel)) return NextResponse.json({ error: 'Diesen Rang darfst du nicht vergeben' }, { status: 403 })
  }
  if (da) {
    await pool.query('UPDATE clan_members SET join_date = $1, discord_tag = COALESCE($2, discord_tag), display_name = $3 WHERE id = $4', [beitritt.toISOString(), b.discord_tag || null, profil.name, da.id])
  } else {
    await pool.query('INSERT INTO clan_members (display_name, role, join_date, discord_tag, minecraft_uuid) VALUES ($1, $2, $3, $4, $5)',
      [profil.name, ziel.anzeige, beitritt.toISOString(), b.discord_tag || null, profil.uuid])
  }
  // In der Clan-Historie steht der Beitritt mit dem gewählten Datum
  if (aktuell.prioritaet < ziel.prioritaet || !aktuell.clan) await rangSetzen(person, ziel.id, user.username, { zeit: b.join_date ? beitritt : null })
  return NextResponse.json({ success: true })
}
