'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Idea = {
  id: string
  title: string
  description: string
  tag: string
  tag_color: string
  status: 'idee' | 'geplant' | 'in_umsetzung' | 'fertig'
  created_at: string
  author_username: string
  claimed_by: string | null
  claimed_by_username: string | null
  source: 'idea' | 'ticket'
  comment_count: string
}

const STATUS_LABELS: Record<string, { label: string, color: string }> = {
  idee: { label: 'Idee', color: '#9CA3AF' },
  geplant: { label: 'Geplant', color: '#EAB308' },
  in_umsetzung: { label: 'In Umsetzung', color: '#7C3AED' },
  fertig: { label: 'Fertig', color: '#22C55E' },
}

// Vorschläge für Tags - frei erweiterbar, das sind nur Anregungen im "Neue Idee"
// Formular, keine feste Enum in der DB (siehe Besprechung: "Beides").
const TAG_SUGGESTIONS = [
  { tag: 'Feature', color: '#7C3AED' },
  { tag: 'Event', color: '#16A34A' },
  { tag: 'UI', color: '#2563EB' },
  { tag: 'Bugfix', color: '#DC2626' },
]

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'gestern'
  if (days < 7) return `vor ${days} Tagen`
  return `vor ${Math.floor(days / 7)} Woche(n)`
}

export default function UpdatesIdeenPage() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)

  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newTag, setNewTag] = useState('Idee')
  const [newTagColor, setNewTagColor] = useState('#9CA3AF')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadIdeas = () => {
    setLoading(true)
    fetch('/api/admin2/ideas')
      .then(r => r.json())
      .then(data => setIdeas(data.ideas || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadIdeas() }, [])

  const createIdea = async () => {
    if (!newTitle.trim() || !newDescription.trim()) {
      setError('Titel und Beschreibung sind erforderlich.')
      return
    }
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin2/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, description: newDescription, tag: newTag, tag_color: newTagColor }),
    })
    if (res.ok) {
      setShowNewForm(false)
      setNewTitle(''); setNewDescription(''); setNewTag('Idee'); setNewTagColor('#9CA3AF')
      loadIdeas()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Fehler beim Erstellen')
    }
    setSaving(false)
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Updates & Ideen</h1>
          <p style={{ color: 'var(--muted)' }}>
            Alle aktuellen Ideen und geplanten Updates an einem Ort.
            {!loading && ideas.length > 0 && ` · ${ideas.length} Idee${ideas.length === 1 ? '' : 'n'}`}
          </p>
        </div>
        <button onClick={() => setShowNewForm(v => !v)}
          className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium flex-shrink-0">
          + Neue Idee
        </button>
      </div>

      {showNewForm && (
        <div className="card rounded-2xl p-6 mb-6">
          <h2 className="font-bold mb-4" style={{ color: 'var(--foreground)' }}>Neue Idee</h2>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Titel"
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-3"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)}
            placeholder="Beschreibung"
            rows={3}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-3 resize-none"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {TAG_SUGGESTIONS.map(s => (
              <button key={s.tag} onClick={() => { setNewTag(s.tag); setNewTagColor(s.color) }}
                className="text-xs px-3 py-1.5 rounded-full transition-all"
                style={newTag === s.tag
                  ? { background: `${s.color}33`, color: s.color, border: `1px solid ${s.color}` }
                  : { background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                {s.tag}
              </button>
            ))}
            <input value={newTag} onChange={e => setNewTag(e.target.value)}
              placeholder="eigener Tag..."
              className="text-xs px-3 py-1.5 rounded-full outline-none"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)', width: 120 }} />
          </div>
          <div className="flex gap-2">
            <button onClick={createIdea} disabled={saving}
              className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Wird erstellt...' : 'Idee erstellen'}
            </button>
            <button onClick={() => setShowNewForm(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium" style={{ color: 'var(--muted)' }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</p>
      ) : ideas.length === 0 ? (
        <div className="card rounded-2xl p-10 text-center">
          <p className="text-3xl mb-3">💡</p>
          <p style={{ color: 'var(--muted)' }}>Noch keine Ideen vorhanden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ideas.map(idea => {
            const statusInfo = STATUS_LABELS[idea.status] || STATUS_LABELS.idee
            const href = idea.source === 'ticket' ? `/admin/support/${idea.id}` : `/admin2/updates-ideen/${idea.id}`
            return (
              <Link key={`${idea.source}-${idea.id}`} href={href}
                className="card rounded-2xl p-6 flex items-start justify-between gap-4 hover:opacity-90 transition-all block">
                <div className="min-w-0">
                  <h3 className="font-bold text-lg mb-1.5" style={{ color: 'var(--foreground)' }}>{idea.title}</h3>
                  <p className="text-sm mb-2 line-clamp-2" style={{ color: 'var(--foreground)', opacity: 0.85 }}>{idea.description}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>
                    {idea.author_username} · {timeAgo(idea.created_at)}
                    {parseInt(idea.comment_count) > 0 && ` · 💬 ${idea.comment_count}`}
                    {idea.claimed_by_username && ` · 🔒 ${idea.claimed_by_username}`}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <span className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: `${idea.tag_color}22`, color: idea.tag_color }}>
                    {idea.tag}
                  </span>
                  <span className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: `${statusInfo.color}22`, color: statusInfo.color }}>
                    {statusInfo.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}