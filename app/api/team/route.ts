import { NextResponse } from 'next/server'
import { clanUndTeam } from '@/app/lib/clan'
import { alleRaenge } from '@/app/lib/rechte'

// GET /api/team – öffentlich: alle mit Team-Rang (mc_ranks.team), nach Rang gruppiert (höchster zuerst).
export async function GET() {
  try {
    const [leute, raenge] = await Promise.all([clanUndTeam(), alleRaenge()])
    const team = leute.filter(p => p.rang.team)
    const gruppen = raenge.filter(r => r.team).map(r => ({
      rang: { id: r.id, anzeige: r.anzeige, farbe: r.farbe, beschreibung: r.beschreibung },
      personen: team.filter(p => p.rang.id === r.id)
        .sort((a, b) => new Date(a.rangSeit ?? a.beitritt ?? 0).getTime() - new Date(b.rangSeit ?? b.beitritt ?? 0).getTime())
        .map(p => ({ key: p.key, name: p.name, mcName: p.mcName, username: p.username, seit: p.rangSeit, imClanSeit: p.beitritt, discord_tag: p.discord_tag })),
    })).filter(g => g.personen.length)
    return NextResponse.json({ gruppen, anzahl: team.length }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('team', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
