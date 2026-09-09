'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'
import { compressImageFile } from '../../lib/image-compress'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tag = { id: number; name: string; color: string; requires_version: boolean }
type ChangelogImage = { id: number; filename: string; url: string }

// Ein Abschnitt innerhalb eines Eintrags
type Section = {
  id: string           // lokale temp-ID (bei neuen) oder 'existing-N'
  subheading: string
  description: string
  pendingFiles: File[]         // noch nicht hochgeladen
  existingImages: ChangelogImage[]  // bereits auf Server
}

type Entry = {
  id: number
  title: string
  description: string
  version: string | null
  created_at: string
  tags: Tag[]
  images: ChangelogImage[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2)
}

function emptySection(): Section {
  return { id: uid(), subheading: '', description: '', pendingFiles: [], existingImages: [] }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ─── Serialisierung: Abschnitte → description-String ─────────────────────────
// Format: @@SUB@@Unterüberschrift\nBeschreibung\n@@ENDSUB@@
// Das erlaubt die öffentliche Seite, es als Plain-Text zu rendern,
// und das Admin-Panel es wieder zu parsen.

const SUB_OPEN  = '@@SUB@@'
const SUB_CLOSE = '@@ENDSUB@@'

function sectionsToDescription(sections: Section[]): string {
  return sections
    .filter(s => s.subheading.trim() || s.description.trim())
    .map(s => `${SUB_OPEN}${s.subheading.trim()}\n${s.description.trim()}${SUB_CLOSE}`)
    .join('\n')
}

function descriptionToSections(desc: string): Section[] {
  // Abschnitte parsen
  const regex = new RegExp(`${SUB_OPEN}([\\s\\S]*?)${SUB_CLOSE}`, 'g')
  const sections: Section[] = []
  let match
  while ((match = regex.exec(desc)) !== null) {
    const parts = match[1].split('\n')
    const subheading = parts[0] || ''
    const description = parts.slice(1).join('\n').trim()
    sections.push({ id: uid(), subheading, description, pendingFiles: [], existingImages: [] })
  }
  // Kein strukturiertes Format → ein Abschnitt ohne Unterüberschrift
  if (sections.length === 0 && desc.trim()) {
    return [{ id: uid(), subheading: '', description: desc.trim(), pendingFiles: [], existingImages: [] }]
  }
  return sections.length > 0 ? sections : [emptySection()]
}

// ─── Styling (CSS-Variablen des Admin2-Layouts) ───────────────────────────────

const S = {
  input: {
    background: 'var(--muted-bg)',
    border: '1px solid var(--card-border)',
    color: 'var(--foreground)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
  } as CSSProperties,
  textarea: {
    background: 'var(--muted-bg)',
    border: '1px solid var(--card-border)',
    color: 'var(--foreground)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    lineHeight: '1.55',
  } as CSSProperties,
  label: {
    fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    display: 'block', marginBottom: 5,
  } as CSSProperties,
  card: {
    background: 'var(--card)',
    border: '1px solid var(--card-border)',
    borderRadius: 14,
    padding: '20px 22px',
  } as CSSProperties,
  divider: {
    height: 1,
    background: 'var(--card-border)',
    margin: '16px 0',
  } as CSSProperties,
}

// ─── Abschnitt-Editor ─────────────────────────────────────────────────────────

function SectionEditor({
  section,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  canWrite,
}: {
  section: Section
  index: number
  total: number
  onChange: (s: Section) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  canWrite: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const removeExistingImage = (imgId: number) => {
    onChange({ ...section, existingImages: section.existingImages.filter(i => i.id !== imgId) })
  }

  const removePendingFile = (idx: number) => {
    onChange({ ...section, pendingFiles: section.pendingFiles.filter((_, i) => i !== idx) })
  }

  return (
    <div style={{
      border: '1px solid var(--card-border)',
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 10,
      background: 'var(--muted-bg)',
      position: 'relative',
    }}>
      {/* Abschnitt-Kopf */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', flex: 1 }}>
          Abschnitt {index + 1}
        </span>
        {canWrite && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => onMove(-1)} disabled={index === 0}
              title="Nach oben"
              style={{ ...btnSmall, opacity: index === 0 ? 0.3 : 1 }}
            >↑</button>
            <button
              onClick={() => onMove(1)} disabled={index === total - 1}
              title="Nach unten"
              style={{ ...btnSmall, opacity: index === total - 1 ? 0.3 : 1 }}
            >↓</button>
            <button
              onClick={onRemove} title="Abschnitt entfernen"
              style={{ ...btnSmall, color: '#EF4444' }}
            >✕</button>
          </div>
        )}
      </div>

      {/* Unterüberschrift */}
      <div style={{ marginBottom: 8 }}>
        <label style={S.label}>Unterüberschrift</label>
        <input
          value={section.subheading}
          onChange={e => onChange({ ...section, subheading: e.target.value })}
          placeholder="z. B. Neue Features"
          style={S.input}
          disabled={!canWrite}
        />
      </div>

      {/* Beschreibung */}
      <div style={{ marginBottom: 10 }}>
        <label style={S.label}>Beschreibung</label>
        <textarea
          value={section.description}
          onChange={e => onChange({ ...section, description: e.target.value })}
          placeholder="Was wurde geändert/hinzugefügt..."
          rows={3}
          style={S.textarea}
          disabled={!canWrite}
        />
      </div>

      {/* Bilder */}
      {canWrite && (
        <>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'block', width: '100%', padding: '8px',
              border: '2px dashed var(--card-border)', borderRadius: 8,
              background: 'transparent', color: 'var(--muted)', fontSize: 12,
              cursor: 'pointer', textAlign: 'center',
            }}
          >
            {section.pendingFiles.length > 0
              ? `${section.pendingFiles.length} neue Bild(er) ausgewählt — klicken zum Ändern`
              : '+ Bilder zu diesem Abschnitt hinzufügen'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            style={{ display: 'none' }}
            onChange={e => onChange({ ...section, pendingFiles: Array.from(e.target.files || []) })}
          />
        </>
      )}

      {/* Vorschau: bestehende Bilder */}
      {section.existingImages.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {section.existingImages.map(img => (
            <div key={img.id} style={{ position: 'relative' }}>
              <img
                src={img.url} alt=""
                style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 6, display: 'block' }}
              />
              {canWrite && (
                <button
                  onClick={() => removeExistingImage(img.id)}
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.75)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Vorschau: ausstehende neue Dateien */}
      {section.pendingFiles.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {section.pendingFiles.map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img
                src={URL.createObjectURL(f)} alt=""
                style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 6, display: 'block', opacity: 0.7 }}
              />
              <button
                onClick={() => removePendingFile(i)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(239,68,68,0.85)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const btnSmall: CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--card-border)',
  borderRadius: 5,
  color: 'var(--muted)',
  cursor: 'pointer',
  fontSize: 12,
  padding: '2px 7px',
}

// ─── Drawer (rechts einschieben) ──────────────────────────────────────────────

function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  // ESC schließt
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.35)',
          }}
        />
      )}

      {/* Drawer-Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 540,
        zIndex: 50,
        transform: open ? 'translateX(0)' : 'translateX(110%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        background: 'var(--card)',
        borderLeft: '1px solid var(--card-border)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
      }}>
        {/* Drawer-Header */}
        <div style={{
          padding: '16px 22px',
          borderBottom: '1px solid var(--card-border)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--foreground)', flex: 1 }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: 'var(--muted-bg)', border: '1px solid var(--card-border)',
              borderRadius: 7, color: 'var(--muted)', fontSize: 14,
              cursor: 'pointer', padding: '4px 10px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Drawer-Body scrollbar */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          {children}
        </div>
      </div>
    </>
  )
}

// ─── Entry-Form (in Drawer) ───────────────────────────────────────────────────

function EntryForm({
  tags,
  canWrite,
  initial,           // undefined = neu, Entry = bearbeiten
  onSaved,
  onClose,
}: {
  tags: Tag[]
  canWrite: boolean
  initial?: Entry
  onSaved: () => void
  onClose: () => void
}) {
  const isEdit = !!initial

  const [title, setTitle] = useState(initial?.title ?? '')
  const [version, setVersion] = useState(initial?.version ?? '')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initial?.tags.map(t => t.id) ?? [])
  const [sections, setSections] = useState<Section[]>(() => {
    if (!initial) return [emptySection()]
    const parsed = descriptionToSections(initial.description)
    // Bilder aufteilen: im Edit-Modus werden alle Bilder dem ersten Abschnitt zugeordnet
    // (Rückwärtskompatibilität — neue Einträge haben Bilder per Abschnitt)
    if (parsed.length > 0) {
      parsed[0].existingImages = initial.images
    }
    return parsed
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const versionRequired = selectedTagIds.some(id => tags.find(t => t.id === id)?.requires_version)

  const toggleTag = (id: number) => {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const updateSection = (idx: number, s: Section) => {
    setSections(prev => prev.map((old, i) => i === idx ? s : old))
  }

  const removeSection = (idx: number) => {
    setSections(prev => prev.filter((_, i) => i !== idx))
  }

  const moveSection = (idx: number, dir: -1 | 1) => {
    setSections(prev => {
      const arr = [...prev]
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= arr.length) return arr;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
      return arr
    })
  }

  const submit = async () => {
    setError('')
    if (!title.trim()) { setError('Titel ist Pflicht'); return }
    if (versionRequired && !version.trim()) { setError('Version ist Pflicht für den ausgewählten Tag'); return }

    setSaving(true)

    const description = sectionsToDescription(sections)

    // Bilder die beim Edit gelöscht wurden
    const removedImageIds: number[] = []
    if (isEdit) {
      const origIds = new Set(initial!.images.map(i => i.id))
      const keptIds = new Set(sections.flatMap(s => s.existingImages.map(i => i.id)))
      for (const id of origIds) {
        if (!keptIds.has(id)) removedImageIds.push(id)
      }
    }

    const body = {
      title: title.trim(),
      description,
      version: version.trim() || null,
      tag_ids: selectedTagIds,
      ...(isEdit ? { id: initial!.id } : {}),
    }

    const res = await fetch('/api/admin2/changelog', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Fehler'); setSaving(false); return }

    const entryId = isEdit ? initial!.id : data.entry.id

    // Gelöschte Bilder entfernen
    await Promise.all(removedImageIds.map(imgId =>
      fetch('/api/admin2/changelog/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: imgId }),
      })
    ))

    // Neue Bilder hochladen (alle pendingFiles aller Abschnitte)
    for (const section of sections) {
      for (const file of section.pendingFiles) {
        const compressed = await compressImageFile(file)
        const formData = new FormData()
        formData.append('file', compressed)
        formData.append('entry_id', String(entryId))
        await fetch('/api/admin2/changelog/images', { method: 'POST', body: formData })
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Titel */}
      <div>
        <label style={S.label}>Titel *</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="z. B. Claim-Gruppen-System"
          style={S.input}
          disabled={!canWrite}
        />
      </div>

      {/* Tags */}
      <div>
        <label style={S.label}>Kategorie / Tags</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(tag => {
            const active = selectedTagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                disabled={!canWrite}
                style={{
                  padding: '4px 13px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${tag.color}`,
                  background: active ? tag.color : 'transparent',
                  color: active ? '#fff' : tag.color,
                  cursor: canWrite ? 'pointer' : 'default',
                  transition: 'all 0.12s',
                }}
              >
                {tag.name}{tag.requires_version ? ' 🔖' : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Version */}
      <div>
        <label style={S.label}>
          Version {versionRequired ? '(Pflicht)' : '(optional)'}
        </label>
        <input
          value={version}
          onChange={e => setVersion(e.target.value)}
          placeholder="z. B. 1.2.0"
          style={{
            ...S.input,
            borderColor: versionRequired ? '#16A34A' : 'var(--card-border)',
          }}
          disabled={!canWrite}
        />
      </div>

      <div style={S.divider} />

      {/* Abschnitte */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ ...S.label, margin: 0, flex: 1 }}>Abschnitte</label>
          {canWrite && (
            <button
              onClick={() => setSections(prev => [...prev, emptySection()])}
              style={{
                fontSize: 12, fontWeight: 600, padding: '4px 12px',
                background: 'var(--muted-bg)', border: '1px solid var(--card-border)',
                borderRadius: 7, color: 'var(--foreground)', cursor: 'pointer',
              }}
            >
              + Abschnitt
            </button>
          )}
        </div>

        {sections.map((section, i) => (
          <SectionEditor
            key={section.id}
            section={section}
            index={i}
            total={sections.length}
            onChange={s => updateSection(i, s)}
            onRemove={() => removeSection(i)}
            onMove={dir => moveSection(i, dir)}
            canWrite={canWrite}
          />
        ))}

        {sections.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
            Noch kein Abschnitt. Klicke „+ Abschnitt".
          </p>
        )}
      </div>

      {/* Fehler */}
      {error && (
        <p style={{ fontSize: 12, color: '#EF4444', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 7 }}>
          {error}
        </p>
      )}

      {/* Buttons */}
      {canWrite && (
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button
            onClick={submit}
            disabled={saving || !title.trim()}
            className="btn-gradient"
            style={{
              color: '#fff', border: 'none', borderRadius: 9,
              padding: '9px 22px', fontSize: 13, fontWeight: 600,
              cursor: saving || !title.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !title.trim() ? 0.55 : 1,
            }}
          >
            {saving ? 'Speichert...' : isEdit ? 'Änderungen speichern' : 'Veröffentlichen'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '9px 16px', fontSize: 13, borderRadius: 9,
              background: 'var(--muted-bg)', border: '1px solid var(--card-border)',
              color: 'var(--muted)', cursor: 'pointer',
            }}
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tag-Manager ──────────────────────────────────────────────────────────────

function TagManager({ tags, onTagsChanged, canWrite }: {
  tags: Tag[]
  onTagsChanged: (tags: Tag[]) => void
  canWrite: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#7C3AED')
  const [requiresVersion, setRequiresVersion] = useState(false)
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch('/api/admin2/changelog/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), color, requires_version: requiresVersion }),
    })
    const data = await res.json()
    if (res.ok) {
      onTagsChanged([...tags, data.tag])
      setName(''); setColor('#7C3AED'); setRequiresVersion(false); setOpen(false)
    }
    setSaving(false)
  }

  const deleteTag = async (id: number) => {
    if (!confirm('Tag löschen? Er wird von allen Einträgen entfernt.')) return
    await fetch('/api/admin2/changelog/tags', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    onTagsChanged(tags.filter(t => t.id !== id))
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Tags / Kategorien</span>
        {canWrite && (
          <button
            onClick={() => setOpen(v => !v)}
            style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px',
              background: 'var(--muted-bg)', border: '1px solid var(--card-border)',
              borderRadius: 6, color: 'var(--muted)', cursor: 'pointer',
            }}
          >
            {open ? 'Schließen' : '+ Neuer Tag'}
          </button>
        )}
      </div>

      {/* Bestehende Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: open ? 12 : 0 }}>
        {tags.map(tag => (
          <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
              background: tag.color + '22', color: tag.color,
              border: `1px solid ${tag.color}44`,
            }}>
              {tag.name}{tag.requires_version ? ' 🔖' : ''}
            </span>
            {canWrite && (
              <button
                onClick={() => deleteTag(tag.id)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, padding: '2px 4px', lineHeight: 1 }}
              >✕</button>
            )}
          </div>
        ))}
        {tags.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Noch keine Tags.</span>
        )}
      </div>

      {/* Neuer Tag Formular */}
      {open && canWrite && (
        <div style={{
          background: 'var(--muted-bg)', border: '1px solid var(--card-border)',
          borderRadius: 9, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="Tag-Name"
              style={{ ...S.input, flex: 1 }}
            />
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              style={{ width: 38, height: 38, borderRadius: 7, border: '1px solid var(--card-border)', cursor: 'pointer', padding: 2 }}
            />
            <button
              onClick={create} disabled={saving || !name.trim()}
              className="btn-gradient"
              style={{
                color: '#fff', border: 'none', borderRadius: 7,
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                cursor: saving || !name.trim() ? 'not-allowed' : 'pointer',
                opacity: saving || !name.trim() ? 0.5 : 1,
              }}
            >
              {saving ? '...' : 'Erstellen'}
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={requiresVersion}
              onChange={e => setRequiresVersion(e.target.checked)}
            />
            Erfordert Versionsnummer bei Einträgen mit diesem Tag
          </label>
        </div>
      )}
    </div>
  )
}

// ─── Eintrag-Karte (Liste) ────────────────────────────────────────────────────

function EntryCard({
  entry,
  canWrite,
  onEdit,
  onDelete,
}: {
  entry: Entry
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Beschreibung parsen für Anzeige
  const sections = descriptionToSections(entry.description)

  return (
    <div style={{
      border: '1px solid var(--card-border)',
      borderRadius: 11,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Eintrag-Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', cursor: 'pointer',
          background: expanded ? 'var(--muted-bg)' : 'transparent',
          transition: 'background 0.12s',
        }}
      >
        {/* Tags (Farbpunkte) */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {entry.tags.map(tag => (
            <span key={tag.id} style={{
              width: 8, height: 8, borderRadius: '50%', background: tag.color,
              display: 'inline-block', boxShadow: `0 0 5px ${tag.color}66`,
            }} />
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.title}
            </span>
            {entry.version && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
                background: 'var(--muted-bg)', color: 'var(--muted)',
                border: '1px solid var(--card-border)', flexShrink: 0,
              }}>
                v{entry.version}
              </span>
            )}
            {entry.tags.map(tag => (
              <span key={tag.id} style={{
                fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 99,
                background: tag.color + '18', color: tag.color, flexShrink: 0,
              }}>
                {tag.name}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {formatDate(entry.created_at)} · {sections.length} Abschnitt{sections.length !== 1 ? 'e' : ''}
            {entry.images.length > 0 ? ` · ${entry.images.length} Bild${entry.images.length !== 1 ? 'er' : ''}` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {canWrite && (
            <>
              <button
                onClick={e => { e.stopPropagation(); onEdit() }}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px',
                  background: 'var(--muted-bg)', border: '1px solid var(--card-border)',
                  borderRadius: 6, color: 'var(--foreground)', cursor: 'pointer',
                }}
              >
                Bearbeiten
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete() }}
                style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 6, color: '#EF4444', cursor: 'pointer',
                }}
              >
                Löschen
              </button>
            </>
          )}
          <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expandierter Inhalt */}
      {expanded && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--card-border)' }}>
          {sections.map((s, i) => (
            <div key={i} style={{ marginBottom: i < sections.length - 1 ? 14 : 0 }}>
              {s.subheading && (
                <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--foreground)', marginBottom: 4 }}>
                  {s.subheading}
                </p>
              )}
              {s.description && (
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {s.description}
                </p>
              )}
            </div>
          ))}

          {/* Bilder */}
          {entry.images.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {entry.images.map(img => (
                <img
                  key={img.id} src={img.url} alt=""
                  style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminChangelogPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [entries, setEntries] = useState<Entry[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  // Drawer-State
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<Entry | undefined>(undefined)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/admin2/changelog').then(r => r.json()),
      fetch('/api/admin2/changelog/tags').then(r => r.json()),
    ]).then(([eData, tData]) => {
      setEntries(eData.entries || [])
      setTags(tData.tags || [])
      setLoading(false)
    })
  }

  useEffect(() => { if (user) load() }, [user])

  const openNew = () => { setEditEntry(undefined); setDrawerOpen(true) }
  const openEdit = (entry: Entry) => { setEditEntry(entry); setDrawerOpen(true) }
  const closeDrawer = () => setDrawerOpen(false)

  const deleteEntry = async (id: number) => {
    if (!confirm('Diesen Eintrag wirklich löschen?')) return
    await fetch('/api/admin2/changelog', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Seiten-Header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4 }}>
            📢 Changelog
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Einträge erscheinen öffentlich auf{' '}
            <a href="/changelog" style={{ color: '#7C3AED', textDecoration: 'none' }}>/changelog</a>.
            Struktur: Überschrift → Abschnitte (Unterüberschrift + Text + Bilder).
          </p>
        </div>

        {/* Neuer Eintrag Button — rechts oben */}
        {canWrite && (
          <button
            onClick={openNew}
            className="btn-gradient"
            style={{
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 20px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >
            + Neuer Eintrag
          </button>
        )}
      </div>

      {/* ── Tag-Manager ──────────────────────────────────────────────────────── */}
      <div style={S.card}>
        <TagManager tags={tags} onTagsChanged={setTags} canWrite={canWrite} />
      </div>

      {/* ── Eintrags-Liste ───────────────────────────────────────────────────── */}
      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)', flex: 1 }}>
            Einträge ({entries.length})
          </span>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Lädt...</p>
        ) : entries.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Noch keine Einträge. Erstelle den ersten mit „+ Neuer Eintrag".</p>
        ) : (
          entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              canWrite={canWrite}
              onEdit={() => openEdit(entry)}
              onDelete={() => deleteEntry(entry.id)}
            />
          ))
        )}
      </div>

      {/* ── Drawer ───────────────────────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editEntry ? `Bearbeiten: ${editEntry.title}` : 'Neuer Changelog-Eintrag'}
      >
        {/* Key = editEntry?.id damit Form bei Wechsel neu mountet */}
        <EntryForm
          key={editEntry?.id ?? 'new'}
          tags={tags}
          canWrite={canWrite}
          initial={editEntry}
          onSaved={load}
          onClose={closeDrawer}
        />
      </Drawer>
    </div>
  )
}