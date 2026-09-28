import sanitizeHtml from 'sanitize-html'

// Formatierter Notiz-Inhalt (HTML aus dem Word-Editor) wird vor dem Speichern gereinigt.
// Erlaubt ist nur, was der Editor selbst erzeugt: Überschriften, fett/kursiv/unterstrichen,
// Farben, Schriftgrößen, Listen, Checklisten, Ausrichtung, Links und Unterschrift-Bilder.
// Alles andere (Skripte, iframes, fremde Bilder, Event-Handler …) fliegt raus – wichtig,
// weil geteilte Notizen über einen Link ohne Login angezeigt werden.

export const MAX_HTML_BYTES = 6 * 1024 * 1024 // 6 MB (Unterschriften sind eingebettete PNGs)

const COLOR = [/^#[0-9a-f]{3,8}$/i, /^[a-z]{3,20}$/i, /^rgba?\(\s*[\d.\s,%]+\)$/i, /^var\(--[a-z0-9-]+\)$/i]
const SIZE = [/^\d{1,3}(\.\d+)?(px|pt|em|rem)$/]
const ALIGN = [/^(left|right|center|justify)$/]

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'span', 'mark',
    'ul', 'ol', 'li', 'label', 'input', 'div', 'blockquote', 'hr', 'a', 'img', 'code',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'title', 'data-signature'],
    ul: ['data-type'],
    ol: ['start', 'type'],
    li: ['data-type', 'data-checked'],
    input: ['type', 'checked', 'disabled'],
    mark: ['data-color'],
    '*': ['style'],
  },
  allowedStyles: {
    '*': {
      color: COLOR,
      'background-color': COLOR,
      'font-size': SIZE,
      'text-align': ALIGN,
      width: [/^\d{1,4}px$/],
      height: [/^\d{1,4}px$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['data'] },
  allowProtocolRelative: false,
  transformTags: {
    // Links immer in neuem Tab und ohne Zugriff auf unser Fenster öffnen
    a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' } }),
    // Gespeicherte Checkboxen sind nur Anzeige (der Editor zeichnet eigene)
    input: (tagName, attribs) => ({ tagName, attribs: { ...attribs, disabled: 'disabled' } }),
  },
  exclusiveFilter: frame => {
    // Nur eingebettete PNG/JPEG/WebP-Bilder (Unterschriften), keine externen Bilder
    if (frame.tag === 'img') return !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(frame.attribs.src || '')
    // Nur Checkboxen (für Checklisten)
    if (frame.tag === 'input') return frame.attribs.type !== 'checkbox'
    return false
  },
}

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS)
}

/** Grober Klartext aus HTML (für Suche, Vorschau und TXT-Export, falls der Client keinen schickt). */
export function htmlToPlain(html: string): string {
  return sanitizeHtml(
    html
      .replace(/<\/(p|h[1-3]|li|blockquote|div)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n'),
    { allowedTags: [], allowedAttributes: {} }
  )
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}   