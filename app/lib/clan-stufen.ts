// Clan-Stufen nach Zeit im Clan (wie auf /clan und den Abzeichen-Seiten). Im Admin-Panel unter Clan & Abzeichen
// lässt sich je Mitglied eine feste Stufe setzen (clan_members.stufe_override, 0–5; leer = automatisch).

export const STUFEN = [
  { name: 'Neuling', min: 0 },
  { name: 'Mitglied', min: 90 },
  { name: 'Treues Mitglied', min: 180 },
  { name: 'Vertrauter', min: 365 },
  { name: 'Goat', min: 730 },
  { name: 'OG', min: 1095 },
]

/** Stufe 0–5: feste Stufe aus dem Admin-Panel, sonst nach Tagen seit dem Beitritt */
export function stufeVon(beitritt: string | null, fest: number | null | undefined): number {
  if (fest != null && fest >= 0 && fest <= 5) return fest
  if (!beitritt) return 0
  const tage = Math.floor((Date.now() - new Date(beitritt).getTime()) / 86_400_000)
  for (let i = STUFEN.length - 1; i >= 0; i--) if (tage >= STUFEN[i].min) return i
  return 0
}

/** „2 Jahre 3 Monate“ */
export function zeitSeit(iso: string | null): string {
  if (!iso) return '–'
  const tage = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
  const j = Math.floor(tage / 365), m = Math.floor((tage % 365) / 30), t = tage % 30
  const teile = []
  if (j) teile.push(`${j} Jahr${j !== 1 ? 'e' : ''}`)
  if (m) teile.push(`${m} Monat${m !== 1 ? 'e' : ''}`)
  if (!j && t) teile.push(`${t} Tag${t !== 1 ? 'e' : ''}`)
  return teile.join(' ') || 'heute'
}
