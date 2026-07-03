'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

type Ticket = {
  id: number
  category: string
  subject: string
  priority: 'low' | 'normal' | 'high'
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
  creator_username: string
  target_username: string | null
  target_badge_name: string | null
  message_count: string
}

type Message = {
  id: number
  is_staff: boolean
  body: string
  created_at: string
  is_template: boolean
  sender_username: string | null
}

type Template = { label: string, text: string, categories: string[] }
const REPLY_TEMPLATES: Template[] = [
  { label: 'Konzept in Arbeit', text: 'Danke für deinen Vorschlag! Wir haben daraus ein Konzept erstellt und arbeiten bereits daran.', categories: ['suggestion'] },
  { label: 'Wird intern besprochen', text: 'Danke für deinen Vorschlag! Wir besprechen das intern im Team und melden uns, sobald wir eine Entscheidung getroffen haben.', categories: ['suggestion'] },
  { label: 'Umgesetzt', text: 'Dein Vorschlag wurde umgesetzt! Danke für die Idee.', categories: ['suggestion', 'bug'] },
  { label: 'Abgelehnt', text: 'Nach interner Abstimmung setzen wir diesen Vorschlag aktuell leider nicht um. Danke trotzdem fürs Vorschlagen!', categories: ['suggestion'] },
  { label: 'Wird bald behoben', text: 'Danke für die Meldung! Der Bug ist bestätigt und wird zeitnah behoben.', categories: ['bug'] },
  { label: 'Nicht reproduzierbar', text: 'Wir konnten den Fehler auf unserer Seite leider nicht nachstellen. Kannst du uns noch ein paar mehr Details geben (z.B. wann genau es passiert ist, was du gemacht hast)?', categories: ['bug'] },
]

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug', clan_application: 'Bewerbung', complaint: 'Beschwerde', suggestion: 'Vorschlag',
  other: 'Sonstiges', missing_badge: 'Abzeichen', whitelist: 'Whitelist', rollback_request: 'Rollback',
  player_report: 'Meldung', account_link: 'Account',
}
const CATEGORY_COLORS: Record<string, string> = {
  bug: '#EF4444', clan_application: '#22C55E', complaint: '#F59E0B', suggestion: '#3B82F6',
  other: '#6B7280', missing_badge: '#A855F7', whitelist: '#0891B2', rollback_request: '#DC2626',
  player_report: '#DB2777', account_link: '#3B82F6',
}
const STATUS_STYLE = {
  open: { label: 'Offen', color: '#3B82F6', dot: '#EF4444' },
  in_progress: { label: 'In Bearbeitung', color: '#EAB308', dot: '#EAB308' },
  closed: { label: 'Geschlossen', color: '#6B7280', dot: '#6B7280' },
}
const PRIORITY_STYLE = {
  low: { label: 'Niedrig', color: '#6B7280' },
  normal: { label: 'Mittel', color: '#EAB308' },
  high: { label: 'Hoch', color: '#EF4444' },
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

export default function SupportTicketsPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'aktive' | 'offen' | 'in_progress' | 'closed' | 'alle'>('aktive')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const loadTickets = () => {
    fetch('/api/admin2/support-tickets')
      .then(r => r.json())
      .then(data => {
        setTickets(data.tickets || [])
        setLoading(false)
        if (!selectedId && data.tickets?.length > 0) setSelectedId(data.tickets[0].id)
      })
  }

  useEffect(() => {
    loadTickets()
    const interval = setInterval(loadTickets, 15000)
    return () => clearInterval(interval)
  }, [])

  const filtered = tickets.filter(t => {
    if (search.trim() && !t.subject.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter === 'aktive' && t.status === 'closed') return false
    if (statusFilter === 'offen' && t.status !== 'open') return false
    if (statusFilter === 'in_progress' && t.status !== 'in_progress') return false
    if (statusFilter === 'closed' && t.status !== 'closed') return false
    if (categoryFilter && t.category !== categoryFilter) return false
    return true
  })

  const openCount = tickets.filter(t => t.status === 'open').length
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length
  const highPriorityCount = tickets.filter(t => t.priority === 'high' && t.status !== 'closed').length
  const closedCount = tickets.filter(t => t.status === 'closed').length

  const categoriesUsed = [...new Set(tickets.map(t => t.category))]

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Support-Tickets</h1>
      <p className="mb-1" style={{ color: 'var(--muted)' }}>Eingehende Tickets ansehen und beantworten.</p>
      {!canWrite && <p className="text-xs mb-5" style={{ color: '#EAB308' }}>🔒 Nur Lesezugriff — Antworten sind für deine Rolle nicht möglich.</p>}
      {canWrite && <div className="mb-5" />}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard value={openCount} label="Offen" color="#3B82F6" />
        <StatCard value={inProgressCount} label="In Bearbeitung" color="#EAB308" />
        <StatCard value={highPriorityCount} label="Hohe Priorität" color="#EF4444" />
        <StatCard value={closedCount} label="Geschlossen" color="var(--muted)" />
      </div>

      <div className="grid grid-cols-[1fr_1.4fr] gap-6" style={{ height: 'calc(100vh - 320px)', minHeight: 500 }}>
        <div className="flex flex-col min-h-0">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tickets durchsuchen ..."
            className="rounded-xl px-4 py-2.5 text-sm outline-none mb-3"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />

          <div className="flex gap-1.5 mb-2 flex-wrap">
            {(['aktive', 'offen', 'in_progress', 'closed', 'alle'] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={statusFilter === f
                  ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }
                  : { color: 'var(--muted)' }}>
                {f === 'aktive' ? 'Aktive' : f === 'offen' ? 'Offen' : f === 'in_progress' ? 'In Bearbeitung' : f === 'closed' ? 'Geschlossen' : 'Alle'}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 mb-4 flex-wrap">
            <button onClick={() => setCategoryFilter(null)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={!categoryFilter
                ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }
                : { color: 'var(--muted)' }}>
              Alle Kategorien
            </button>
            {categoriesUsed.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={categoryFilter === cat
                  ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }
                  : { color: 'var(--muted)' }}>
                {CATEGORY_LABELS[cat] || cat}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto card rounded-2xl">
            {loading ? (
              <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Keine Tickets gefunden.</p>
            ) : filtered.map(t => {
              const s = STATUS_STYLE[t.status]
              const catColor = CATEGORY_COLORS[t.category] || '#6B7280'
              return (
                <button key={t.id} onClick={() => setSelectedId(t.id)}
                  className="w-full text-left px-4 py-3.5 flex items-start gap-2.5"
                  style={{
                    borderBottom: '1px solid var(--card-border)',
                    background: selectedId === t.id ? 'var(--muted-bg)' : 'transparent',
                  }}>
                  <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium text-sm truncate" style={{ color: 'var(--foreground)' }}>{t.subject}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${s.color}22`, color: s.color }}>
                        {s.label.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: catColor }}>{CATEGORY_LABELS[t.category] || t.category}</span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{t.creator_username} · #{t.id}</span>
                    </div>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{timeAgo(t.created_at)}</span>
                </button>
              )
            })}
          </div>
        </div>

        {selectedId ? (
          <TicketDetail ticketId={selectedId} canWrite={canWrite} onChanged={loadTickets} />
        ) : (
          <div className="card rounded-2xl flex items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Kein Ticket ausgewählt.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ value, label, color }: { value: number, label: string, color: string }) {
  return (
    <div className="card rounded-2xl p-5">
      <p className="text-3xl font-bold mb-1" style={{ color }}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</p>
    </div>
  )
}

function TicketDetail({ ticketId, canWrite, onChanged }: { ticketId: number, canWrite: boolean, onChanged: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [showTemplates, setShowTemplates] = useState(false)
  const [participantInput, setParticipantInput] = useState('')
  const [participantMsg, setParticipantMsg] = useState('')

  const addParticipant = async () => {
    if (!participantInput.trim()) return
    setParticipantMsg('')
    const res = await fetch(`/api/admin2/support-tickets/${ticketId}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: participantInput.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setParticipantMsg(`✓ ${data.username} hinzugefügt`)
      setParticipantInput('')
    } else {
      setParticipantMsg(data.error || 'Fehler')
    }
  }
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = () => {
    fetch(`/api/admin2/support-tickets/${ticketId}`)
      .then(r => r.json())
      .then(data => {
        setTicket(data.ticket || null)
        setMessages(data.messages || [])
        if (data.ticket) setPriority(data.ticket.priority)
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [ticketId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const relevantTemplates = REPLY_TEMPLATES.filter(t => t.categories.includes(ticket?.category || ''))

  const [usedTemplate, setUsedTemplate] = useState(false)

  const send = async () => {
    if (!reply.trim()) return
    setSending(true)
    await fetch(`/api/admin2/support-tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: reply.trim(), is_template: usedTemplate }),
    })
    setReply('')
    setUsedTemplate(false)
    setSending(false)
    load()
    onChanged()
  }

  const setPriorityValue = async (p: 'low' | 'normal' | 'high') => {
    setPriority(p)
    await fetch(`/api/admin2/support-tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: p }),
    })
    onChanged()
  }

  const closeTicket = async () => {
    await fetch(`/api/admin2/support-tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    })
    load()
    onChanged()
  }

  if (loading || !ticket) {
    return <div className="card rounded-2xl flex items-center justify-center"><p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p></div>
  }

  const s = STATUS_STYLE[ticket.status]

  return (
    <div className="card rounded-2xl flex flex-col min-h-0">
      <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.dot }} />
            <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>{ticket.subject}</h2>
          </div>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>#{ticket.id}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
            {ticket.creator_username.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm" style={{ color: 'var(--muted)' }}>{ticket.creator_username} · geöffnet {timeAgo(ticket.created_at)}</span>
          <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ background: CATEGORY_COLORS[ticket.category] || '#6B7280' }}>
            {CATEGORY_LABELS[ticket.category] || ticket.category}
          </span>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2">
            <input value={participantInput} onChange={e => setParticipantInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addParticipant() }}
              placeholder="Spieler zum Ticket hinzufügen ..."
              className="flex-1 rounded-lg px-3 py-1.5 text-xs outline-none"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <button onClick={addParticipant} disabled={!participantInput.trim()}
              className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
              style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
              Hinzufügen
            </button>
          </div>
        )}
        {participantMsg && <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>{participantMsg}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Noch keine Nachrichten.</p>
        ) : messages.map(m => (
          <div key={m.id}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
              {m.is_staff ? `🛡️ ${m.sender_username}` : m.sender_username} · {new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              {m.is_template && ' · 🤖 Automatische Antwort'}
            </p>
            <div className="rounded-xl px-4 py-3 max-w-[85%]"
              style={m.is_staff ? { background: '#16A34A22', color: 'var(--foreground)' } : { background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
              <p className="text-sm whitespace-pre-wrap">{m.body}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {canWrite && ticket.status !== 'closed' && (
        <div className="p-4 flex-shrink-0 relative" style={{ borderTop: '1px solid var(--card-border)' }}>
          <div className="relative mb-3">
            <textarea value={reply} onChange={e => { setReply(e.target.value); setUsedTemplate(false) }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={`Antwort an ${ticket.creator_username} schreiben ...`}
              rows={2}
              className="w-full rounded-xl pl-11 pr-4 py-2.5 text-sm outline-none resize-none"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <button onClick={() => setShowTemplates(v => !v)}
              title="Vorgefertigte Antwort einfügen"
              className="absolute left-2.5 top-2.5 w-6 h-6 flex items-center justify-center rounded-lg text-sm hover:opacity-70 transition-all"
              style={{ color: 'var(--muted)' }}>
              📋
            </button>
            {showTemplates && (
              <div className="absolute left-2 bottom-full mb-2 w-72 rounded-xl p-1.5 shadow-lg z-20"
                style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
                {relevantTemplates.map(t => (
                  <button key={t.label} onClick={() => { setReply(t.text); setUsedTemplate(true); setShowTemplates(false) }}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs hover:opacity-80 transition-all"
                    style={{ color: 'var(--foreground)' }}>
                    <span className="font-medium block mb-0.5">{t.label}</span>
                    <span style={{ color: 'var(--muted)' }} className="line-clamp-1">{t.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs mr-1" style={{ color: 'var(--muted)' }}>Priorität</span>
              {(['low', 'normal', 'high'] as const).map(p => (
                <button key={p} onClick={() => setPriorityValue(p)}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all whitespace-nowrap"
                  style={priority === p
                    ? { background: `${PRIORITY_STYLE[p].color}22`, color: PRIORITY_STYLE[p].color, border: `1px solid ${PRIORITY_STYLE[p].color}` }
                    : { background: 'var(--muted-bg)', color: 'var(--muted)' }}>
                  {PRIORITY_STYLE[p].label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={closeTicket} className="px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
                Ticket schließen
              </button>
              <button onClick={send} disabled={sending || !reply.trim()} className="btn-gradient text-white px-4 py-2 rounded-xl text-xs font-medium disabled:opacity-50 whitespace-nowrap">
                Antworten
              </button>
            </div>
          </div>
        </div>
      )}

      {ticket.status === 'closed' && (
        <div className="p-4 flex-shrink-0 text-center" style={{ borderTop: '1px solid var(--card-border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Dieses Ticket ist geschlossen.</p>
        </div>
      )}
    </div>
  )
  
}