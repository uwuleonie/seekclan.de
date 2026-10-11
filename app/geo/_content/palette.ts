// Farben für Gruppen auf den Karten – kräftige, aber erdige Töne, gut lesbar auf dem dunklen Glas
export const C = {
  teal: '#14b8a6',
  terra: '#f97316',
  olive: '#84cc16',
  rose: '#f43f5e',
  indigo: '#6366f1',
  ochre: '#eab308',
  green: '#22c55e',
  plum: '#a855f7',
  blue: '#3b82f6',
  brown: '#d97706',
  slate: '#64748b',
  coral: '#fb7185',
  moss: '#65a30d',
  wine: '#db2777',
  sky: '#38bdf8',
  sand: '#facc15',
} as const

/** Reihum vergeben, wenn ein Quiz viele Gruppen hat */
export const CYCLE = [C.teal, C.terra, C.indigo, C.ochre, C.rose, C.green, C.plum, C.blue, C.coral, C.olive, C.brown, C.wine, C.sky, C.slate, C.moss, C.sand]

/** Einwohnerzahl lesbar: 83,1 Mio. · 540.000 */
export function fmtPop(n: number | null | undefined): string {
  if (!n) return '–'
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mrd.`
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.`
  return Math.round(n).toLocaleString('de-DE')
}