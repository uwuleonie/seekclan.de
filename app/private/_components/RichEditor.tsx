'use client'

// Word-ähnlicher Editor für Notizen (TipTap / ProseMirror).
// Kann: Überschriften, Schriftgröße, fett/kursiv/unterstrichen/durchgestrichen, Textfarbe,
// Markieren, Ausrichtung, Listen, Checklisten, Zitat, Trennlinie, Links, Unterschrift.
// Papier: leer, liniert oder kariert.
//
// Wird pro Notiz neu aufgebaut (key={note.id}) – "html" ist nur der Startinhalt.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import Image from '@tiptap/extension-image'
import { Placeholder } from '@tiptap/extensions'
import Icon from './Icon'
import SignatureDialog from './SignatureDialog'
import { PAPERS, type Paper } from '../_lib/rich'

const TEXT_COLORS = [
  '#3a1433', '#111111', '#6b6477', '#c0344f', '#d93690', '#a93bc9',
  '#7c4ae0', '#2f6fd6', '#138a8a', '#25845c', '#c77700', '#8a5a2b',
]
const MARK_COLORS = ['#fff1a6', '#ffd3e6', '#e7dcff', '#d3f4df', '#d4e9ff', '#ffe0c2']
const SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px']

type Panel = null | 'color' | 'mark' | 'link'

export default function RichEditor({
  html, editable, paper, onChange, onPaperChange, toast, before, after, placeholder = 'Schreiben …', autoFocus = false,
}: {
  html: string
  editable: boolean
  paper: Paper
  onChange: (html: string, text: string) => void
  onPaperChange?: (p: Paper) => void
  toast: (t: string) => void
  /** Wird vor dem Text in die Seite gesetzt (z.B. Bilder-Spalte oben rechts) */
  before?: ReactNode
  /** Wird nach dem Text gesetzt (z.B. Datei-Karten) */
  after?: ReactNode
  placeholder?: string
  autoFocus?: boolean
}) {
  const editorRef = useRef<Editor | null>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autoFocus && editable ? 'end' : false,
    content: html,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https',
          HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' } },
      }),
      TextStyleKit.configure({ fontFamily: false, lineHeight: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      // Checklisten lassen sich auch im Lesemodus abhaken
      TaskItem.configure({
        nested: true,
        // Im Lesemodus ändert TipTap das Dokument nicht selbst → hier nachziehen
        onReadOnlyChecked: (node, checked) => {
          const ed = editorRef.current
          if (!ed) return false
          let pos = -1
          ed.state.doc.descendants((n, p) => {
            if (pos >= 0) return false
            if (n === node) { pos = p; return false }
            return true
          })
          if (pos < 0) return false
          ed.view.dispatch(ed.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked }))
          return true
        },
        a11y: { checkboxLabel: (node, checked) => `${checked ? 'Erledigt' : 'Offen'}: ${node.textContent || 'leerer Punkt'}` },
      }),
      Image.configure({ allowBase64: true, inline: false, resize: { enabled: true, minWidth: 40, minHeight: 20, alwaysPreserveAspectRatio: true } }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: { attributes: { class: 'pv-rich-content', spellcheck: 'true' } },
    onUpdate: ({ editor: ed, transaction }) => {
      // Nur echte Inhaltsänderungen speichern (nicht z.B. Umschalten Lesen/Bearbeiten)
      if (!transaction.docChanged) return
      onChangeRef.current(ed.getHTML(), ed.getText({ blockSeparator: '\n' }))
    },
  })

  useEffect(() => { editorRef.current = editor }, [editor])
  useEffect(() => { editor?.setEditable(editable, false) }, [editor, editable])

  return (
    <div className="pv-rich" data-paper={paper}>
      {editable && editor && <Toolbar editor={editor} paper={paper} onPaperChange={onPaperChange} toast={toast} />}
      <div className="pv-rich-scroll">
        <div className="pv-rich-page">
          {before}
          <EditorContent editor={editor} />
          {after}
        </div>
      </div>
    </div>
  )
}

/* ── Werkzeugleiste ─────────────────────────────────────────────────────── */

function Toolbar({ editor, paper, onPaperChange, toast }: {
  editor: Editor
  paper: Paper
  onPaperChange?: (p: Paper) => void
  toast: (t: string) => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [sigOpen, setSigOpen] = useState(false)

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      alignCenter: e.isActive({ textAlign: 'center' }),
      alignRight: e.isActive({ textAlign: 'right' }),
      alignJustify: e.isActive({ textAlign: 'justify' }),
      color: (e.getAttributes('textStyle').color as string | undefined) ?? null,
      mark: (e.getAttributes('textStyle').backgroundColor as string | undefined) ?? null,
      size: (e.getAttributes('textStyle').fontSize as string | undefined) ?? '',
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })

  const chain = () => editor.chain().focus()
  const block = s.h1 ? 'h1' : s.h2 ? 'h2' : s.h3 ? 'h3' : 'p'

  function setBlock(v: string) {
    if (v === 'p') chain().setParagraph().run()
    else chain().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run()
  }

  function openLink() {
    setLinkUrl((editor.getAttributes('link').href as string) ?? '')
    setPanel(p => (p === 'link' ? null : 'link'))
  }
  function applyLink() {
    let url = linkUrl.trim()
    if (!url) { chain().extendMarkRange('link').unsetLink().run(); setPanel(null); return }
    if (!/^(https?:|mailto:|tel:)/i.test(url)) url = `https://${url}`
    if (editor.state.selection.empty && !editor.isActive('link')) {
      // Nichts markiert → Link-Text = Adresse
      chain().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run()
    } else {
      chain().extendMarkRange('link').setLink({ href: url }).run()
    }
    setPanel(null)
  }

  const btn = (label: string, icon: string, active: boolean, run: () => void, disabled = false) => (
    <button
      type="button"
      className={`pv-rt-btn ${active ? 'active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={e => e.preventDefault()} // Markierung im Text behalten
      onClick={run}
    >
      <Icon name={icon} size={17} />
    </button>
  )

  return (
    <div className="pv-rt">
      <div className="pv-rt-bar" role="toolbar" aria-label="Formatierung">
        {btn('Rückgängig (Strg+Z)', 'undo', false, () => chain().undo().run(), !s.canUndo)}
        {btn('Wiederholen (Strg+Y)', 'redo', false, () => chain().redo().run(), !s.canRedo)}
        <span className="pv-rt-sep" />
        <select className="pv-rt-select" aria-label="Absatzformat" value={block} onChange={e => setBlock(e.target.value)} style={{ width: 128 }}>
          <option value="p">Text</option>
          <option value="h1">Überschrift 1</option>
          <option value="h2">Überschrift 2</option>
          <option value="h3">Überschrift 3</option>
        </select>
        <select
          className="pv-rt-select"
          aria-label="Schriftgröße"
          title="Schriftgröße"
          value={s.size}
          onChange={e => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
          style={{ width: 78 }}
        >
          <option value="">Größe</option>
          {SIZES.map(v => <option key={v} value={v}>{parseInt(v)}</option>)}
        </select>
        <span className="pv-rt-sep" />
        {btn('Fett (Strg+B)', 'bold', s.bold, () => chain().toggleBold().run())}
        {btn('Kursiv (Strg+I)', 'italic', s.italic, () => chain().toggleItalic().run())}
        {btn('Unterstrichen (Strg+U)', 'underline', s.underline, () => chain().toggleUnderline().run())}
        {btn('Durchgestrichen', 'strike', s.strike, () => chain().toggleStrike().run())}
        <span className="pv-rt-sep" />
        <button
          type="button" className={`pv-rt-btn ${panel === 'color' ? 'active' : ''}`} title="Textfarbe" aria-label="Textfarbe"
          onMouseDown={e => e.preventDefault()} onClick={() => setPanel(p => (p === 'color' ? null : 'color'))}
        >
          <span className="pv-rt-colorbtn"><Icon name="textColor" size={17} /><i style={{ background: s.color ?? 'var(--pv-ink)' }} /></span>
        </button>
        <button
          type="button" className={`pv-rt-btn ${panel === 'mark' ? 'active' : ''}`} title="Markieren" aria-label="Markieren"
          onMouseDown={e => e.preventDefault()} onClick={() => setPanel(p => (p === 'mark' ? null : 'mark'))}
        >
          <span className="pv-rt-colorbtn"><Icon name="highlight" size={17} /><i style={{ background: s.mark ?? MARK_COLORS[0] }} /></span>
        </button>
        <span className="pv-rt-sep" />
        {btn('Linksbündig', 'alignLeft', !s.alignCenter && !s.alignRight && !s.alignJustify, () => chain().unsetTextAlign().run())}
        {btn('Zentriert', 'alignCenter', s.alignCenter, () => chain().setTextAlign('center').run())}
        {btn('Rechtsbündig', 'alignRight', s.alignRight, () => chain().setTextAlign('right').run())}
        {btn('Blocksatz', 'alignJustify', s.alignJustify, () => chain().setTextAlign('justify').run())}
        <span className="pv-rt-sep" />
        {btn('Aufzählung', 'listBullet', s.bullet, () => chain().toggleBulletList().run())}
        {btn('Nummerierung', 'listOrdered', s.ordered, () => chain().toggleOrderedList().run())}
        {btn('Checkliste', 'checklist', s.task, () => chain().toggleTaskList().run())}
        {btn('Zitat', 'quote', s.quote, () => chain().toggleBlockquote().run())}
        {btn('Trennlinie', 'divider', false, () => chain().setHorizontalRule().run())}
        {btn('Link', 'link', s.link || panel === 'link', openLink)}
        <span className="pv-rt-sep" />
        {btn('Unterschrift einfügen', 'signature', false, () => setSigOpen(true))}
        {btn('Formatierung entfernen', 'eraser', false, () => chain().unsetAllMarks().clearNodes().unsetTextAlign().run())}
        {onPaperChange && (
          <>
            <span className="pv-rt-sep" />
            <select className="pv-rt-select" aria-label="Papier" title="Papier" value={paper} onChange={e => onPaperChange(e.target.value as Paper)} style={{ width: 96 }}>
              {PAPERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </>
        )}
      </div>

      {panel === 'color' && (
        <div className="pv-rt-panel">
          <span className="pv-rt-panel-label">Textfarbe</span>
          {TEXT_COLORS.map(c => (
            <button key={c} type="button" className={`pv-swatch ${s.color === c ? 'active' : ''}`} style={{ background: c }} aria-label={c}
              onMouseDown={e => e.preventDefault()} onClick={() => { chain().setColor(c).run(); setPanel(null) }} />
          ))}
          <label className="pv-swatch custom" title="Eigene Farbe">
            <input type="color" value={s.color && s.color.startsWith('#') ? s.color : '#3a1433'} onChange={e => chain().setColor(e.target.value).run()} />
          </label>
          <button type="button" className="pv-btn sm" onMouseDown={e => e.preventDefault()} onClick={() => { chain().unsetColor().run(); setPanel(null) }}>Standard</button>
        </div>
      )}

      {panel === 'mark' && (
        <div className="pv-rt-panel">
          <span className="pv-rt-panel-label">Markieren</span>
          {MARK_COLORS.map(c => (
            <button key={c} type="button" className={`pv-swatch ${s.mark === c ? 'active' : ''}`} style={{ background: c }} aria-label={c}
              onMouseDown={e => e.preventDefault()} onClick={() => { chain().setBackgroundColor(c).run(); setPanel(null) }} />
          ))}
          <label className="pv-swatch custom" title="Eigene Farbe">
            <input type="color" value={s.mark && s.mark.startsWith('#') ? s.mark : '#fff1a6'} onChange={e => chain().setBackgroundColor(e.target.value).run()} />
          </label>
          <button type="button" className="pv-btn sm" onMouseDown={e => e.preventDefault()} onClick={() => { chain().unsetBackgroundColor().run(); setPanel(null) }}>Keine</button>
        </div>
      )}

      {panel === 'link' && (
        <form className="pv-rt-panel" onSubmit={e => { e.preventDefault(); applyLink() }}>
          <span className="pv-rt-panel-label">Link</span>
          <input className="pv-input" style={{ flex: 1, minWidth: 160, minHeight: 34 }} placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} autoFocus inputMode="url" />
          <button type="submit" className="pv-btn sm primary">Übernehmen</button>
          {s.link && <button type="button" className="pv-btn sm" onClick={() => { chain().extendMarkRange('link').unsetLink().run(); setPanel(null) }}>Entfernen</button>}
        </form>
      )}

      {sigOpen && (
        <SignatureDialog
          toast={toast}
          onClose={() => setSigOpen(false)}
          onInsert={sig => {
            // Höhe auf ganze Zeilen (28px) runden, damit der Text danach wieder auf den Linien sitzt
            const w0 = Math.min(sig.width, 320)
            const h = Math.max(56, Math.round((sig.height * (w0 / sig.width)) / 28) * 28)
            const w = Math.round(sig.width * (h / sig.height))
            editor.chain().focus().setImage({ src: sig.src, alt: 'Unterschrift', width: w, height: h }).run()
          }}
        />
      )}
    </div>
  )
}