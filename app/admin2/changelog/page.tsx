'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'
import { compressImageFile } from '../../lib/image-compress'

type Tag = { id: number, name: string, color: string, requires_version: boolean }
type ChangelogImage = { id: number, filename: string, url: string }
type Entry = {
  id: number
  title: string
  description: string
  version: string | null
  created_at: string
  tags: Tag[]
  images: ChangelogImage[]
}

export default function AdminChangelogPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [entries, setEntries] = useState<Entry[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#7C3AED')
  const [newTagRequiresVersion, setNewTagRequiresVersion] = useState(false)
  const [showTagForm, setShowTagForm] = useState(false)

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const versionRequired = selectedTagIds.some(id => tags.find(t => t.id === id)?.requires_version)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/admin2/changelog').then(r => r.json()),
      fetch('/api/admin2/changelog/tags').then(r => r.json()),
    ]).then(([entriesData, tagsData]) => {
      setEntries(entriesData.entries || [])
      setTags(tagsData.tags || [])
      setLoading(false)
    })
  }

  useEffect(() => { if (user) load() }, [user])

  const toggleTag = (id: number) => {
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const createTag = async () => {
    if (!newTagName.trim()) return
    const res = await fetch('/api/admin2/changelog/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName.trim(), color: newTagColor, requires_version: newTagRequiresVersion }),
    })
    const data = await res.json()
    if (res.ok) {
      setTags(prev => [...prev, data.tag])
      setNewTagName('')
      setNewTagColor('#7C3AED')
      setNewTagRequiresVersion(false)
      setShowTagForm(false)
    } else {
      setError(data.error || 'Fehler beim Erstellen des Tags')
    }
  }

  const deleteTag = async (id: number) => {
    if (!confirm('Tag wirklich löschen? Er wird von allen Einträgen entfernt.')) return
    await fetch('/api/admin2/changelog/tags', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setTags(prev => prev.filter(t => t.id !== id))
    setSelectedTagIds(prev => prev.filter(t => t !== id))
  }

  const submitEntry = async () => {
    setError('')
    setSaving(true)

    const res = await fetch('/api/admin2/changelog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        version: version.trim() || null,
        tag_ids: selectedTagIds,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Fehler beim Erstellen')
      setSaving(false)
      return
    }

    for (const file of pendingFiles) {
      const compressed = await compressImageFile(file)
      const formData = new FormData()
      formData.append('file', compressed)
      formData.append('entry_id', String(data.entry.id))
      await fetch('/api/admin2/changelog/images', { method: 'POST', body: formData })
    }

    setTitle('')
    setDescription('')
    setVersion('')
    setSelectedTagIds([])
    setPendingFiles([])
    setSaving(false)
    load()
  }

  const deleteEntry = async (id: number) => {
    if (!confirm('Diesen Changelog-Eintrag wirklich löschen?')) return
    await fetch('/api/admin2/changelog', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const removeImageFromEntry = async (imageId: number) => {
    await fetch('/api/admin2/changelog/images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: imageId }),
    })
    load()
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>📢 Changelog</h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--muted)' }}>
        Einträge erscheinen öffentlich auf <a href="/changelog" className="underline">/changelog</a>.
      </p>

      {canWrite && (
        <div className="card rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Neuer Eintrag</h2>

          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titel (z. B. 'Claim-Gruppen-System')"
            className="w-full px-3 py-2 rounded-lg text-sm mb-3"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />

          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Beschreibung"
            rows={4}
            className="w-full px-3 py-2 rounded-lg text-sm mb-3 resize-none"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />

          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Tags</span>
              <button onClick={() => setShowTagForm(v => !v)} className="text-xs hover:opacity-70" style={{ color: '#7C3AED' }}>
                {showTagForm ? 'Abbrechen' : '+ Neuer Tag'}
              </button>
            </div>

            {showTagForm && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    placeholder="Tag-Name"
                    className="flex-1 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  />
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={e => setNewTagColor(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer"
                  />
                  <button onClick={createTag} className="btn-gradient text-white px-3 py-1.5 rounded-lg text-sm">Erstellen</button>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--muted)' }}>
                  <input
                    type="checkbox"
                    checked={newTagRequiresVersion}
                    onChange={e => setNewTagRequiresVersion(e.target.checked)}
                  />
                  Erfordert eine Versionsnummer (Format 1.0.0) bei Einträgen mit diesem Tag
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const active = selectedTagIds.includes(tag.id)
                return (
                  <div key={tag.id} className="flex items-center gap-1">
                    <button
                      onClick={() => toggleTag(tag.id)}
                      className="px-3 py-1 rounded-full text-xs font-medium transition"
                      style={active
                        ? { background: tag.color, color: 'white' }
                        : { background: 'var(--muted-bg)', color: 'var(--muted)', border: `1px solid ${tag.color}` }}
                      title={tag.requires_version ? 'Erfordert eine Version' : undefined}
                    >
                      {tag.name}{tag.requires_version ? ' 🔖' : ''}
                    </button>
                    <button onClick={() => deleteTag(tag.id)} className="text-xs hover:opacity-70" style={{ color: 'var(--muted)' }} title="Tag löschen">✕</button>
                  </div>
                )
              })}
            </div>
          </div>

          <input
            type="text"
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder={versionRequired ? 'Version (Pflicht, z. B. 1.2.0)' : 'Version (optional)'}
            className="w-full px-3 py-2 rounded-lg text-sm mb-3"
            style={{
              background: 'var(--muted-bg)',
              border: versionRequired ? '1px solid #16A34A' : '1px solid var(--card-border)',
              color: 'var(--foreground)',
            }}
          />
          {versionRequired && (
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              Mindestens ein ausgewählter Tag erfordert eine Version → Pflicht im Format <code>1.0.0</code>.
            </p>
          )}

          <div className="mb-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl p-4 text-center text-sm cursor-pointer transition"
              style={{ border: '2px dashed var(--card-border)', color: 'var(--muted)' }}
            >
              {pendingFiles.length > 0 ? `${pendingFiles.length} Bild(er) ausgewählt` : 'Bilder hinzufügen (optional)'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={e => setPendingFiles(Array.from(e.target.files || []))}
            />
          </div>

          {error && <p className="text-xs mb-3" style={{ color: '#EF4444' }}>{error}</p>}

          <button
            onClick={submitEntry}
            disabled={saving || !title.trim() || !description.trim()}
            className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Wird gespeichert...' : 'Eintrag veröffentlichen'}
          </button>
        </div>
      )}

      <div className="card rounded-2xl p-6">
        <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Bisherige Einträge ({entries.length})</h2>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Einträge.</p>
        ) : (
          <div className="space-y-4">
            {entries.map(entry => (
              <div key={entry.id} className="rounded-xl p-4" style={{ border: '1px solid var(--card-border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>{entry.title}</h3>
                      {entry.version && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                          v{entry.version}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {entry.tags.map(tag => (
                        <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: tag.color }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {canWrite && (
                    <button onClick={() => deleteEntry(entry.id)} className="text-xs hover:opacity-70 flex-shrink-0" style={{ color: '#EF4444' }}>
                      Löschen
                    </button>
                  )}
                </div>

                <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>{entry.description}</p>

                {entry.images.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {entry.images.map(img => (
                      <div key={img.id} className="relative group">
                        <img src={img.url} alt="" className="w-20 h-20 rounded-lg object-cover" />
                        {canWrite && (
                          <button
                            onClick={() => removeImageFromEntry(img.id)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                            style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs mt-2" style={{ color: 'var(--muted)', opacity: 0.7 }}>
                  {new Date(entry.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}