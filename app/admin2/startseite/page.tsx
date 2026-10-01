'use client'

// /admin2/startseite – Bereichs-Kacheln der Startseite verwalten
// Titel, kurzer Text, Link, Minecraft-Icon, optional Hintergrundbild, Reihenfolge, ein-/ausblenden.
// Die erste Kachel wird auf der Startseite groß dargestellt.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { compressImageFile } from '../../lib/image-compress'
import ServersSection from '././_Servers'

type Tile = { id: number; title: string; description: string; href: string; icon: string | null; image: string | null; position: number; active: boolean }
type Draft = { title: string; description: string; href: string; icon: string; active: boolean; file: File | null; preview: string | null; removeImage: boolean }

const ICONS = [
  'filled_map', 'name_tag', 'spyglass', 'nether_star', 'diamond_sword', 'iron_sword', 'compass_00', 'ender_eye',
  'totem_of_undying', 'golden_apple', 'writable_book', 'firework_rocket', 'emerald', 'goat_horn', 'bell', 'lantern',
  'bow', 'elytra', 'diamond_pickaxe', 'netherite_sword', 'cake', 'book', 'painting', 'trident',
  'experience_bottle', 'ender_pearl', 'heart_of_the_sea', 'music_disc_cat', 'clock_00', 'carrot_on_a_stick',
]

const EMPTY: Draft = { title: '', description: '', href: '/', icon: '', active: true, file: null, preview: null, removeImage: false }
const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
const smallBtn = { background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

export default function Admin2StartseitePage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [tiles, setTiles] = useState<Tile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [reload, setReload] = useState(0)
  const load = () => setReload(n => n + 1)
  useEffect(() => {
    if (!user) return
    let alive = true
    fetch('/api/admin2/home-tiles', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!alive) return
        if (!r.ok) setError(d.error || 'Fehler beim Laden')
        else { setTiles(d.tiles || []); setError('') }
      })
      .catch(() => { if (alive) setError('Fehler beim Laden') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user, reload])

  const startNew = () => { setDraft(EMPTY); setEditing('new'); setError('') }
  const startEdit = (t: Tile) => {
    setDraft({ title: t.title, description: t.description, href: t.href, icon: t.icon || '', active: t.active, file: null, preview: t.image, removeImage: false })
    setEditing(t.id); setError('')
  }
  const close = () => { setEditing(null); setDraft(EMPTY) }

  const pickFile = async (f: File) => {
    const compressed = await compressImageFile(f)
    setDraft(d => ({ ...d, file: compressed, preview: URL.createObjectURL(compressed), removeImage: false }))
  }

  const save = async () => {
    setSaving(true); setError('')
    const fd = new FormData()
    fd.append('title', draft.title)
    fd.append('description', draft.description)
    fd.append('href', draft.href)
    fd.append('icon', draft.icon)
    fd.append('active', String(draft.active))
    if (draft.file) fd.append('file', draft.file)
    if (draft.removeImage) fd.append('removeImage', 'true')
    const r = await fetch(editing === 'new' ? '/api/admin2/home-tiles' : `/api/admin2/home-tiles/${editing}`, {
      method: editing === 'new' ? 'POST' : 'PATCH', body: fd,
    })
    const d = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) {
      setError(d.error || (r.status === 413
        ? 'Das Bild ist zu groß für den Server (Upload-Limit). Bitte ein kleineres Bild nehmen.'
        : `Speichern fehlgeschlagen (Fehler ${r.status})`))
      return
    }
    close(); load()
  }

  const quick = async (id: number, body: object) => {
    await fetch(`/api/admin2/home-tiles/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }
  const remove = async (t: Tile) => {
    if (!confirm(`Kachel „${t.title}“ wirklich löschen?`)) return
    await fetch(`/api/admin2/home-tiles/${t.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🧭 Startseite</h1>
          <p style={{ color: 'var(--muted)' }}>
            Die Kacheln unter „Entdecken“ auf der Startseite. Die erste Kachel wird groß angezeigt.
            Die Bilder oben im Hero verwaltest du unter <Link href="/admin2/showcase" className="underline">Startseiten-Showcase</Link>.
          </p>
        </div>
        <Link href="/" target="_blank" className="px-4 py-2 rounded-full text-sm font-medium" style={smallBtn}>Startseite ansehen ↗</Link>
      </div>

      {!canWrite && (
        <div className="card rounded-2xl px-4 py-3 mb-6 text-sm" style={{ color: 'var(--muted)' }}>
          Du hast hier nur Lesezugriff — Bearbeiten ist Administrator/Owner vorbehalten.
        </div>
      )}

      {error && !editing && <div className="card rounded-2xl px-4 py-3 mb-6 text-sm" style={{ color: '#EF4444' }}>{error}</div>}

      <div className="card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Kacheln ({tiles.length})</h2>
          {canWrite && editing === null && (
            <button onClick={startNew} className="px-4 py-2 rounded-full text-sm font-medium text-white" style={{ background: '#e0483f' }}>+ Neue Kachel</button>
          )}
        </div>

        {editing === 'new' && <Editor draft={draft} setDraft={setDraft} onPick={pickFile} fileRef={fileRef} onSave={save} onCancel={close} saving={saving} error={error} isNew />}

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
        ) : tiles.length === 0 && editing !== 'new' ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Kacheln. Solange keine da sind, zeigt die Startseite keinen „Entdecken“-Bereich.</p>
        ) : (
          <div className="space-y-3">
            {tiles.map((t, i) => editing === t.id ? (
              <Editor key={t.id} draft={draft} setDraft={setDraft} onPick={pickFile} fileRef={fileRef} onSave={save} onCancel={close} saving={saving} error={error} />
            ) : (
              <div key={t.id} className="flex items-center gap-4 rounded-xl p-3" style={{ background: 'var(--muted-bg)', opacity: t.active ? 1 : 0.55 }}>
                <MiniTile title={t.title} icon={t.icon} image={t.image} big={i === 0} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>
                    {t.title} {i === 0 && <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>· groß</span>} {!t.active && <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>· ausgeblendet</span>}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{t.description || '—'}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{t.href}</p>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                    <button onClick={() => quick(t.id, { move: 'up' })} disabled={i === 0} className="w-8 h-8 rounded-lg text-sm disabled:opacity-30" style={smallBtn} aria-label="Nach oben">↑</button>
                    <button onClick={() => quick(t.id, { move: 'down' })} disabled={i === tiles.length - 1} className="w-8 h-8 rounded-lg text-sm disabled:opacity-30" style={smallBtn} aria-label="Nach unten">↓</button>
                    <button onClick={() => quick(t.id, { active: !t.active })} className="h-8 px-3 rounded-lg text-xs" style={smallBtn}>{t.active ? 'Ausblenden' : 'Einblenden'}</button>
                    <button onClick={() => startEdit(t)} disabled={editing !== null} className="h-8 px-3 rounded-lg text-xs disabled:opacity-30" style={smallBtn}>Bearbeiten</button>
                    <button onClick={() => remove(t)} className="h-8 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Löschen</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ServersSection canWrite={canWrite} ready={!!user} />
    </div>
  )
}

function MiniTile({ title, icon, image, big }: { title: string; icon: string | null; image: string | null; big?: boolean }) {
  return (
    <div className="relative flex-shrink-0 rounded-lg overflow-hidden" style={{ width: big ? 96 : 80, height: 64, background: '#1b1622' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,8,15,.85), rgba(10,8,15,0))' }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {icon && <img src={`/item-textures/${icon}.png`} alt="" className="absolute" style={{ top: 5, left: 5, width: 18, height: 18, imageRendering: 'pixelated' }} />}
      <span className="absolute text-white font-bold truncate" style={{ left: 6, right: 6, bottom: 4, fontSize: 10 }}>{title}</span>
    </div>
  )
}

function Editor({ draft, setDraft, onPick, fileRef, onSave, onCancel, saving, error, isNew }: {
  draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>>; onPick: (f: File) => void
  fileRef: React.RefObject<HTMLInputElement | null>; onSave: () => void; onCancel: () => void; saving: boolean; error: string; isNew?: boolean
}) {
  const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }))
  const iconOk = !draft.icon || /^[a-z0-9_]{1,60}$/.test(draft.icon)
  return (
    <div className="rounded-xl p-4 mb-3" style={{ background: 'var(--muted-bg)', border: '1px solid #e0483f55' }}>
      <p className="font-bold text-sm mb-3" style={{ color: 'var(--foreground)' }}>{isNew ? 'Neue Kachel' : 'Kachel bearbeiten'}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Titel
          <input value={draft.title} onChange={e => set({ title: e.target.value })} maxLength={60} placeholder="z. B. SMP" className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Link
          <input value={draft.href} onChange={e => set({ href: e.target.value })} placeholder="/smp oder https://…" className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        <label className="text-xs sm:col-span-2" style={{ color: 'var(--muted)' }}>Kurzer Text (max. 160 Zeichen)
          <input value={draft.description} onChange={e => set({ description: e.target.value })} maxLength={160} placeholder="Eine Zeile, worum es geht" className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
      </div>

      <p className="text-xs mt-4 mb-2" style={{ color: 'var(--muted)' }}>Icon (Minecraft-Item)</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <button onClick={() => set({ icon: '' })} className="w-9 h-9 rounded-lg text-xs" style={{ ...smallBtn, outline: draft.icon === '' ? '2px solid #e0483f' : 'none' }} title="Kein Icon">–</button>
        {ICONS.map(n => (
          <button key={n} onClick={() => set({ icon: n })} className="w-9 h-9 rounded-lg grid place-items-center" title={n}
            style={{ ...smallBtn, outline: draft.icon === n ? '2px solid #e0483f' : 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/item-textures/${n}.png`} alt={n} style={{ width: 22, height: 22, imageRendering: 'pixelated' }} />
          </button>
        ))}
      </div>
      <input value={draft.icon} onChange={e => set({ icon: e.target.value.trim().toLowerCase() })} placeholder="oder Dateiname aus /item-textures, z. B. diamond_sword"
        className="w-full px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle, borderColor: iconOk ? 'var(--card-border)' : '#EF4444' }} />

      <p className="text-xs mt-4 mb-2" style={{ color: 'var(--muted)' }}>Hintergrundbild (optional, am besten ein Screenshot im Querformat)</p>
      <div className="flex items-center gap-3 flex-wrap">
        <MiniTile title={draft.title || 'Titel'} icon={draft.icon && iconOk ? draft.icon : null} image={draft.preview} big />
        <button onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg text-xs" style={smallBtn}>{draft.preview ? 'Anderes Bild' : 'Bild hochladen'}</button>
        {draft.preview && <button onClick={() => set({ file: null, preview: null, removeImage: true })} className="h-9 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Bild entfernen</button>}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />
      </div>

      <label className="flex items-center gap-2 text-sm mt-4" style={{ color: 'var(--foreground)' }}>
        <input type="checkbox" checked={draft.active} onChange={e => set({ active: e.target.checked })} /> Auf der Startseite anzeigen
      </label>

      {error && <p className="text-xs mt-3" style={{ color: '#EF4444' }}>{error}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={onSave} disabled={saving || !draft.title.trim() || !iconOk} className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ background: '#e0483f' }}>
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-full text-sm" style={smallBtn}>Abbrechen</button>
      </div>
    </div>
  )
}