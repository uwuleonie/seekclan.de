import sanitizeHtml from 'sanitize-html'
import { pool } from '@/app/lib/db'
import { DEFAULT_LEGAL } from '@/app/lib/legal-defaults'

// Impressum & Datenschutzerklärung – im Admin-Bereich unter /admin2/rechtliches bearbeitbar.
// Gespeichert in der Datenbank (legal_pages), jede Speicherung zusätzlich als Version (legal_page_versions).
// Solange nichts gespeichert ist, wird der ursprüngliche Text aus legal-defaults.ts angezeigt.

export const LEGAL_SLUGS = ['impressum', 'datenschutz'] as const
export type LegalSlug = (typeof LEGAL_SLUGS)[number]
export const isLegalSlug = (s: string): s is LegalSlug => (LEGAL_SLUGS as readonly string[]).includes(s)

export const MAX_LEGAL_BYTES = 300 * 1024

// Nur einfache Textformatierung, wie sie der Editor erzeugt. Keine Bilder, Skripte, Styles.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href || ''
      const out: sanitizeHtml.Attributes = href.startsWith('/') ? { href } : { href, target: '_blank', rel: 'noopener noreferrer' }
      return { tagName, attribs: out }
    },
    b: 'strong',
    i: 'em',
  },
}

export function sanitizeLegalHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim()
}

export type LegalPage = { slug: LegalSlug; title: string; html: string; updatedAt: string | null; stand: string | null; isDefault: boolean }

/** Aktuellen Stand einer Seite laden (mit Rückfall auf den ursprünglichen Text). */
export async function getLegalPage(slug: LegalSlug): Promise<LegalPage> {
  const def = DEFAULT_LEGAL[slug]
  try {
    const r = await pool.query('SELECT title, content_html, updated_at FROM legal_pages WHERE slug = $1', [slug])
    const row = r.rows[0]
    if (row) {
      const updated = new Date(row.updated_at)
      return {
        slug,
        title: row.title || def.title,
        html: row.content_html,
        updatedAt: updated.toISOString(),
        stand: updated.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }),
        isDefault: false,
      }
    }
  } catch (err) {
    // Tabelle fehlt noch o. Ä. → ursprünglicher Text
    console.error('Rechtliches laden:', (err as Error)?.message)
  }
  return { slug, title: def.title, html: def.html, updatedAt: null, stand: def.stand, isDefault: true }
}