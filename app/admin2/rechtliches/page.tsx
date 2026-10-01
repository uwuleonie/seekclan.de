'use client'

// /admin2/rechtliches – Impressum & Datenschutzerklärung bearbeiten
// Editor wie in Word (Überschriften, fett, Listen, Links). Jede Speicherung wird als Version abgelegt
// und kann wiederhergestellt werden. Bearbeiten dürfen nur Administrator/Owner.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { DEFAULT_LEGAL } from '../../lib/legal-defaults'
import '../../legal.css'

type Slug = 'impressum' | 'datenschutz'
type Page = { slug: Slug; title: string; html: string; updatedAt: string | null; stand: string | null; isDefault: boolean }
type Version = { id: number; createdAt: string; by: string | null; note: string | null }

const TABS: { slug: Slug; label: string; href: string }[] = [
  { slug: 'impressum', label: 'Impressum', href: '/impressum' },
  { slug: 'datenschutz', label: 'Datenschutzerklärung', href: '/datenschutz' },
]

const btn = { background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
const fmt = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function Admin2RechtlichesPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [slug, setSlug] = useState<Slug>('impressum')
  const [page, setPage] = useState<Page | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [tableMissing, setTableMissing] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [dirty, setDirty] = useState(false)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [reload, setReload] = useState(0)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false, codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
    ],
    editable: false,
    content: '',
    onUpdate: () => setDirty(true),
  })

  useEffect(() => { editor?.setEditable(canWrite) }, [editor, canWrite])

  // Seite laden
  useEffect(() => {
    if (!user || !editor) return
    let alive = true
    fetch(`/api/admin2/legal/${slug}`, { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!alive) return
        if (!r.ok) { setMsg({ ok: false, text: d.error || 'Fehler beim Laden' }); return }
        setPage(d.page); setVersions(d.versions || []); setTableMissing(!!d.tableMissing)
        setTitle(d.page.title)
        editor.commands.setContent(d.page.html, { emitUpdate: false })
        setDirty(false); setNote('')
      })
    return () => { alive = false }
  }, [slug, user, editor, reload])

  const switchTab = (s: Slug) => {
    if (s === slug) return
    if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return
    setPreview(false); setMsg(null); setPage(null); setSlug(s)
  }

  const loadIntoEditor = (html: string, t: string, label: string) => {
    if (!editor) return
    if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return
    editor.commands.setContent(html, { emitUpdate: false })
    setTitle(t); setDirty(true); setPreview(false)
    setMsg({ ok: true, text: `${label} in den Editor geladen – zum Übernehmen „Speichern“ drücken.` })
  }

  const loadVersion = async (v: Version) => {
    const r = await fetch(`/api/admin2/legal/${slug}?version=${v.id}`, { cache: 'no-store' })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg({ ok: false, text: d.error || 'Version konnte nicht geladen werden' }); return }
    loadIntoEditor(d.version.html, d.version.title, `Version vom ${fmt(v.createdAt)}`)
  }

  const save = async () => {
    if (!editor) return
    setSaving(true); setMsg(null)
    const r = await fetch(`/api/admin2/legal/${slug}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, html: editor.getHTML(), note }),
    })
    const d = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) { setMsg({ ok: false, text: d.error || `Speichern fehlgeschlagen (Fehler ${r.status})` }); return }
    setMsg({ ok: true, text: 'Gespeichert – die Seite ist sofort aktualisiert.' })
    setReload(n => n + 1)
  }

  // Warnung beim Verlassen mit ungespeicherten Änderungen
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const tab = TABS.find(t => t.slug === slug)!

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>⚖️ Rechtliches</h1>
          <p style={{ color: 'var(--muted)' }}>Impressum und Datenschutzerklärung bearbeiten. Änderungen sind nach dem Speichern sofort online.</p>
        </div>
        <Link href={tab.href} target="_blank" className="px-4 py-2 rounded-full text-sm font-medium" style={btn}>{tab.label} ansehen ↗</Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(t => (
          <button key={t.slug} onClick={() => switchTab(t.slug)} className="px-4 py-2 rounded-full text-sm font-medium"
            style={slug === t.slug ? { background: '#14b8a6', color: '#fff', border: '1px solid #14b8a6' } : btn}>
            {t.label}
          </button>
        ))}
      </div>

      {!canWrite && <div className="card rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: 'var(--muted)' }}>Du hast hier nur Lesezugriff – bearbeiten dürfen nur Administrator/Owner.</div>}
      {tableMissing && <div className="card rounded-2xl px-4 py-3 mb-4 text-sm" style={{ color: '#EF4444' }}>Die Datenbank-Tabellen fehlen noch – bitte zuerst das SQL ausführen. Bis dahin wird der ursprüngliche Text angezeigt.</div>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Editor */}
        <div className="card rounded-2xl overflow-hidden">
          <div className="p-4 flex flex-col gap-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <label className="text-xs" style={{ color: 'var(--muted)' }}>Überschrift der Seite
              <input value={title} onChange={e => { setTitle(e.target.value); setDirty(true) }} readOnly={!canWrite} maxLength={120}
                className="w-full mt-1 px-3 py-2 rounded-lg text-base font-semibold" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {canWrite && !preview && <Toolbar editor={editor} />}
              <span className="flex-1" />
              <button onClick={() => setPreview(p => !p)} className="h-8 px-3 rounded-lg text-xs" style={preview ? { ...btn, background: '#14b8a6', color: '#fff', borderColor: '#14b8a6' } : btn}>
                {preview ? 'Zurück zum Bearbeiten' : 'Vorschau'}
              </button>
            </div>
          </div>

          <div className="p-5" style={{ background: 'var(--background)' }}>
            {!page && <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt…</p>}
            {preview && editor ? (
              <div className="legal-head" style={{ marginBottom: 14 }}>
                <h1 style={{ color: 'var(--foreground)' }}>{title}</h1>
                <p>Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} (nach dem Speichern)</p>
                <div className="legal-card legal-content" style={{ marginTop: 18 }} dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
              </div>
            ) : (
              <div className="legal-content legal-editor"><EditorContent editor={editor} /></div>
            )}
          </div>

          {canWrite && (
            <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderTop: '1px solid var(--card-border)' }}>
              <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="Was hast du geändert? (optional, z. B. „Hosting auf Hetzner aktualisiert“)"
                className="flex-1 min-w-[220px] px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
              <button onClick={save} disabled={saving || !dirty || !title.trim()} className="px-5 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-40" style={{ background: '#14b8a6' }}>
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          )}
          {msg && <p className="px-4 pb-4 text-sm" style={{ color: msg.ok ? '#0f9488' : '#EF4444' }}>{msg.text}</p>}
        </div>

        {/* Seitenleiste: Status + Versionen */}
        <aside className="flex flex-col gap-4">
          <div className="card rounded-2xl p-4 text-sm" style={{ color: 'var(--foreground)' }}>
            <p className="font-bold mb-1">Status</p>
            {page?.isDefault
              ? <p style={{ color: 'var(--muted)' }}>Noch nie gespeichert – es wird der ursprüngliche, fest eingebaute Text angezeigt.</p>
              : page?.updatedAt && <p style={{ color: 'var(--muted)' }}>Zuletzt gespeichert am {fmt(page.updatedAt)}. Auf der Seite steht „Stand: {page.stand}“.</p>}
            {dirty && <p className="mt-2 font-semibold" style={{ color: '#d97706' }}>Ungespeicherte Änderungen</p>}
          </div>

          <div className="card rounded-2xl p-4 text-sm">
            <p className="font-bold mb-2" style={{ color: 'var(--foreground)' }}>Versionen</p>
            {versions.length === 0 && <p style={{ color: 'var(--muted)' }}>Noch keine gespeicherten Versionen.</p>}
            <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto">
              {versions.map((v, i) => (
                <div key={v.id} className="rounded-lg p-2.5" style={{ background: 'var(--muted-bg)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{fmt(v.createdAt)} {i === 0 && <span style={{ color: '#0f9488' }}>· aktuell</span>}</p>
                  {v.by && <p className="text-xs" style={{ color: 'var(--muted)' }}>von {v.by}</p>}
                  {v.note && <p className="text-xs mt-1" style={{ color: 'var(--foreground)' }}>{v.note}</p>}
                  {canWrite && i > 0 && <button onClick={() => loadVersion(v)} className="mt-1.5 h-7 px-2.5 rounded-md text-xs" style={btn}>In Editor laden</button>}
                </div>
              ))}
            </div>
            {canWrite && (
              <button onClick={() => loadIntoEditor(DEFAULT_LEGAL[slug].html, DEFAULT_LEGAL[slug].title, 'Der ursprüngliche Text')}
                className="mt-3 h-8 px-3 rounded-lg text-xs w-full" style={btn}>Ursprünglichen Text laden</button>
            )}
          </div>

          <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>
            Hinweis: Das ist keine Rechtsberatung. Bei Unsicherheit lass Impressum und Datenschutzerklärung von einer Fachperson prüfen.
          </p>
        </aside>
      </div>

      <style>{`
        .legal-editor .ProseMirror { min-height: 420px; outline: none; color: var(--foreground); }
        .legal-editor .ProseMirror:focus { outline: none; }
        .legal-editor .ProseMirror p.is-editor-empty:first-child::before { content: 'Text eingeben…'; color: var(--muted); float: left; height: 0; pointer-events: none; }
      `}</style>
    </div>
  )
}

function B({ on, active, label, title, disabled }: { on: () => void; active?: boolean; label: React.ReactNode; title: string; disabled?: boolean }) {
  return (
    <button type="button" onMouseDown={e => e.preventDefault()} onClick={on} title={title} aria-label={title} disabled={disabled}
      className="h-8 min-w-8 px-2 rounded-lg text-xs font-semibold disabled:opacity-30"
      style={active ? { background: '#14b8a6', color: '#fff', border: '1px solid #14b8a6' } : btn}>{label}</button>
  )
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const [, force] = useState(0)
  const rerender = useCallback(() => force(n => n + 1), [])
  useEffect(() => {
    if (!editor) return
    editor.on('selectionUpdate', rerender); editor.on('transaction', rerender)
    return () => { editor.off('selectionUpdate', rerender); editor.off('transaction', rerender) }
  }, [editor, rerender])
  if (!editor) return null

  const c = () => editor.chain().focus()
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = prompt('Link-Adresse (https://…, mailto:… oder /seite)', prev || 'https://')
    if (url === null) return
    if (!url.trim() || url.trim() === 'https://') { c().extendMarkRange('link').unsetLink().run(); return }
    c().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <B on={() => c().setParagraph().run()} active={editor.isActive('paragraph')} label="Text" title="Normaler Text" />
      <B on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="H2" title="Überschrift" />
      <B on={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="H3" title="Unterüberschrift" />
      <span className="w-px h-5 mx-1" style={{ background: 'var(--card-border)' }} />
      <B on={() => c().toggleBold().run()} active={editor.isActive('bold')} label={<b>F</b>} title="Fett" />
      <B on={() => c().toggleItalic().run()} active={editor.isActive('italic')} label={<i>K</i>} title="Kursiv" />
      <B on={() => c().toggleUnderline().run()} active={editor.isActive('underline')} label={<u>U</u>} title="Unterstrichen" />
      <B on={setLink} active={editor.isActive('link')} label="Link" title="Link setzen/entfernen" />
      <span className="w-px h-5 mx-1" style={{ background: 'var(--card-border)' }} />
      <B on={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')} label="• Liste" title="Aufzählung" />
      <B on={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="1. Liste" title="Nummerierte Liste" />
      <B on={() => c().setHorizontalRule().run()} label="—" title="Trennlinie" />
      <span className="w-px h-5 mx-1" style={{ background: 'var(--card-border)' }} />
      <B on={() => c().undo().run()} disabled={!editor.can().undo()} label="↶" title="Rückgängig" />
      <B on={() => c().redo().run()} disabled={!editor.can().redo()} label="↷" title="Wiederholen" />
    </div>
  )
}