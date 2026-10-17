// Rechte und Ränge von seekclan.de – EIN System für Website, Minecraft und Clan.
//
// So hängt alles zusammen:
//  - Jede Person hat genau EINEN Rang (Tabelle mc_ranks: Orga, Admin, VIP, Clan-Mod, Clan, Server-Team, Spieler …).
//    Ränge werden im Admin-Panel unter /admin2/raenge bearbeitet.
//  - Ein Rang bestimmt
//      · im Spiel: Prefixe, Farbe, Minecraft-Permissions (liest das Plugin über /api/internal/*)
//      · auf der Website: die Rechte unten (Spalte mc_ranks.rechte, „*“ = alle Rechte)
//      · im Clan/Team: ob die Person auf /clan bzw. /team erscheint (mc_ranks.clan / mc_ranks.team)
//  - Wer welchen Rang hat: mc_player_ranks (je Minecraft-UUID) – für Website-Konten ohne verknüpften
//    Minecraft-Account ersatzweise users.rang_id. Setzen nur über rangSetzen() in app/lib/rechte.ts.
//  - Geprüft wird IMMER ein Recht, nie ein Rang-Name:  darf(nutzer, 'admin.verwalten')
//
// Diese Datei ist auch im Browser nutzbar (keine Datenbank).

export type RechtKey =
  | 'admin.zugang'
  | 'admin.teambereiche'
  | 'admin.verwalten'
  | 'support.team'
  | 'konten.verwalten'
  | 'clan.verwalten'
  | 'raenge.vergeben'
  | 'raenge.bearbeiten'
  | 'privat.zugang'
  | 'server.freigeben'

export interface RechtDef { key: RechtKey; name: string; text: string; gruppe: string }

/** Alle Website-Rechte. Neue Rechte hier eintragen – im Admin-Panel erscheinen sie dann automatisch zum Anhaken. */
export const RECHTE: RechtDef[] = [
  { key: 'admin.zugang', gruppe: 'Admin-Panel', name: 'Admin-Panel ansehen', text: 'Admin-Panel (/admin2) öffnen und alles lesen.' },
  { key: 'admin.teambereiche', gruppe: 'Admin-Panel', name: 'Team-Bereiche bearbeiten', text: 'Update-Konzepte, Team-Chat, WM-Tippspiel und Support-Tickets im Admin-Panel bearbeiten.' },
  { key: 'admin.verwalten', gruppe: 'Admin-Panel', name: 'Alles bearbeiten', text: 'Überall im Admin-Panel bearbeiten, dazu die Admin-Funktionen auf den öffentlichen Seiten (UCL-Tippspiel, Ballon d’Or, Changelog, Atlas …).' },
  { key: 'support.team', gruppe: 'Support', name: 'Support-Team', text: 'Alle Support-Tickets sehen und als Team antworten.' },
  { key: 'konten.verwalten', gruppe: 'Personen', name: 'Konten verwalten', text: 'Website-Konten sperren, deaktivieren und Passwörter zurücksetzen.' },
  { key: 'clan.verwalten', gruppe: 'Personen', name: 'Clan verwalten', text: 'Clan-Mitglieder aufnehmen und entfernen, Beitrittsdatum, Stufe und Discord bearbeiten.' },
  { key: 'raenge.vergeben', gruppe: 'Personen', name: 'Ränge vergeben', text: 'Personen einen Rang geben – nur Ränge bis zur eigenen Vergabe-Grenze.' },
  { key: 'raenge.bearbeiten', gruppe: 'Personen', name: 'Ränge bearbeiten', text: 'Ränge anlegen, ändern und löschen, Rechte und Prefixe festlegen.' },
  { key: 'privat.zugang', gruppe: 'Sonstiges', name: 'Privater Bereich', text: 'Den privaten Bereich (/private) öffnen.' },
  { key: 'server.freigeben', gruppe: 'Sonstiges', name: 'Server-Aktionen direkt', text: 'Server-Neustarts und Konsolenbefehle ohne Freigabe ausführen und Anfragen anderer freigeben.' },
]
export const RECHT_KEYS = RECHTE.map(r => r.key)
/** „*“ = alle Rechte, auch künftige */
export const ALLE_RECHTE = '*'

/** Rang, wie ihn Website und Admin-Panel sehen */
export interface Rang {
  id: number
  /** Fester Schlüssel (z. B. für alte Einstellungen im Atlas) – kann leer sein */
  schluessel: string | null
  name: string
  anzeige: string
  /** Farbe für die Website (#rrggbb) – aus web_farbe, sonst aus dem Minecraft-Farbcode */
  farbe: string
  prioritaet: number
  rechte: string[]
  clan: boolean
  team: boolean
  beschreibung: string | null
  /** Nur im Spiel: Prefix und Minecraft-Permissions gelten, auf der Website (Rechte, /clan, /team, Profil) zählt die Person
   *  wie jemand mit dem Standard-Rang. */
  nurIngame: boolean
  /** Darf Ränge bis zu dieser Priorität vergeben (-1 = gar keine) */
  vergabeBis: number
  standard: boolean
}

/** Angemeldete Person mit Rang und Rechten (vom Server, z. B. /api/auth/me) */
export interface MitRechten { rechte?: string[] | null; rang?: Pick<Rang, 'prioritaet' | 'vergabeBis'> | null }

/** Darf diese Person das? (Server und Browser) */
export function darf(n: MitRechten | null | undefined, recht: RechtKey): boolean {
  const r = n?.rechte
  return !!r && (r.includes(ALLE_RECHTE) || r.includes(recht))
}
/** Hat eins der Rechte */
export const darfEins = (n: MitRechten | null | undefined, ...rechte: RechtKey[]) => rechte.some(r => darf(n, r))

/** Darf n einer Person mit Rang ziel (aktueller Rang) den Rang neu geben? */
export function darfRangGeben(n: MitRechten | null | undefined, aktuell: { prioritaet: number } | null, neu: { prioritaet: number }): boolean {
  if (!n?.rechte) return false
  if (n.rechte.includes(ALLE_RECHTE)) return true
  if (!darf(n, 'raenge.vergeben')) return false
  const grenze = n.rang?.vergabeBis ?? -1
  return neu.prioritaet <= grenze && (!aktuell || aktuell.prioritaet <= grenze)
}

/** Minecraft-Farbcode (§a, &c …) → Farbe für die Website */
const MC_FARBEN: Record<string, string> = {
  '0': '#000000', '1': '#0000aa', '2': '#00aa00', '3': '#00aaaa', '4': '#aa0000', '5': '#aa00aa', '6': '#ffaa00', '7': '#aaaaaa',
  '8': '#555555', '9': '#5555ff', a: '#55ff55', b: '#55ffff', c: '#ff5555', d: '#ff55ff', e: '#ffff55', f: '#ffffff',
}
export function mcFarbe(code: string | null | undefined): string | null {
  const hex = /#([0-9a-f]{6})/i.exec(code ?? '')
  if (hex) return `#${hex[1].toLowerCase()}`
  const m = /[§&]([0-9a-f])/i.exec(code ?? '')
  return m ? MC_FARBEN[m[1].toLowerCase()] : null
}
