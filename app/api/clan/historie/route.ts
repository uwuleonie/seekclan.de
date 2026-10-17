import { NextRequest, NextResponse } from 'next/server'
import { alleEintraege, eintraegeVon, verlaeufe } from '@/app/lib/clan-historie'
import { clanUndTeam } from '@/app/lib/clan'
import { verlauf, type Art } from '@/app/lib/clan-historie-def'
import { CLANLISTE_STAND, inClanListe } from '@/app/lib/clan-liste'

// GET /api/clan/historie – öffentlich: der Clan-Verlauf (/clan-history)
//   ?person=Name           alles zu einer Person: Mitgliedschaften + Einträge (betroffen und selbst ausgeführt)
//   ?q=&art=&jahr=&seite=  Liste, neueste zuerst, 100 pro Seite

const PRO_SEITE = 100

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams
  try {
    const person = (s.get('person') ?? '').trim()
    if (person) {
      const { betrifft, ausgefuehrt } = await eintraegeVon(person)
      const jetzt = (await clanUndTeam()).find(p => p.rang.clan && [p.mcName, p.name].some(n => n?.toLowerCase() === person.toLowerCase()))
      const name = jetzt?.mcName ?? betrifft[betrifft.length - 1]?.spieler ?? ausgefuehrt[0]?.von ?? person
      const v = verlauf(betrifft)
      const letzte = v.zeitraeume[v.zeitraeume.length - 1]
      // In der Clan-Liste aus dem Spiel und seitdem nicht gegangen → Mitglied, auch wenn der Website-Rang noch fehlt
      const lautListe = inClanListe(name) && (!letzte?.bis || +new Date(letzte.bis) < +new Date(CLANLISTE_STAND))
      return NextResponse.json({
        person: {
          name, imClan: !!jetzt || lautListe, rang: jetzt?.rang ?? null, username: jetzt?.username ?? null,
          beitrittAkte: jetzt?.beitritt ?? null, verlauf: v,
        },
        betrifft: [...betrifft].reverse(), ausgefuehrt: [...ausgefuehrt].reverse(),
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const q = (s.get('q') ?? '').trim().toLowerCase()
    const art = s.get('art') as Art | null
    const jahr = Number(s.get('jahr')) || null
    const seite = Math.max(0, Number(s.get('seite')) || 0)
    const alle = await alleEintraege()
    const gefiltert = alle.filter(e =>
      (!q || e.spieler.toLowerCase().includes(q) || e.von?.toLowerCase().includes(q) || e.notiz?.toLowerCase().includes(q)) &&
      (!art || e.art === art) && (!jahr || new Date(e.zeit).getFullYear() === jahr)
    ).reverse()
    const jahre = [...new Set(alle.map(e => new Date(e.zeit).getFullYear()))].sort((a, b) => b - a)
    const personen = (await verlaeufe()).size
    return NextResponse.json({
      eintraege: gefiltert.slice(seite * PRO_SEITE, (seite + 1) * PRO_SEITE), gesamt: gefiltert.length, alle: alle.length,
      seiten: Math.ceil(gefiltert.length / PRO_SEITE), jahre, personen, aeltester: alle[0]?.zeit ?? null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('clan/historie', err)
    return NextResponse.json({ error: 'Serverfehler' }, { status: 500 })
  }
}
