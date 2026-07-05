'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../../lib/auth-context'

type Concept = {
  id: string, title: string, ownerUsername: string | null, isTextOnly: boolean,
  isFinished: boolean, progress: number, tags: { id: string, name: string, color: string }[]
}
type Reaction = { emoji: string, count: number, mine: boolean }
type MessageItem = {
  type: 'message', id: string, content: string, created_at: string,
  user_id: string, username: string, clan_role: string, reactions: Reaction[]
}
type PollOption = { id: string, label: string, count: number, percent: number }
type PollItem = {
  type: 'poll', id: string, title: string, ends_at: string | null, created_at: string,
  username: string, options: PollOption[], totalVotes: number, myVoteOptionId: string | null
}
type FeedItem = MessageItem | PollItem

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', administrator: 'Admin', teammitglied: 'Team',
}
const QUICK_EMOJIS = ['👍', '❤️', '🔥', '👀', '🎉', '😂']

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

export default function ConceptChatPage() {
  const params = useParams()
  const conceptId = params.conceptId as string
  const { user } = useAuth()

  const [concept, setConcept] = useState<Concept | null>(null)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showPollForm, setShowPollForm] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadConcept = () => {
    fetch(`/api/admin2/concepts/${conceptId}`)
      .then(r => r.json())
      .then(data => setConcept(data.concept || null))
  }

  const loadFeed = (scrollDown = false) => {
    fetch(`/api/admin2/concepts/${conceptId}/messages`)
      .then(r => r.json())
      .then(data => {
        setFeed(data.feed || [])
        if (scrollDown) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadConcept()
    loadFeed(true)
    // Polling statt echtem Realtime-Server (gibt's aktuell nicht) - alle 5
    // Sekunden neu abfragen, genau wie beim Ingame-Chat-System des Plugins.
    const interval = setInterval(() => loadFeed(), 5000)
    return () => clearInterval(interval)
  }, [conceptId])

  const sendMessage = async () => {
    if (!message.trim()) return
    setSending(true)
    const res = await fetch(`/api/admin2/concepts/${conceptId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    })
    if (res.ok) {
      setMessage('')
      loadFeed(true)
    }
    setSending(false)
  }

  const toggleReaction = async (messageId: string, emoji: string) => {
    await fetch(`/api/admin2/concepts/${conceptId}/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    })
    loadFeed()
  }

  const vote = async (postId: string, optionId: string) => {
    await fetch(`/api/admin2/board/${postId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId }),
    })
    loadFeed()
  }

  if (loading) return <p className="text-sm p-6" style={{ color: 'var(--muted)' }}>Laden...</p>
  if (!concept) return <p className="text-sm p-6" style={{ color: 'var(--muted)' }}>Konzept nicht gefunden.</p>

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Konzept-Kopfzeile */}
      <div className="px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <Link href="/admin2/update-konzepte" className="text-sm hover:opacity-70 transition-all inline-block mb-2" style={{ color: 'var(--muted)' }}>
          ← Zurück zu allen Konzepten
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>{concept.title}</h1>
            {concept.tags.map(tag => (
              <span key={tag.id} className="text-xs px-2.5 py-1 rounded-full"
                style={{ background: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}55` }}>
                {tag.name}
              </span>
            ))}
            {concept.ownerUsername && (
              <span className="text-xs" style={{ color: 'var(--muted)' }}>von {concept.ownerUsername}</span>
            )}
            {concept.isFinished && (
              <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#A855F722', color: '#A855F7' }}>✅ Fertig</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!concept.isTextOnly && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                  <div className="h-full rounded-full" style={{ width: `${concept.progress}%`, background: 'linear-gradient(90deg, #7C3AED, #C026D3)' }} />
                </div>
                {concept.progress}%
              </div>
            )}
            <Link href={`/admin2/update-konzepte/${conceptId}`}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
              📐 Konzept öffnen
            </Link>
            <button onClick={() => setShowPollForm(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
              📊 Abstimmung starten
            </button>
          </div>
        </div>
      </div>

      {/* Nachrichtenverlauf */}
      <div className="flex-1 overflow-y-auto px-6 py-4 max-w-4xl mx-auto w-full">
        {feed.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>
            Noch keine Nachrichten — leg los mit der Diskussion zu diesem Konzept.
          </p>
        ) : (
          <div className="space-y-4">
            {feed.map(item => item.type === 'poll'
              ? <PollBubble key={`poll-${item.id}`} poll={item} onVote={optionId => vote(item.id, optionId)} />
              : <MessageBubble key={`msg-${item.id}`} msg={item} isMine={item.user_id === user?.id}
                  onReact={emoji => toggleReaction(item.id, emoji)} />
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--card-border)' }}>
        <div className="max-w-4xl mx-auto flex gap-2">
          <input value={message} onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
            placeholder={`Nachricht zu "${concept.title}"...`}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          <button onClick={sendMessage} disabled={sending || !message.trim()}
            className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            Senden
          </button>
        </div>
      </div>

      {showPollForm && (
        <PollFormModal conceptId={conceptId} onClose={() => setShowPollForm(false)}
          onCreated={() => { setShowPollForm(false); loadFeed(true) }} />
      )}
    </div>
  )
}

function MessageBubble({ msg, isMine, onReact }: { msg: MessageItem, isMine: boolean, onReact: (emoji: string) => void }) {
  const [showPicker, setShowPicker] = useState(false)
  const initials = msg.username.slice(0, 2).toUpperCase()

  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: isMine ? '#7C3AED33' : 'var(--muted-bg)', color: isMine ? '#7C3AED' : 'var(--foreground)' }}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{msg.username}</span>
          {ROLE_LABELS[msg.clan_role] && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
              {ROLE_LABELS[msg.clan_role]}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{timeAgo(msg.created_at)}</span>
        </div>
        <p className="text-sm mb-1.5" style={{ color: 'var(--foreground)' }}>{msg.content}</p>
        <div className="flex items-center gap-1.5 flex-wrap relative">
          {msg.reactions.map(r => (
            <button key={r.emoji} onClick={() => onReact(r.emoji)}
              className="text-xs px-2 py-0.5 rounded-full"
              style={r.mine
                ? { background: '#7C3AED22', border: '1px solid #7C3AED' }
                : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              {r.emoji} {r.count}
            </button>
          ))}
          <button onClick={() => setShowPicker(v => !v)}
            className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>
            +
          </button>
          {showPicker && (
            <div className="absolute left-0 top-full mt-1 flex gap-1 rounded-xl p-1.5 shadow-lg z-20"
              style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
              {QUICK_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { onReact(emoji); setShowPicker(false) }}
                  className="text-base hover:scale-125 transition-transform px-1">
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PollBubble({ poll, onVote }: { poll: PollItem, onVote: (optionId: string) => void }) {
  const isEnded = poll.ends_at ? new Date(poll.ends_at) < new Date() : false
  return (
    <div className="rounded-2xl p-4 max-w-md" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#7C3AED22', color: '#7C3AED' }}>
          📊 Abstimmung{isEnded ? ' · beendet' : ''}
        </span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{poll.username} · {timeAgo(poll.created_at)}</span>
      </div>
      <p className="font-bold text-sm mb-3" style={{ color: 'var(--foreground)' }}>{poll.title}</p>
      <div className="space-y-1.5 mb-2">
        {poll.options.map(opt => {
          const mine = poll.myVoteOptionId === opt.id
          return (
            <button key={opt.id} onClick={() => !isEnded && onVote(opt.id)} disabled={isEnded}
              className="w-full text-left relative rounded-lg overflow-hidden px-3 py-1.5 text-sm disabled:cursor-default"
              style={{ background: 'var(--background)', border: mine ? '1px solid #7C3AED' : '1px solid var(--card-border)' }}>
              <div className="absolute inset-y-0 left-0 opacity-20" style={{ width: `${opt.percent}%`, background: '#7C3AED' }} />
              <div className="relative flex items-center justify-between">
                <span style={{ color: 'var(--foreground)' }}>{mine ? '✓ ' : ''}{opt.label}</span>
                <span style={{ color: '#7C3AED' }}>{opt.percent}%</span>
              </div>
            </button>
          )
        })}
      </div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{poll.totalVotes} Stimme{poll.totalVotes === 1 ? '' : 'n'}</p>
    </div>
  )
}

function PollFormModal({ conceptId, onClose, onCreated }: { conceptId: string, onClose: () => void, onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [endsAt, setEndsAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateOption = (i: number, value: string) => setOptions(prev => prev.map((o, idx) => idx === i ? value : o))
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
      body: JSON.stringify({ title, options: cleanOptions, endsAt: endsAt || null, conceptId }),
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
          placeholder="Frage, z.B. 'Icon-Set A oder B?'"
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
          className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-5"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />

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