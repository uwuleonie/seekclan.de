'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '../../../lib/auth-context'
import LinkifiedText from '../../../components/LinkifiedText'

type Reaction = { emoji: string, count: number, mine: boolean }
type MessageItem = {
  type: 'message', id: string, content: string, created_at: string,
  user_id: string, username: string, clan_role: string, reactions: Reaction[],
  attachmentUrl: string | null, attachment_name: string | null, attachment_size: number | null
}
type PollOption = { id: string, label: string, count: number, percent: number }
type PollItem = {
  type: 'poll', id: string, title: string, ends_at: string | null, created_at: string,
  username: string, options: PollOption[], totalVotes: number, myVoteOptionId: string | null
}
type FeedItem = MessageItem | PollItem
type Member = { id: string, username: string, clan_role: string, last_seen_at: string | null }
type ConceptOption = { id: string, title: string }

const ROLE_LABELS: Record<string, string> = { owner: 'Owner', administrator: 'Admin', teammitglied: 'Team' }
const QUICK_EMOJIS = ['👍', '❤️', '🔥', '👀', '🎉', '😂']
const CHANNEL_META: Record<string, { title: string, subtitle: string }> = {
  'admin-chat': { title: 'admin-chat', subtitle: 'Nur Administrator & Owner' },
  'team-lounge': { title: 'team-lounge', subtitle: 'Admins & Teammitglieder' },
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
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


export default function TeamChatChannelPage() {
  const params = useParams()
  const channel = params.channel as string
  const { user } = useAuth()

  const [feed, setFeed] = useState<FeedItem[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [showPollForm, setShowPollForm] = useState(false)
  const [showSharePicker, setShowSharePicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMembers = () => {
    fetch(`/api/admin2/team-chat/presence?channel=${channel}`).then(r => r.json()).then(data => setMembers(data.members || []))
  }
  const loadFeed = (scrollDown = false) => {
    fetch(`/api/admin2/team-chat/${channel}/messages`)
      .then(async r => { if (r.status === 403) { setForbidden(true); return null }; return r.json() })
      .then(data => {
        if (!data) return
        setFeed(data.feed || [])
        if (scrollDown) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setForbidden(false)
    loadMembers()
    loadFeed(true)
    const interval = setInterval(() => loadFeed(), 5000)
    return () => clearInterval(interval)
  }, [channel])

  const sendMessage = async () => {
    if (!message.trim() && !pendingFile) return
    setSending(true)
    const formData = new FormData()
    formData.append('content', message)
    if (pendingFile) formData.append('file', pendingFile)
    const res = await fetch(`/api/admin2/team-chat/${channel}/messages`, { method: 'POST', body: formData })
    if (res.ok) {
      setMessage('')
      setPendingFile(null)
      loadFeed(true)
    }
    setSending(false)
  }

  const toggleReaction = async (messageId: string, emoji: string) => {
    await fetch(`/api/admin2/team-chat/${channel}/messages/${messageId}/reactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }),
    })
    loadFeed()
  }
  const vote = async (postId: string, optionId: string) => {
    await fetch(`/api/admin2/board/${postId}/vote`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ optionId }),
    })
    loadFeed()
  }

  const shareConceptIntoChat = async (concept: ConceptOption) => {
    setShowSharePicker(false)
    const shareRes = await fetch(`/api/admin2/concepts/${concept.id}/share`)
    const existing = await shareRes.json()
    let token = existing.share?.token
    if (!token) {
      const created = await fetch(`/api/admin2/concepts/${concept.id}/share`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permission: 'view' }),
      }).then(r => r.json())
      token = created.token
    }
    const url = `${window.location.origin}/konzept/${token}`
    const formData = new FormData()
    formData.append('content', `🔗 Konzept geteilt: ${concept.title} — ${url}`)
    await fetch(`/api/admin2/team-chat/${channel}/messages`, { method: 'POST', body: formData })
    loadFeed(true)
  }

  const meta = CHANNEL_META[channel] || { title: channel, subtitle: '' }

  if (forbidden) return <p className="text-sm p-6" style={{ color: 'var(--muted)' }}>Kein Zugriff auf diesen Kanal.</p>
  if (loading) return <p className="text-sm p-6" style={{ color: 'var(--muted)' }}>Laden...</p>

  return (
    <div className="h-full flex flex-col lg:flex-row" style={{ background: 'var(--background)' }}>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <h1 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
            {channel === 'admin-chat' ? '🔒' : '#'} {meta.title}
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>{meta.subtitle}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 max-w-4xl mx-auto w-full">
          {feed.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Noch keine Nachrichten hier.</p>
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

        <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--card-border)' }}>
          <div className="max-w-4xl mx-auto">
            {pendingFile && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl text-sm mb-2" style={{ background: 'var(--muted-bg)' }}>
                <span style={{ color: 'var(--foreground)' }}>📎 {pendingFile.name}</span>
                <button onClick={() => setPendingFile(null)} style={{ color: '#EF4444' }}>✕</button>
              </div>
            )}
            <div className="flex gap-2 items-center relative">
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setPendingFile(f) }} />
              <button onClick={() => fileInputRef.current?.click()} title="Datei anhängen"
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>📎</button>
              <button onClick={() => setShowPollForm(true)} title="Abstimmung starten"
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>📊</button>
              <button onClick={() => setShowSharePicker(v => !v)} title="Konzept teilen"
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>🔗</button>
              {showSharePicker && <ShareConceptPicker onPick={shareConceptIntoChat} onClose={() => setShowSharePicker(false)} />}
              <input value={message} onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
                placeholder={`Nachricht an #${channel}...`}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
              <button onClick={sendMessage} disabled={sending || (!message.trim() && !pendingFile)}
                className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                Senden
              </button>
            </div>
          </div>
        </div>
      </div>

      <MemberSidebar members={members} />

      {showPollForm && (
        <PollFormModal channel={channel} onClose={() => setShowPollForm(false)}
          onCreated={() => { setShowPollForm(false); loadFeed(true) }} />
      )}
    </div>
  )
}

function MemberSidebar({ members }: { members: Member[] }) {
  const isOnline = (lastSeen: string | null) => !!lastSeen && Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000
  return (
    <div className="w-60 flex-shrink-0 overflow-y-auto p-4 hidden lg:block" style={{ borderLeft: '1px solid var(--card-border)' }}>
      <h2 className="text-xs font-bold mb-3" style={{ color: 'var(--muted)' }}>MITGLIEDER — {members.length}</h2>
      <div className="space-y-2">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isOnline(m.last_seen_at) ? '#22C55E' : 'var(--card-border)' }} />
            <img src={`/api/player-heads/${m.username}/24`} alt="" className="w-6 h-6 rounded-md flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{m.username}</p>
              <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                {isOnline(m.last_seen_at) ? 'online' : m.last_seen_at ? `zuletzt ${timeAgo(m.last_seen_at)}` : 'noch nie online'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShareConceptPicker({ onPick, onClose }: { onPick: (c: ConceptOption) => void, onClose: () => void }) {
  const [concepts, setConcepts] = useState<ConceptOption[]>([])
  useEffect(() => {
    fetch('/api/admin2/concepts').then(r => r.json()).then(data => setConcepts((data.concepts || []).map((c: any) => ({ id: c.id, title: c.title }))))
  }, [])
  return (
    <div className="absolute left-0 bottom-full mb-2 w-64 rounded-xl p-2 shadow-lg z-20 max-h-64 overflow-y-auto"
      style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-xs font-bold" style={{ color: 'var(--muted)' }}>Konzept teilen</span>
        <button onClick={onClose} className="text-xs" style={{ color: 'var(--muted)' }}>✕</button>
      </div>
      {concepts.length === 0 ? (
        <p className="text-xs px-2 py-1" style={{ color: 'var(--muted)' }}>Keine Konzepte vorhanden.</p>
      ) : concepts.map(c => (
        <button key={c.id} onClick={() => onPick(c)}
          className="w-full text-left text-sm px-2 py-1.5 rounded-lg hover:opacity-80 truncate"
          style={{ color: 'var(--foreground)' }}>
          # {c.title}
        </button>
      ))}
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
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>{ROLE_LABELS[msg.clan_role]}</span>
          )}
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{timeAgo(msg.created_at)}</span>
        </div>
        {msg.content && <LinkifiedText text={msg.content} className="text-sm mb-1.5" style={{ color: 'var(--foreground)' }} />}
        {msg.attachmentUrl && (
          <a href={msg.attachmentUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 mb-1.5 max-w-xs hover:opacity-80 transition-all"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
            <span className="text-xl">📄</span>
            <div className="min-w-0">
              <p className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{msg.attachment_name}</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{msg.attachment_size ? formatSize(msg.attachment_size) : ''}</p>
            </div>
          </a>
        )}
        <div className="flex items-center gap-1.5 flex-wrap relative">
          {msg.reactions.map(r => (
            <button key={r.emoji} onClick={() => onReact(r.emoji)}
              className="text-xs px-2 py-0.5 rounded-full"
              style={r.mine ? { background: '#7C3AED22', border: '1px solid #7C3AED' } : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              {r.emoji} {r.count}
            </button>
          ))}
          <button onClick={() => setShowPicker(v => !v)} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted-bg)', color: 'var(--muted)' }}>+</button>
          {showPicker && (
            <div className="absolute left-0 top-full mt-1 flex gap-1 rounded-xl p-1.5 shadow-lg z-20" style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
              {QUICK_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { onReact(emoji); setShowPicker(false) }} className="text-base hover:scale-125 transition-transform px-1">{emoji}</button>
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
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#7C3AED22', color: '#7C3AED' }}>📊 Abstimmung{isEnded ? ' · beendet' : ''}</span>
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

function PollFormModal({ channel, onClose, onCreated }: { channel: string, onClose: () => void, onCreated: () => void }) {
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, options: cleanOptions, endsAt: endsAt || null, channel }),
    })
    setSaving(false)
    if (res.ok) onCreated()
    else { const data = await res.json().catch(() => ({})); setError(data.error || 'Fehler beim Erstellen') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>📊 Abstimmung starten</h2>
          <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>✕</button>
        </div>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Frage, z.B. 'Team-Meeting: Wann passt es euch?'"
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none mb-3"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--muted)' }}>Antwortoptionen</label>
        <div className="space-y-2 mb-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input value={opt} onChange={e => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`}
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
              {options.length > 2 && <button onClick={() => removeOption(i)} className="text-sm px-2" style={{ color: '#EF4444' }}>✕</button>}
            </div>
          ))}
        </div>
        <button onClick={addOption} className="text-xs underline mb-4" style={{ color: 'var(--muted)' }}>+ Option hinzufügen</button>
        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--muted)' }}>Endet am (optional)</label>
        <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-5"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
        <div className="flex gap-2">
          <button onClick={submit} disabled={saving} className="btn-gradient text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex-1">
            {saving ? 'Wird erstellt...' : 'Abstimmung erstellen'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm" style={{ color: 'var(--muted)' }}>Abbrechen</button>
        </div>
      </div>
    </div>
  )
}