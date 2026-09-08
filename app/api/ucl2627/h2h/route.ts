import { NextRequest, NextResponse } from 'next/server'

const CLUB_MAP: Record<string, number> = {
  aek:    1065,
  ars:    57,
  atm:    78,
  avl:    58,
  bar:    81,
  bet:    90,
  bodo:   1406,
  bru:    851,
  bvb:    4,
  com:    586,
  fcb:    5,
  fen:    354,
  fey:    675,
  gal:    1007,
  int:    108,
  lask:   1151,
  len:    532,
  lil:    521,
  liv:    64,
  mci:    65,
  mun:    66,
  nap:    113,
  por:    503,
  psg:    524,
  psv:    674,
  rbl:    721,
  rma:    86,
  rom:    100,
  sab:    1106,
  shk:    1015,
  sla:    404,
  slovan: 1076,
  spo:    498,
  vfb:    32,
  vik:    445,
  vil:    94,
}

const API = 'https://api.football-data.org/v4'

async function fd(path: string, key: string) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'X-Auth-Token': key },
    next: { revalidate: 3600 },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status}: ${text}`)
  return JSON.parse(text)
}

export async function GET(req: NextRequest) {
  const home = req.nextUrl.searchParams.get('home')
  const away = req.nextUrl.searchParams.get('away')
  if (!home || !away) return NextResponse.json({ error: 'home und away required' }, { status: 400 })

  const homeId = CLUB_MAP[home]
  const awayId = CLUB_MAP[away]
  if (!homeId || !awayId) {
    return NextResponse.json({ matches: [], note: `Club-ID fehlt: ${!homeId ? home : away}` })
  }

  const key = process.env.FOOTBALL_DATA_API_KEY
  if (!key) return NextResponse.json({ error: 'FOOTBALL_DATA_API_KEY nicht gesetzt' }, { status: 500 })

  try {
    // UCL-Matches der aktuellen Saison holen — CL = Champions League code
    // season=2026 = Saison 2026/27
    const clData = await fd(`/v4/competitions/CL/matches?season=2026`, key)
    const clMatches: any[] = clData.matches || []

    // Match der beiden Teams in dieser Saison finden → für H2H-Endpunkt
    const encounter = clMatches.find(m =>
      (m.homeTeam?.id === homeId && m.awayTeam?.id === awayId) ||
      (m.homeTeam?.id === awayId && m.awayTeam?.id === homeId)
    )

    if (!encounter) {
      // Kein Aufeinandertreffen dieser Saison → frühere Saisons versuchen (2025, 2024, 2023)
      for (const season of [2025, 2024, 2023, 2022]) {
        try {
          const old = await fd(`/v4/competitions/CL/matches?season=${season}`, key)
          const found = (old.matches || []).find((m: any) =>
            (m.homeTeam?.id === homeId && m.awayTeam?.id === awayId) ||
            (m.homeTeam?.id === awayId && m.awayTeam?.id === homeId)
          )
          if (found) {
            const h2h = await fd(`/v4/matches/${found.id}/head2head?limit=5`, key)
            return NextResponse.json({ matches: format(h2h.matches || []) })
          }
        } catch {}
      }
      return NextResponse.json({ matches: [] })
    }

    // H2H über die gefundene Match-ID
    const h2hData = await fd(`/v4/matches/${encounter.id}/head2head?limit=5`, key)
    return NextResponse.json({ matches: format(h2hData.matches || []) })

  } catch (e: any) {
    return NextResponse.json({ error: e.message, matches: [] }, { status: 502 })
  }
}

function format(matches: any[]) {
  return matches
    .filter(m => m.score?.fullTime?.home !== null)
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 5)
    .map(m => ({
      date: m.utcDate,
      competition: m.competition?.name ?? '?',
      homeTeam: m.homeTeam?.shortName ?? m.homeTeam?.name ?? '?',
      awayTeam: m.awayTeam?.shortName ?? m.awayTeam?.name ?? '?',
      homeGoals: m.score?.fullTime?.home ?? null,
      awayGoals: m.score?.fullTime?.away ?? null,
    }))
}