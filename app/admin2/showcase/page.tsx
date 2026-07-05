'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'
import { compressImageFile } from '../../lib/image-compress'

type ShowcaseImage = {
  id: number
  filename: string
  caption: string | null
  position: number
  url: string
}

export default function Admin2ShowcasePage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [images, setImages] = useState<ShowcaseImage[]>([])
  const [loading, setLoading] = useState(true)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/admin2/showcase')
      .then(r => r.json())
      .then(data => setImages(data.images || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (user) load() }, [user])

  const upload = async (file: File) => {
    setUploading(true)
    setError('')
    const compressed = await compressImageFile(file)
    const formData = new FormData()
    formData.append('file', compressed)
    if (caption.trim()) formData.append('caption', caption.trim())

    const res = await fetch('/api/admin2/showcase', { method: 'POST', body: formData })
    setUploading(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Fehler beim Hochladen')
      return
    }
    setCaption('')
    load()
  }

  const remove = async (id: number) => {
    if (!confirm('Dieses Bild wirklich von der Startseite entfernen?')) return
    await fetch(`/api/admin2/showcase/${id}`, { method: 'DELETE' })
    load()
  }

  const saveCaption = async (id: number, newCaption: string) => {
    await fetch(`/api/admin2/showcase/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: newCaption }),
    })
    load()
  }

  const move = async (id: number, direction: 'up' | 'down') => {
    await fetch(`/api/admin2/showcase/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move: direction }),
    })
    load()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🖼️ Startseiten-Showcase</h1>
        <p style={{ color: 'var(--muted)' }}>
          Diese Bilder rotieren im Hero-Bereich der Startseite. Empfohlenes Format: ca. 4:3, unter 5 MB.
        </p>
      </div>

      {!canWrite && (
        <div className="card rounded-2xl px-4 py-3 mb-6 text-sm" style={{ color: 'var(--muted)' }}>
          Du hast hier nur Lesezugriff — Hochladen, Bearbeiten und Löschen ist Administrator/Owner vorbehalten.
        </div>
      )}

      {canWrite && (
        <div className="card rounded-2xl p-6 mb-6">
          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Bildunterschrift (z. B. 'Niffinos Burg — 64 Chunks')"
            className="w-full px-3 py-2 rounded-lg text-sm mb-3"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />

          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl p-8 text-center cursor-pointer transition"
            style={{
              border: dragOver ? '2px dashed #7C3AED' : '2px dashed var(--card-border)',
              background: dragOver ? 'rgba(124,58,237,0.05)' : 'transparent',
            }}
          >
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {uploading ? 'Wird hochgeladen...' : 'Bild hierher ziehen oder klicken zum Auswählen'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }}
            />
          </div>

          {error && <p className="text-xs mt-2" style={{ color: '#EF4444' }}>{error}</p>}
        </div>
      )}

      <div className="card rounded-2xl p-6">
        <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--foreground)' }}>
          Reihenfolge auf der Startseite ({images.length})
        </h2>
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
        ) : images.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Bilder hochgeladen.</p>
        ) : (
          <div className="space-y-3">
            {images.map((img, i) => (
              <ShowcaseRow key={img.id} image={img} canWrite={canWrite}
                isFirst={i === 0} isLast={i === images.length - 1}
                onRemove={() => remove(img.id)}
                onSaveCaption={c => saveCaption(img.id, c)}
                onMoveUp={() => move(img.id, 'up')}
                onMoveDown={() => move(img.id, 'down')} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ShowcaseRow({ image, canWrite, isFirst, isLast, onRemove, onSaveCaption, onMoveUp, onMoveDown }: {
  image: ShowcaseImage, canWrite: boolean, isFirst: boolean, isLast: boolean,
  onRemove: () => void, onSaveCaption: (caption: string) => void, onMoveUp: () => void, onMoveDown: () => void,
}) {
  const [caption, setCaption] = useState(image.caption || '')
  useEffect(() => { setCaption(image.caption || '') }, [image.caption])

  return (
    <div className="flex items-center gap-4 rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
      <img src={image.url} alt={caption} className="w-20 h-16 rounded-lg object-cover flex-shrink-0" />
      <input
        value={caption}
        onChange={e => setCaption(e.target.value)}
        onBlur={() => canWrite && onSaveCaption(caption)}
        readOnly={!canWrite}
        placeholder="Bildunterschrift"
        className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
      />
      {canWrite && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onMoveUp} disabled={isFirst}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm disabled:opacity-30"
            style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
            ↑
          </button>
          <button onClick={onMoveDown} disabled={isLast}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm disabled:opacity-30"
            style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
            ↓
          </button>
          <button onClick={onRemove}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:opacity-80"
            style={{ background: '#EF444422', color: '#EF4444', border: '1px solid #EF444455' }}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}