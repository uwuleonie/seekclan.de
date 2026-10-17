import { randomInt } from 'crypto'

// Codes für /link im Spiel (Tabelle minecraft_link_codes).
// Ohne leicht verwechselbare Zeichen (0/O, 1/I/L), damit man sie notfalls auch abtippen kann.

const ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function neuerLinkCode(laenge = 8): string {
  let c = ''
  for (let i = 0; i < laenge; i++) c += ZEICHEN[randomInt(ZEICHEN.length)]
  return c
}

/** Eingabe säubern: Leerzeichen und Bindestriche weg, Großbuchstaben */
export function linkCodeSaeubern(eingabe: unknown): string {
  return String(eingabe ?? '').replace(/[\s-]/g, '').toUpperCase().slice(0, 16)
}

/** Adresse der Website für Links im Spiel-Chat (SITE_URL in .env, sonst seekclan.de) */
export function seitenAdresse(): string {
  return (process.env.SITE_URL || 'https://seekclan.de').replace(/\/+$/, '')
}
