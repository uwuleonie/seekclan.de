'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../../lib/auth-context'

type ShowcaseImage = {
  id: number
  filename: string
  caption: string | null
  url: string
}

export default function AdminShowcasePage() {
  const { user, loading: authLoading } = useAuth()
  const [images, setImages] = useState<ShowcaseImage[]>([])
  const [loading, setLoading] = useState(true)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/showcase')
      .then(r => r.json())
      .then(data => {
        setImages(data.images || [])
        setLoading(false)
      })
  }

  useEffect(() => { if (user) load() }, [user])

  const upload = async (file: File) => {
    setUploading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    if (caption.trim()) formData.append('caption', caption.trim())

    const res = await fetch('/api/admin/showcase', { method: 'POST', body: formData })
    setUploading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Fehler beim Hochladen')
      return
    }
    setCaption('')
    load()
  }

  const remove = async (id: number) => {
    await fetch('/api/admin/showcase', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  if (authLoading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Laden...</div>

  if (!user || (user.clan_role?.toLowerCase() !== 'admin' && user.clan_role?.toLowerCase() !== 'mod')) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <p style={{ color: 'var(--foreground)' }}>Kein Zugriff.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-3xl mx-auto px-8 py-10">
        <Link href="/admin" className="text-sm flex items-center gap-1 mb-6 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zum Admin-Panel</Link>

        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>🖼️ Startseiten-Showcase</h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--muted)' }}>
          Diese Bilder rotieren im Hero-Bereich der Startseite. Empfohlenes Format: ca. 4:3, unter 5 MB.
        </p>

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

        <div className="card rounded-2xl p-6">
          <h2 className="font-bold text-sm mb-3" style={{ color: 'var(--foreground)' }}>Aktuelle Bilder ({images.length})</h2>
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
          ) : images.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Bilder hochgeladen.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {images.map(img => (
                <div key={img.id} className="relative rounded-xl overflow-hidden group" style={{ aspectRatio: '4 / 3', background: 'var(--muted-bg)' }}>
                  <img src={img.url} alt={img.caption || ''} className="w-full h-full object-cover" />
                  <button
                    onClick={() => remove(img.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition"
                    style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                  >
                    ✕
                  </button>
                  {img.caption && (
                    <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 text-xs text-white" style={{ background: 'rgba(0,0,0,0.6)' }}>
                      {img.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}