'use client'

// /admin2/startseite → „Weitere Server“
// Diese Adressen klappen auf der Startseite auf, wenn man über seekclan.de fährt.
// Jede bekommt Name, Adresse, optional Version, kurzen Text und ein Bild oder Minecraft-Icon.

import { useEffect, useRef, useState } from 'react'
import { compressImageFile } from '../../lib/image-compress'

type Server = { id: number; address: string; name: string; description: string; version: string; icon: string | null; image: string | null; position: number; active: boolean }
type Draft = { address: string; name: string; description: string; version: string; icon: string; active: boolean; file: File | null; preview: string | null; removeImage: boolean }

const ICONS = [
  'compass_00', 'filled_map', 'diamond_pickaxe', 'iron_sword', 'netherite_sword', 'bow', 'ender_eye', 'ender_pearl',
  'nether_star', 'totem_of_undying', 'experience_bottle', 'emerald', 'golden_apple', 'heart_of_the_sea', 'trident', 'elytra',
  'firework_rocket', 'spyglass', 'lantern', 'bell', 'book', 'cake', 'music_disc_cat', 'clock_00',
]
const EMPTY: Draft = { address: '', name: '', description: '', version: '', icon: '', active: true, file: null, preview: null, removeImage: false }
const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
const smallBtn = { background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
const ACCENT = '#14b8a6'

export default function ServersSection({ canWrite, ready }: { canWrite: boolean; ready: boolean }) {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => setReload(n => n + 1)
  useEffect(() => {
    if (!ready) return
    let alive = true
    fetch('/api/admin2/home-servers', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!alive) return
        if (!r.ok) setError(d.error || 'Fehler beim Laden')
        else { setServers(d.servers || []); setError('') }
      })
      .catch(() => { if (alive) setError('Fehler beim Laden') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ready, reload])

  const startNew = () => { setDraft(EMPTY); setEditing('new'); setError('') }
  const startEdit = (s: Server) => {
    setDraft({ address: s.address, name: s.name, description: s.description, version: s.version, icon: s.icon || '', active: s.active, file: null, preview: s.image, removeImage: false })
    setEditing(s.id); setError('')
  }
  const close = () => { setEditing(null); setDraft(EMPTY) }

  const pickFile = async (f: File) => {
    const compressed = await compressImageFile(f)
    setDraft(d => ({ ...d, file: compressed, preview: URL.createObjectURL(compressed), removeImage: false }))
  }

  const save = async () => {
    setSaving(true); setError('')
    const fd = new FormData()
    fd.append('address', draft.address)
    fd.append('name', draft.name)
    fd.append('description', draft.description)
    fd.append('version', draft.version)
    fd.append('icon', draft.icon)
    fd.append('active', String(draft.active))
    if (draft.file) fd.append('file', draft.file)
    if (draft.removeImage) fd.append('removeImage', 'true')
    const r = await fetch(editing === 'new' ? '/api/admin2/home-servers' : `/api/admin2/home-servers/${editing}`, {
      method: editing === 'new' ? 'POST' : 'PATCH', body: fd,
    })
    const d = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) {
      setError(d.error || (r.status === 413 ? 'Das Bild ist zu groß für den Server. Bitte ein kleineres nehmen.' : `Speichern fehlgeschlagen (Fehler ${r.status})`))
      return
    }
    close(); load()
  }

  const quick = async (id: number, body: object) => {
    await fetch(`/api/admin2/home-servers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    load()
  }
  const remove = async (s: Server) => {
    if (!confirm(`Server „${s.name}“ wirklich löschen?`)) return
    await fetch(`/api/admin2/home-servers/${s.id}`, { method: 'DELETE' })
    load()
  }

  const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }))
  const iconOk = !draft.icon || /^[a-z0-9_]{1,60}$/.test(draft.icon)

  const editor = (
    <div className="rounded-xl p-4 mb-3" style={{ background: 'var(--muted-bg)', border: `1px solid ${ACCENT}55` }}>
      <p className="font-bold text-sm mb-3" style={{ color: 'var(--foreground)' }}>{editing === 'new' ? 'Neuer Server' : 'Server bearbeiten'}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Name
          <input value={draft.name} onChange={e => set({ name: e.target.value })} maxLength={60} placeholder="z. B. Modpack-Server" className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Adresse
          <input value={draft.address} onChange={e => set({ address: e.target.value })} maxLength={100} placeholder="z. B. modpack.seekclan.de" className="w-full mt-1 px-3 py-2 rounded-lg text-sm font-mono" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Version (optional)
          <input value={draft.version} onChange={e => set({ version: e.target.value })} maxLength={30} placeholder="z. B. Java 1.20.1" className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
        <label className="text-xs" style={{ color: 'var(--muted)' }}>Kurzer Text (optional, max. 140 Zeichen)
          <input value={draft.description} onChange={e => set({ description: e.target.value })} maxLength={140} placeholder="Eine Zeile, worum es geht" className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={inputStyle} />
        </label>
      </div>

      <p className="text-xs mt-4 mb-2" style={{ color: 'var(--muted)' }}>Bild (am besten quadratisch, z. B. das Server-Icon) – oder unten ein Minecraft-Icon wählen</p>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-14 h-14 rounded-xl overflow-hidden grid place-items-center flex-shrink-0" style={{ background: '#0a161a' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {draft.preview ? <img src={draft.preview} alt="" className="w-full h-full object-cover" />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={`/item-textures/${draft.icon && iconOk ? draft.icon : 'compass_00'}.png`} alt="" style={{ width: 32, height: 32, imageRendering: 'pixelated' }} />}
        </div>
        <button onClick={() => fileRef.current?.click()} className="h-9 px-3 rounded-lg text-xs" style={smallBtn}>{draft.preview ? 'Anderes Bild' : 'Bild hochladen'}</button>
        {draft.preview && <button onClick={() => set({ file: null, preview: null, removeImage: true })} className="h-9 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Bild entfernen</button>}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = '' }} />
      </div>

      {!draft.preview && (
        <>
          <p className="text-xs mt-4 mb-2" style={{ color: 'var(--muted)' }}>Minecraft-Icon (wird benutzt, wenn kein Bild hochgeladen ist)</p>
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map(n => (
              <button key={n} onClick={() => set({ icon: n })} className="w-9 h-9 rounded-lg grid place-items-center" title={n}
                style={{ ...smallBtn, outline: draft.icon === n ? `2px solid ${ACCENT}` : 'none' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/item-textures/${n}.png`} alt={n} style={{ width: 22, height: 22, imageRendering: 'pixelated' }} />
              </button>
            ))}
          </div>
        </>
      )}

      <label className="flex items-center gap-2 text-sm mt-4" style={{ color: 'var(--foreground)' }}>
        <input type="checkbox" checked={draft.active} onChange={e => set({ active: e.target.checked })} /> Auf der Startseite anzeigen
      </label>

      {error && <p className="text-xs mt-3" style={{ color: '#EF4444' }}>{error}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={save} disabled={saving || !draft.name.trim() || !draft.address.trim() || !iconOk} className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ background: ACCENT }}>
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
        <button onClick={close} className="px-4 py-2 rounded-full text-sm" style={smallBtn}>Abbrechen</button>
      </div>
    </div>
  )

  return (
    <div className="card rounded-2xl p-6 mt-6">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <h2 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Weitere Server ({servers.length})</h2>
        {canWrite && editing === null && (
          <button onClick={startNew} className="px-4 py-2 rounded-full text-sm font-medium text-white" style={{ background: ACCENT }}>+ Neuer Server</button>
        )}
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
        Klappen auf der Startseite unter <b>seekclan.de</b> auf, wenn man mit der Maus darüber fährt (am Handy über den kleinen Pfeil daneben).
      </p>

      {error && editing === null && <p className="text-sm mb-3" style={{ color: '#EF4444' }}>{error}</p>}
      {editing === 'new' && editor}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
      ) : servers.length === 0 && editing !== 'new' ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine weiteren Server. Solange keine da sind, gibt es auf der Startseite nichts zum Aufklappen.</p>
      ) : (
        <div className="space-y-3">
          {servers.map((s, i) => editing === s.id ? <div key={s.id}>{editor}</div> : (
            <div key={s.id} className="flex items-center gap-4 rounded-xl p-3" style={{ background: 'var(--muted-bg)', opacity: s.active ? 1 : 0.55 }}>
              <div className="w-12 h-12 rounded-xl overflow-hidden grid place-items-center flex-shrink-0" style={{ background: '#0a161a' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.image ? <img src={s.image} alt="" className="w-full h-full object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={`/item-textures/${s.icon || 'compass_00'}.png`} alt="" style={{ width: 28, height: 28, imageRendering: 'pixelated' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>
                  {s.name} {s.version && <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>· {s.version}</span>} {!s.active && <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>· ausgeblendet</span>}
                </p>
                <p className="text-xs truncate font-mono" style={{ color: ACCENT }}>{s.address}</p>
                {s.description && <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{s.description}</p>}
              </div>
              {canWrite && (
                <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                  <button onClick={() => quick(s.id, { move: 'up' })} disabled={i === 0} className="w-8 h-8 rounded-lg text-sm disabled:opacity-30" style={smallBtn} aria-label="Nach oben">↑</button>
                  <button onClick={() => quick(s.id, { move: 'down' })} disabled={i === servers.length - 1} className="w-8 h-8 rounded-lg text-sm disabled:opacity-30" style={smallBtn} aria-label="Nach unten">↓</button>
                  <button onClick={() => quick(s.id, { active: !s.active })} className="h-8 px-3 rounded-lg text-xs" style={smallBtn}>{s.active ? 'Ausblenden' : 'Einblenden'}</button>
                  <button onClick={() => startEdit(s)} disabled={editing !== null} className="h-8 px-3 rounded-lg text-xs disabled:opacity-30" style={smallBtn}>Bearbeiten</button>
                  <button onClick={() => remove(s)} className="h-8 px-3 rounded-lg text-xs" style={{ ...smallBtn, color: '#EF4444' }}>Löschen</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}