// Gemeinsame Typen und Stile für /admin2/personen (Personen, Ränge, Clan)

import type { Rang } from '@/app/lib/rechte-def'

/** Rang, wie /api/admin2/ranks ihn liefert: Website-Felder (Rang) + Minecraft-Felder aus mc_ranks */
export interface RangVoll extends Rang {
  display_name: string
  chat_prefix: string
  tab_prefix: string
  tab_suffix: string
  color: string
  name_color: string
  priority: number
  is_default: boolean
  permissions: string[]
  can_assign_up_to_priority: number
  web_farbe: string | null
  personen: number
}

export interface Person {
  key: string
  userId: string | null
  username: string | null
  name: string
  mcName: string | null
  uuid: string | null
  rangId: number
  vergebenVon: string | null
  vergebenAm: string | null
  zuletztOnline: string | null
  gesperrt: boolean
  clanId: string | null
  clanSeit: string | null
  /** nur mit ?alle=1: Konto-Status */
  deaktiviert?: boolean
  letzterLogin?: string | null
  kontoSeit?: string | null
}

export const inp: React.CSSProperties = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }
export const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, padding: 20 }
export const gradBtn: React.CSSProperties = { background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }
export const ghostBtn: React.CSSProperties = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

/** Kleines Rang-Schild in der Rang-Farbe */
export function RangSchild({ rang, klein }: { rang: Pick<Rang, 'anzeige' | 'farbe'> | undefined | null; klein?: boolean }) {
  if (!rang) return null
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${klein ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}
      style={{ background: `${rang.farbe}22`, color: rang.farbe, border: `1px solid ${rang.farbe}55` }}>
      {rang.anzeige}
    </span>
  )
}

export const fmtDatum = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–')
