// ─────────────────────────────────────────────────────────────────────────────
// Ballon d'Or — gemeinsame Logik (Server + Client)
// Modular: Ausgaben, Kategorien, Nominierte und Punkteregeln kommen komplett
// aus der Datenbank. Für eine neue Ausgabe wird nur eine neue Edition angelegt
// und die Nominiertenliste importiert.
// ─────────────────────────────────────────────────────────────────────────────

export type BdoGender = 'm' | 'w' | null
export type BdoKind = 'winner' | 'ranking'
export type BdoNomineeType = 'player' | 'coach' | 'club'

export type BdoScoring = {
  winner?: number   // richtiger Gewinner (bei 'ranking' = richtiger Platz 1)
  exact?: number    // Ranking: exakte Position
  diff1?: number    // Ranking: 1 Platz daneben
  diff2?: number    // Ranking: 2 Plätze daneben
}

export type BdoStat = { label: string; value: string }

export type BdoEdition = {
  id: number
  slug: string
  title: string
  ceremony_at: string | null
  tips_close_at: string | null
  is_active: boolean
}

export type BdoCategory = {
  id: number
  edition_id: number
  name: string
  gender: BdoGender
  kind: BdoKind
  nominee_type: BdoNomineeType
  sort: number
  scoring: BdoScoring
  nominee_ids: number[]
}

export type BdoNominee = {
  id: number
  edition_id: number
  name: string
  gender: BdoGender
  nominee_type: BdoNomineeType
  country: string | null
  club: string | null
  photo_url: string | null
  position: string | null
  birthdate: string | null
  stats: BdoStat[]
  bio: string | null
}

export type BdoResult = {
  category_id: number
  winner_nominee_id: number | null
  ranking: number[] | null
  published_at: string | null
}

export type BdoTip = {
  category_id: number
  pick_nominee_id: number | null
  ranking: number[] | null
}

// Standard-Punkte (Platzhalter — pro Kategorie im Adminpanel änderbar)
export const DEFAULT_SCORING: Record<BdoKind, BdoScoring> = {
  winner:  { winner: 5 },
  ranking: { winner: 10, exact: 3, diff1: 2, diff2: 1 },
}

export function scoringOf(cat: Pick<BdoCategory, 'kind' | 'scoring'>): Required<BdoScoring> {
  const d = DEFAULT_SCORING[cat.kind]
  const s = cat.scoring ?? {}
  return {
    winner: Number(s.winner ?? d.winner ?? 0),
    exact:  Number(s.exact  ?? d.exact  ?? 0),
    diff1:  Number(s.diff1  ?? d.diff1  ?? 0),
    diff2:  Number(s.diff2  ?? d.diff2  ?? 0),
  }
}

// ── Punkteberechnung ────────────────────────────────────────────────────────

export type BdoCategoryScore = {
  category_id: number
  category: string
  points: number
  winnerHit: boolean
  exact: number
  diff1: number
  diff2: number
}

export function scoreTip(cat: BdoCategory, tip: BdoTip | undefined, result: BdoResult | undefined): BdoCategoryScore {
  const base: BdoCategoryScore = { category_id: cat.id, category: cat.name, points: 0, winnerHit: false, exact: 0, diff1: 0, diff2: 0 }
  if (!tip || !result || !result.published_at) return base
  const sc = scoringOf(cat)

  if (cat.kind === 'winner') {
    if (tip.pick_nominee_id !== null && tip.pick_nominee_id === result.winner_nominee_id) {
      base.winnerHit = true
      base.points = sc.winner
    }
    return base
  }

  // Ranking
  const official = result.ranking ?? []
  const mine = tip.ranking ?? []
  if (!official.length || !mine.length) return base
  const officialPos = new Map<number, number>()
  official.forEach((id, i) => officialPos.set(id, i + 1))

  mine.forEach((id, i) => {
    const op = officialPos.get(id)
    if (!op) return
    const d = Math.abs(op - (i + 1))
    if (d === 0) { base.exact++; base.points += sc.exact }
    else if (d === 1) { base.diff1++; base.points += sc.diff1 }
    else if (d === 2) { base.diff2++; base.points += sc.diff2 }
  })
  const officialWinner = result.winner_nominee_id ?? official[0]
  if (mine[0] !== undefined && mine[0] === officialWinner) {
    base.winnerHit = true
    base.points += sc.winner
  }
  return base
}

// ── Import der Nominiertenliste ──────────────────────────────────────────────
// Erwartetes Format (so wie es der Veranstalter veröffentlicht):
//
//   Men's Ballon d'Or® 2026 nominees
//   Jude Bellingham (England, Real Madrid)
//   ...
//   Men's Club of the Year 2026 nominees
//   Arsenal (England)

export type ParsedNominee = { name: string; country: string | null; club: string | null }
export type ParsedCategory = {
  name: string
  gender: BdoGender
  kind: BdoKind
  nominee_type: BdoNomineeType
  nominees: ParsedNominee[]
}

const cleanMarks = (s: string) => s.replace(/[®™]/g, '').replace(/\s+/g, ' ').trim()

export function parseNomineeLine(line: string): ParsedNominee | null {
  const l = cleanMarks(line)
  if (!l) return null
  const m = l.match(/^(.+?)\s*\((.+)\)\s*$/)
  if (!m) return { name: l, country: null, club: null }
  const name = m[1].trim()
  const inner = m[2].trim()
  const comma = inner.indexOf(',')
  if (comma >= 0) return { name, country: inner.slice(0, comma).trim(), club: inner.slice(comma + 1).trim() || null }
  // Sonderfall "(Spain/Barcelona)"
  const slash = inner.indexOf('/')
  if (slash >= 0) return { name, country: inner.slice(0, slash).trim(), club: inner.slice(slash + 1).trim() || null }
  return { name, country: inner, club: null }
}

export function parseCategoryHeader(line: string): Omit<ParsedCategory, 'nominees'> | null {
  const l = cleanMarks(line)
  if (!/nominees?\s*$/i.test(l)) return null
  const name = l.replace(/\s*\d{4}\s*nominees?\s*$/i, '').replace(/\s*nominees?\s*$/i, '').trim()
  if (!name) return null
  const lower = name.toLowerCase()
  const gender: BdoGender = /^women'?s\b/.test(lower) ? 'w' : /^men'?s\b/.test(lower) ? 'm' : null
  const nominee_type: BdoNomineeType = /\bclub\b/.test(lower) ? 'club' : /\bcoach\b/.test(lower) ? 'coach' : 'player'
  const kind: BdoKind = /ballon d'?or$/.test(lower.replace(/^(wo)?men'?s\s+/, '')) ? 'ranking' : 'winner'
  return { name, gender, kind, nominee_type }
}

export function parseImport(text: string): ParsedCategory[] {
  const out: ParsedCategory[] = []
  let cur: ParsedCategory | null = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const header = parseCategoryHeader(line)
    if (header) {
      cur = { ...header, nominees: [] }
      out.push(cur)
      continue
    }
    if (!cur) continue // Einleitungstext vor der ersten Kategorie ignorieren
    if (line.startsWith('•')) continue
    const n = parseNomineeLine(line)
    if (n) cur.nominees.push(n)
  }
  return out.filter(c => c.nominees.length > 0)
}

// Deutsche Anzeigenamen der Standardkategorien
export function categoryLabel(name: string): string {
  const map: [RegExp, string][] = [
    [/^Men'?s Ballon d'?Or$/i, "Ballon d'Or"],
    [/^Women'?s Ballon d'?Or$/i, "Ballon d'Or Féminin"],
    [/Young Talent of the Year$/i, 'Kopa Trophy · Nachwuchs'],
    [/Goalkeeper of the Year$/i, 'Yashin Trophy · Torhüter'],
    [/Coach of the Year$/i, 'Johan Cruyff Trophy · Trainer'],
    [/Club of the Year$/i, 'Verein des Jahres'],
    [/Striker of the Year$/i, 'Gerd Müller Trophy · Stürmer'],
  ]
  for (const [re, l] of map) if (re.test(name)) return l
  return name
}

export function ageFrom(birthdate: string | null): number | null {
  if (!birthdate) return null
  const b = new Date(birthdate)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--
  return a
}