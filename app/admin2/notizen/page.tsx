'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import LinkifiedText from '../../components/LinkifiedText'

type PollOption = { id: string, label: string, count: number, percent: number }
type Post = {
  id: string
  type: 'note' | 'poll'
  category: string | null
  title: string
  content: string | null
  ends_at: string | null
  is_pinned: boolean
  created_at: string
  created_by: string
  created_by_username: string
  pinned_by: string | null
  pinned_by_username: string | null
  options: PollOption[] | null
  totalVotes: number | null
  myVoteOptionId: string | null
}

const CATEGORY_STYLE: Record<string, { label: string, color: string }> = {
  wichtig: { label: 'Wichtig', color: '#EF4444' },
  todo: { label: 'To-Do', color: '#EAB308' },
  idee: { label: 'Idee', color: '#7C3AED' },
  event: { label: 'Event', color: '#16A34A' },
  info: { label: 'Info', color: '#2563EB' },
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'gestern'
  return `vor ${days} Tagen`
}


export default function SchwarzesBrettPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showPollForm, setShowPollForm] = useState(false)

  // Kurz-Formular für neue Notizen
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('info')
  const [pinOnCreate, setPinOnCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetch('/api/admin2/board')
      .then(r => r.json())
      .then(data => setPosts(data.posts || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const createNote = async () => {
    if (!title.trim()) return
    setSaving(true)
    const res = await fetch('/api/admin2/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, category, pinned: pinOnCreate }),
    })
    if (res.ok) {
      setTitle('')
      setContent('')
      setPinOnCreate(false)
      load()
    }
    setSaving(false)
  }

  const togglePin = async (post: Post) => {
    await fetch(`/api/admin2/board/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPinned: !post.is_pinned }),
    })
    load()
  }

  const deletePost = async (postId: string) => {
    if (!confirm('Diesen Post wirklich löschen?')) return
    await fetch(`/api/admin2/board/${postId}`, { method: 'DELETE' })
    load()
  }

  const vote = async (postId: string, optionId: string) => {
    await fetch(`/api/admin2/board/${postId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId }),
    })
    load()
  }

  const pinnedPosts = posts.filter(p => p.is_pinned)
  const canDelete = (post: Post) => post.created_by === user?.id || user?.clan_role === 'administrator' || user?.clan_role === 'owner'

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>📌 Schwarzes Brett</h1>
          <p style={{ color: 'var(--muted)' }}>Notizen & Ankündigungen fürs Team — jeder kann anpinnen.</p>
        </div>
        <button onClick={() => setShowPollForm(true)}
          className="px-5 py-2.5 rounded-xl text-sm font-medium flex-shrink-0"
          style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
          📊 Abstimmung starten
        </button>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {/* Kurz-Formular für neue Notizen */}
          <div className="card rounded-2xl p-5 mb-6">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.entries(CATEGORY_STYLE).map(([key, style]) => (
                <button key={key} onClick={() => setCategory(key)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                  style={category === key
                    ? { background: style.color, color: '#fff' }
                    : { background: `${style.color}22`, color: style.color, border: `1px solid ${style.color}55` }}>
                  {style.label}
                </button>
              ))}
            </div>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Titel der Notiz..."
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-2"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="Beschreibung (optional)..."
              rows={2}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-3 resize-none"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                <input type="checkbox" checked={pinOnCreate} onChange={e => setPinOnCreate(e.target.checked)} />
                📌 Direkt anpinnen
              </label>
              <button onClick={createNote} disabled={saving || !title.trim()}
                className="btn-gradient text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? '...' : 'Posten'}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</p>
          ) : posts.length === 0 ? (
            <div className="card rounded-2xl p-10 text-center">
              <p className="text-3xl mb-3">📌</p>
              <p style={{ color: 'var(--muted)' }}>Noch keine Notizen vorhanden.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {posts.map(post => (
                <PostCard key={post.id} post={post} canDelete={canDelete(post)}
                  onTogglePin={() => togglePin(post)} onDelete={() => deletePost(post.id)}
                  onVote={optionId => vote(post.id, optionId)} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: angepinnte Posts */}
        <div className="w-72 flex-shrink-0 hidden lg:block">
          <div className="card rounded-2xl p-4 sticky top-4">
            <h2 className="text-xs font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
              📌 ANGEPINNT
            </h2>
            {pinnedPosts.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Noch nichts angepinnt.</p>
            ) : (
              <div className="space-y-2">
                {pinnedPosts.map(post => (
                  <div key={post.id} className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{post.title}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {post.created_by_username} · {timeAgo(post.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPollForm && (
        <PollFormModal onClose={() => setShowPollForm(false)} onCreated={() => { setShowPollForm(false); load() }} />
      )}
    </div>
  )
}

function PostCard({ post, canDelete, onTogglePin, onDelete, onVote }: {
  post: Post, canDelete: boolean, onTogglePin: () => void, onDelete: () => void, onVote: (optionId: string) => void
}) {
  const isPollEnded = post.ends_at ? new Date(post.ends_at) < new Date() : false

  if (post.type === 'poll') {
    return (
      <div className="card rounded-2xl p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: '#7C3AED22', color: '#7C3AED' }}>
            📊 Abstimmung{isPollEnded ? ' · beendet' : ''}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onTogglePin} title={post.is_pinned ? 'Lösen' : 'Anpinnen'}
              className="text-sm" style={{ color: post.is_pinned ? '#7C3AED' : 'var(--muted)' }}>📌</button>
            {canDelete && <button onClick={onDelete} className="text-sm" style={{ color: '#EF4444' }}>✕</button>}
          </div>
        </div>
        <h3 className="font-bold mb-3" style={{ color: 'var(--foreground)' }}>{post.title}</h3>
        <div className="space-y-2 mb-3">
          {(post.options || []).map(opt => {
            const mine = post.myVoteOptionId === opt.id
            return (
              <button key={opt.id} onClick={() => !isPollEnded && onVote(opt.id)} disabled={isPollEnded}
                className="w-full text-left relative rounded-xl overflow-hidden px-3 py-2 text-sm transition-all disabled:cursor-default"
                style={{ background: 'var(--muted-bg)', border: mine ? '1px solid #7C3AED' : '1px solid var(--card-border)' }}>
                <div className="absolute inset-y-0 left-0 opacity-20" style={{ width: `${opt.percent}%`, background: '#7C3AED' }} />
                <div className="relative flex items-center justify-between">
                  <span style={{ color: 'var(--foreground)' }}>{mine ? '✓ ' : ''}{opt.label}</span>
                  <span style={{ color: '#7C3AED' }}>{opt.percent}%</span>
                </div>
              </button>
            )
          })}
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {post.totalVotes} Stimme{post.totalVotes === 1 ? '' : 'n'} · {post.created_by_username} · {timeAgo(post.created_at)}
          {post.ends_at && !isPollEnded && ` · endet ${new Date(post.ends_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
        </p>
      </div>
    )
  }

  const style = CATEGORY_STYLE[post.category || 'info'] || CATEGORY_STYLE.info
  return (
    <div className="card rounded-2xl overflow-hidden">
      <div className="h-1" style={{ background: style.color }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${style.color}22`, color: style.color }}>
            {style.label}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onTogglePin} title={post.is_pinned ? 'Lösen' : 'Anpinnen'}
              className="text-sm" style={{ color: post.is_pinned ? style.color : 'var(--muted)' }}>📌</button>
            {canDelete && <button onClick={onDelete} className="text-sm" style={{ color: '#EF4444' }}>✕</button>}
          </div>
        </div>
        <h3 className="font-bold mb-1.5" style={{ color: 'var(--foreground)' }}>{post.title}</h3>
        {post.content && <LinkifiedText text={post.content} className="text-sm mb-3" style={{ color: 'var(--muted)' }} />}
        <p className="text-xs" style={{ color: 'var(--muted)' }}>{post.created_by_username} · {timeAgo(post.created_at)}</p>
      </div>
    </div>
  )
}

function PollFormModal({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [endsAt, setEndsAt] = useState('')
  const [pinned, setPinned] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateOption = (i: number, value: string) => {
    setOptions(prev => prev.map((o, idx) => idx === i ? value : o))
  }
  const addOption = () => setOptions(prev => [...prev, ''])
  const removeOption = (i: number) => setOptions(prev => prev.filter((_, idx) => idx !== i))

  const submit = async () => {
    setError('')
    const cleanOptions = options.map(o => o.trim()).filter(Boolean)
    if (!title.trim()) { setError('Frage erforderlich'); return }
    if (cleanOptions.length < 2) { setError('Mindestens 2 Antwortoptionen'); return }

    setSaving(true)
    const res = await fetch('/api/admin2/board/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, options: cleanOptions, endsAt: endsAt || null, pinned }),
    })
    setSaving(false)
    if (res.ok) {
      onCreated()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Fehler beim Erstellen')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>📊 Abstimmung starten</h2>
          <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>✕</button>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Frage, z.B. 'Team-Meeting: Wann passt es euch?'"
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-3"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />

        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--muted)' }}>Antwortoptionen</label>
        <div className="space-y-2 mb-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input value={opt} onChange={e => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
              {options.length > 2 && (
                <button onClick={() => removeOption(i)} className="text-sm px-2" style={{ color: '#EF4444' }}>✕</button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addOption} className="text-xs underline mb-4" style={{ color: 'var(--muted)' }}>+ Option hinzufügen</button>

        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--muted)' }}>Endet am (optional)</label>
        <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-4"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />

        <label className="flex items-center gap-2 cursor-pointer text-sm mb-5" style={{ color: 'var(--foreground)' }}>
          <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
          📌 Direkt anpinnen
        </label>

        <div className="flex gap-2">
          <button onClick={submit} disabled={saving}
            className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex-1">
            {saving ? 'Wird erstellt...' : 'Abstimmung erstellen'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}