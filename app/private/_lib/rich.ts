// Helfer für formatierte Notizen (Word-Editor): Vorlagen, alte Notizen umwandeln, Export.
// Wird von der Notizen-Seite und der geteilten Ansicht (/private/leonie/view) genutzt.

export type Paper = 'plain' | 'lined' | 'grid'

export const PAPERS: { value: Paper; label: string }[] = [
  { value: 'plain', label: 'Leer' },
  { value: 'lined', label: 'Liniert' },
  { value: 'grid', label: 'Kariert' },
]

export interface ExportNote {
  title: string
  content: string
  content_html?: string | null
  paper?: Paper | null
  created_at?: string
  updated_at: string
}

export function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Alte Notizen (nur Text) in Editor-HTML umwandeln.
 * Jede Zeile wird ein Absatz; https://-Links und [Text](https://…) werden klickbar.
 */
export function plainToHtml(text: string): string {
  if (!text.trim()) return ''
  const linkify = (line: string) => {
    const parts: string[] = []
    const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(\bhttps?:\/\/[^\s<>)"]+)/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      parts.push(escapeHtml(line.slice(last, m.index)))
      const url = m[2] ?? m[3]
      const label = m[1] ?? m[3]
      parts.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(label)}</a>`)
      last = m.index + m[0].length
    }
    parts.push(escapeHtml(line.slice(last)))
    return parts.join('')
  }
  return text.split('\n').map(line => `<p>${linkify(line)}</p>`).join('')
}

/** HTML einer Notiz – formatiert, oder aus dem alten Klartext erzeugt */
export function noteHtml(n: { content: string; content_html?: string | null }): string {
  return n.content_html ?? plainToHtml(n.content)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function safeFilename(name: string) {
  return name.replace(/[^a-z0-9äöüßÄÖÜ\-_ ]/gi, '').trim().replace(/\s+/g, '_') || 'notiz'
}

export function downloadTxt(note: ExportNote) {
  const body = `${note.title}\n${'-'.repeat(40)}\nZuletzt geändert: ${formatDate(note.updated_at)}\n\n${note.content}`
  const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeFilename(note.title)}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Gleiche Darstellung wie im Editor – für Druck/PDF (Kopie der .pv-rich-Regeln aus private.css) */
const PRINT_CSS = `
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#3a1433}
  h1.title{font-family:Georgia,serif;font-size:1.7rem;margin:0 0 .3rem;font-style:italic;line-height:1.3}
  .meta{color:#8a6a80;font-size:.85rem;margin-bottom:18px}
  .page{padding:28px 24px;border-radius:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page.lined{padding-left:56px;
    background-image:linear-gradient(to right,transparent 40px,rgba(217,54,144,.45) 40px,rgba(217,54,144,.45) 41px,transparent 41px),linear-gradient(to bottom,transparent 27px,rgba(124,74,224,.22) 27px);
    background-size:100% 100%,100% 28px}
  .page.grid{background-image:linear-gradient(to right,rgba(124,74,224,.14) 1px,transparent 1px),linear-gradient(to bottom,rgba(124,74,224,.14) 1px,transparent 1px);background-size:28px 28px}
  ${'' /* Inhalt */}
  .c{font-size:16px;line-height:28px;overflow-wrap:anywhere}
  .c p{margin:0;min-height:28px}
  .c h1{font-size:30px;line-height:56px;margin:0;font-family:Georgia,serif}
  .c h2{font-size:23px;line-height:28px;margin:28px 0 0}
  .c h1+h2,.c h2:first-child{margin-top:0}
  .c h3{font-size:18px;line-height:28px;margin:0}
  .c ul,.c ol{margin:0;padding-left:1.5em}
  .c li p{margin:0}
  .c ul[data-type=taskList]{list-style:none;padding-left:.2em}
  .c ul[data-type=taskList]>li{display:flex;gap:.5em;align-items:flex-start}
  .c ul[data-type=taskList]>li>label{flex-shrink:0;line-height:28px}
  .c ul[data-type=taskList]>li>div{flex:1}
  .c ul[data-type=taskList]>li[data-checked=true]>div{text-decoration:line-through;opacity:.6}
  .c blockquote{margin:0;padding-left:14px;border-left:3px solid #d93690;color:#6b3a60}
  .c hr{border:none;height:28px;margin:0;background:linear-gradient(to bottom,transparent 13px,#e3c6dc 13px,#e3c6dc 15px,transparent 15px)}
  .c a{color:#c2257f}
  .c img{max-width:100%;height:auto;display:block}
  .c code{font-family:ui-monospace,monospace;background:rgba(124,74,224,.1);padding:0 .3em;border-radius:4px}
  @media print{body{margin:0;max-width:none}}
`

export function buildPrintHtml(note: ExportNote) {
  const paper = note.paper && note.paper !== 'plain' ? note.paper : ''
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(note.title)}</title>
<style>${PRINT_CSS}</style></head><body>
<h1 class="title">${escapeHtml(note.title)}</h1>
<div class="meta">${note.created_at ? `Erstellt ${formatDate(note.created_at)} · ` : ''}Geändert ${formatDate(note.updated_at)}</div>
<div class="page ${paper}"><div class="c">${noteHtml(note)}</div></div>
</body></html>`
}

/** PDF über den Druckdialog. Auf Handys per unsichtbarem iframe (Popups werden dort oft blockiert). */
export function printNote(note: ExportNote, onBlocked?: () => void) {
  const html = buildPrintHtml(note)
  if (window.matchMedia('(pointer: coarse)').matches) {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    document.body.appendChild(frame)
    const doc = frame.contentWindow?.document
    if (!doc) { document.body.removeChild(frame); return }
    doc.open(); doc.write(html); doc.close()
    setTimeout(() => {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
      setTimeout(() => document.body.removeChild(frame), 2000)
    }, 400)
    return
  }
  const win = window.open('', '_blank')
  if (!win) { onBlocked?.(); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}