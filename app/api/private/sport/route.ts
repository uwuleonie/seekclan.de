import { NextRequest, NextResponse } from 'next/server'
import { getPrivateUser } from '@/app/lib/private-auth'

// GET /api/private/sport?league=ger.1&type=scores&date=20260928
// GET /api/private/sport?league=ger.1&type=table
// Fußball-Ergebnisse und Tabellen über die (inoffizielle, öffentliche) ESPN-Schnittstelle.
// Wird kurz zwischengespeichert: Ergebnisse 1 Minute (Live-Spiele), Tabellen 15 Minuten.

const LEAGUES: Record<string, string> = {
  'ger.1': 'Bundesliga', 'ger.2': '2. Bundesliga', 'ger.w.1': 'Frauen-Bundesliga', 'ger.dfb_pokal': 'DFB-Pokal',
  'eng.1': 'Premier League', 'eng.w.1': 'Women’s Super League', 'esp.1': 'LaLiga', 'esp.w.1': 'Liga F',
  'ita.1': 'Serie A', 'fra.1': 'Ligue 1', 'usa.nwsl': 'NWSL',
  'uefa.champions': 'Champions League', 'uefa.wchampions': 'Women’s Champions League',
}

const cache = new Map<string, { at: number; data: unknown }>()

async function get(url: string, ttl: number) {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < ttl) return hit.data
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`ESPN ${res.status}`)
  const data = await res.json()
  cache.set(url, { at: Date.now(), data })
  if (cache.size > 200) cache.delete(cache.keys().next().value!)
  return data
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function simplifyScores(raw: any) {
  return (raw?.events ?? []).map((e: any) => {
    const comp = e?.competitions?.[0] ?? {}
    const team = (side: string) => {
      const c = (comp.competitors ?? []).find((x: any) => x.homeAway === side) ?? {}
      return {
        name: c.team?.shortDisplayName || c.team?.displayName || '?',
        abbr: c.team?.abbreviation ?? '',
        logo: c.team?.logo ?? c.team?.logos?.[0]?.href ?? null,
        score: c.score ?? null,
        winner: c.winner === true,
      }
    }
    const st = comp.status ?? e.status ?? {}
    return {
      id: String(e.id),
      date: e.date,
      state: st.type?.state ?? 'pre', // pre | in | post
      detail: st.type?.shortDetail ?? st.type?.detail ?? '',
      clock: st.displayClock ?? '',
      home: team('home'),
      away: team('away'),
      venue: comp.venue?.fullName ?? null,
      round: comp.notes?.[0]?.headline ?? null,
    }
  })
}

function simplifyTable(raw: any) {
  const groups = raw?.children?.length ? raw.children : raw?.standings ? [{ name: raw.name, standings: raw.standings }] : []
  return groups.map((g: any) => ({
    name: g.name ?? g.abbreviation ?? '',
    rows: (g.standings?.entries ?? []).map((en: any) => {
      const stat = (n: string) => en.stats?.find((s: any) => s.name === n || s.type === n)
      const v = (n: string) => stat(n)?.value ?? null
      return {
        rank: v('rank'),
        team: en.team?.shortDisplayName || en.team?.displayName || '?',
        logo: en.team?.logos?.[0]?.href ?? null,
        played: v('gamesPlayed'), won: v('wins'), draw: v('ties'), lost: v('losses'),
        goalsFor: v('pointsFor'), goalsAgainst: v('pointsAgainst'), diff: v('pointDifferential'), points: v('points'),
      }
    }).sort((a: any, b: any) => (a.rank ?? 99) - (b.rank ?? 99)),
  })).filter((g: any) => g.rows.length)
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(req: NextRequest) {
  const user = await getPrivateUser(req)
  if (!user) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const sp = req.nextUrl.searchParams
  const league = sp.get('league') ?? 'ger.1'
  if (!LEAGUES[league]) return NextResponse.json({ error: 'Unbekannte Liga' }, { status: 400 })
  const type = sp.get('type') === 'table' ? 'table' : 'scores'
  const date = sp.get('date')
  try {
    if (type === 'table') {
      const raw = await get(`https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings`, 15 * 60 * 1000)
      return NextResponse.json({ league, name: LEAGUES[league], groups: simplifyTable(raw) })
    }
    const q = date && /^\d{8}(-\d{8})?$/.test(date) ? `?dates=${date}` : ''
    const raw = await get(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard${q}`, 60 * 1000)
    return NextResponse.json({ league, name: LEAGUES[league], matches: simplifyScores(raw) })
  } catch (err) {
    console.error('Sport:', league, type, (err as Error)?.message)
    return NextResponse.json({ error: 'Sportdaten gerade nicht erreichbar' }, { status: 502 })
  }
}