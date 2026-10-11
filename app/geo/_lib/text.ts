// Eintippen: tolerant bei Umlauten, Akzenten, Bindestrichen und kleinen Tippfehlern

/** "Saint-Étienne" → "sanktetienne", "Ü" → "ue", "ß" → "ss" */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\bst\.?\s/g, 'sankt ').replace(/\bsaint\b/g, 'sankt').replace(/\bsankt\b/g, 'sankt')
    .replace(/[^a-z0-9]/g, '')
}

/** Zusätzlich Umlaute ohne e akzeptieren ("Osterreich" für "Österreich") */
function variants(s: string): string[] {
  const a = normalize(s)
  const b = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '')
  return a === b ? [a] : [a, b]
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/** Erlaubte Tippfehler je nach Länge: bis 4 Zeichen keiner, bis 8 einer, länger zwei */
const allowed = (len: number) => (len <= 4 ? 0 : len <= 8 ? 1 : 2)

export type TypeResult = 'exact' | 'close' | 'wrong'

export function checkTyped(input: string, answers: string[]): TypeResult {
  const ins = variants(input)
  if (!ins[0]) return 'wrong'
  let close = false
  for (const ans of answers) {
    for (const a of variants(ans)) {
      if (!a) continue
      if (ins.includes(a)) return 'exact'
      if (ins.some(i => levenshtein(i, a) <= allowed(a.length))) close = true
    }
  }
  return close ? 'close' : 'wrong'
}
