'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../lib/auth-context'
import LinkifiedText from '../../../components/LinkifiedText'

type Comment = {
  id: string
  content: string
  created_at: string
  author_username: string
}

type IdeaDetail = {
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
  comments: Comment[]
}

const STATUS_LABELS: Record<string, { label: string, color: string }> = {
  idee: { label: 'Idee', color: '#9CA3AF' },
  geplant: { label: 'Geplant', color: '#EAB308' },
  in_umsetzung: { label: 'In Umsetzung', color: '#7C3AED' },
  fertig: { label: 'Fertig', color: '#22C55E' },
}
const STATUS_ORDER = ['idee', 'geplant', 'in_umsetzung', 'fertig'] as const

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function IdeaDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const ideaId = params.ideaId as string

  const [idea, setIdea] = useState<IdeaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  const loadIdea = () => {
    setLoading(true)
    fetch(`/api/admin2/ideas/${ideaId}`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then(data => {
        if (data?.idea) {
          setIdea(data.idea)
          setEditTitle(data.idea.title)
          setEditDescription(data.idea.description)
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadIdea() }, [ideaId])

  const saveEdit = async () => {
    setSaving(true)
    const res = await fetch(`/api/admin2/ideas/${ideaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, description: editDescription }),
    })
    if (res.ok) {
      setEditing(false)
      loadIdea()
    }
    setSaving(false)
  }

  const changeStatus = async (status: string) => {
    await fetch(`/api/admin2/ideas/${ideaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadIdea()
  }

  const toggleClaim = async () => {
    const isClaimedByMe = idea?.claimed_by === user?.id
    await fetch(`/api/admin2/ideas/${ideaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isClaimedByMe ? { unclaim: true } : { claim: true }),
    })
    loadIdea()
  }

  const deleteIdea = async () => {
    if (!confirm('Diese Idee wirklich löschen?')) return
    const res = await fetch(`/api/admin2/ideas/${ideaId}`, { method: 'DELETE' })
    if (res.ok) router.push('/admin2/updates-ideen')
  }

  const postComment = async () => {
    if (!newComment.trim()) return
    setPostingComment(true)
    const res = await fetch(`/api/admin2/ideas/${ideaId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment }),
    })
    if (res.ok) {
      setNewComment('')
      loadIdea()
    }
    setPostingComment(false)
  }

  if (loading) return <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
  if (notFound || !idea) {
    return (
      <div>
        <p style={{ color: 'var(--muted)' }}>Diese Idee wurde nicht gefunden.</p>
        <Link href="/admin2/updates-ideen" className="text-sm underline mt-2 inline-block" style={{ color: 'var(--muted)' }}>← Zurück zur Übersicht</Link>
      </div>
    )
  }

  const statusInfo = STATUS_LABELS[idea.status] || STATUS_LABELS.idee
  const isClaimedByMe = idea.claimed_by === user?.id
  const isClaimedByOther = idea.claimed_by && idea.claimed_by !== user?.id

  return (
    <div className="max-w-3xl">
      <Link href="/admin2/updates-ideen" className="text-sm inline-flex items-center gap-1 mb-6 hover:opacity-70 transition-all" style={{ color: 'var(--muted)' }}>
        ← Zurück zur Übersicht
      </Link>

      <div className="card rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: `${idea.tag_color}22`, color: idea.tag_color }}>
              {idea.tag}
            </span>
            <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: `${statusInfo.color}22`, color: statusInfo.color }}>
              {statusInfo.label}
            </span>
            {isClaimedByOther && (
              <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                🔒 Geclaimt von {idea.claimed_by_username}
              </span>
            )}
          </div>
          <button onClick={toggleClaim}
            className="text-xs px-4 py-2 rounded-xl font-medium flex-shrink-0 transition-all"
            style={isClaimedByMe
              ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }
              : { background: 'linear-gradient(135deg, #7C3AED, #C026D3)', color: 'white' }}>
            {isClaimedByMe ? 'Freigeben' : idea.claimed_by ? 'Trotzdem claimen' : 'Claimen'}
          </button>
        </div>

        {editing ? (
          <>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              className="w-full text-2xl font-bold rounded-xl px-3 py-2 outline-none mb-3"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)}
              rows={5}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-3 resize-none"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving}
                className="btn-gradient text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Speichert...' : 'Speichern'}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>
                Abbrechen
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--foreground)' }}>{idea.title}</h1>
            <LinkifiedText text={idea.description} className="text-sm whitespace-pre-wrap mb-4" style={{ color: 'var(--foreground)', opacity: 0.9 }} />
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Erstellt von {idea.author_username} · {formatDateTime(idea.created_at)}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setEditing(true)} className="text-xs underline" style={{ color: 'var(--muted)' }}>Bearbeiten</button>
                <button onClick={deleteIdea} className="text-xs underline" style={{ color: '#EF4444' }}>Löschen</button>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-1.5 mt-5 pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
          {STATUS_ORDER.map(s => (
            <button key={s} onClick={() => changeStatus(s)}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
              style={idea.status === s
                ? { background: `${STATUS_LABELS[s].color}22`, color: STATUS_LABELS[s].color, border: `1px solid ${STATUS_LABELS[s].color}` }
                : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
              {STATUS_LABELS[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="card rounded-2xl p-6">
        <h2 className="font-bold mb-4" style={{ color: 'var(--foreground)' }}>
          Kommentare {idea.comments.length > 0 && `(${idea.comments.length})`}
        </h2>

        {idea.comments.length === 0 ? (
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Noch keine Kommentare.</p>
        ) : (
          <div className="space-y-4 mb-5">
            {idea.comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                  {c.author_username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>{c.author_username} · {formatDateTime(c.created_at)}</p>
                  <LinkifiedText text={c.content} className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input value={newComment} onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') postComment() }}
            placeholder="Kommentar schreiben..."
            className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          <button onClick={postComment} disabled={postingComment || !newComment.trim()}
            className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            Senden
          </button>
        </div>
      </div>
    </div>
  )
}