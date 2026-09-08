'use client'

import React, { useState, useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

// ─── Types ────────────────────────────────────────────────────────────────────

type Ticket = {
  id: number
  category: string
  subject: string
  priority: 'low' | 'normal' | 'high'
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
  updated_at: string
}

type Message = {
  id: number
  sender_id: string
  is_staff: boolean
  body: string
  created_at: string
  sender: { username: string } | null
}

type ServerStatus = { online: boolean; players: number; maxPlayers: number }
type PlayerOption = { uuid: string; player_name: string }
type ActiveView = 'new' | 'faq' | number | null

// ─── Daten ────────────────────────────────────────────────────────────────────

const CATS = [
  { key: 'bug',              label: 'Bug-Report',          color: '#f87171', desc: 'Fehler im Spiel oder auf der Website',  needsTarget: false },
  { key: 'clan_application', label: 'Clan-Bewerbung',      color: '#4ade80', desc: 'Bewirb dich als Clan-Mitglied',          needsTarget: false },
  { key: 'complaint',        label: 'Beschwerde',          color: '#fb923c', desc: 'Probleme mit anderen Spielern',          needsTarget: true  },
  { key: 'suggestion',       label: 'Vorschlag',           color: '#60a5fa', desc: 'Ideen und Verbesserungsvorschläge',       needsTarget: false },
  { key: 'missing_badge',    label: 'Abzeichen fehlt',     color: '#c084fc', desc: 'Du hast ein Abzeichen nicht erhalten',   needsTarget: false },
  { key: 'whitelist',        label: 'Whitelist-Problem',   color: '#38bdf8', desc: 'Kein Zugang zum Server',                needsTarget: false },
  { key: 'rollback_request', label: 'Rollback-Anfrage',    color: '#f472b6', desc: 'Inventar oder Claim wiederherstellen',   needsTarget: false },
  { key: 'player_report',    label: 'Spieler melden',      color: '#fb7185', desc: 'Regelverstoß eines Spielers melden',    needsTarget: true  },
  { key: 'account_link',     label: 'Account-Verknüpfung', color: '#a78bfa', desc: 'Minecraft/Discord-Account verknüpfen',  needsTarget: false },
  { key: 'other',            label: 'Sonstiges',           color: '#94a3b8', desc: 'Alles andere',                          needsTarget: false },
]

const STATUS = {
  open:        { label: 'Offen',          dot: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  text: '#fbbf24' },
  in_progress: { label: 'In Bearbeitung', dot: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  text: '#60a5fa' },
  closed:      { label: 'Geschlossen',    dot: '#6b7280', bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
}

const PRIORITY = {
  low:    { label: 'Niedrig', color: '#6b7280' },
  normal: { label: 'Normal',  color: '#60a5fa' },
  high:   { label: 'Hoch',    color: '#f87171' },
}

const FAQ = [
  { q: 'Wie lange dauert eine Antwort?',                     a: 'Wir antworten normalerweise innerhalb von 24–48 Stunden. Bei hohem Aufkommen kann es etwas länger dauern.' },
  { q: 'Wie bewerbe ich mich für den Clan?',                 a: 'Erstelle ein Ticket mit der Kategorie „Clan-Bewerbung". Schreib kurz wer du bist, wie lange du schon Minecraft spielst und warum du beitreten möchtest.' },
  { q: 'Inventar oder Claims beschädigt — was tun?',         a: 'Erstelle eine Rollback-Anfrage und beschreibe möglichst genau, wann und wo der Schaden entstanden ist.' },
  { q: 'Kann ich mehrere Tickets gleichzeitig offen haben?', a: 'Ja. Erstelle für jedes Anliegen ein eigenes Ticket, damit wir gezielt antworten können.' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'gerade eben'
  if (m < 60) return `vor ${m} Min.`
  const h = Math.floor(m / 60)
  if (h < 24) return `vor ${h} Std.`
  const d = Math.floor(h / 24)
  return d === 1 ? 'gestern' : `vor ${d} Tagen`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function catOf(key: string) {
  return CATS.find(c => c.key === key) ?? CATS[CATS.length - 1]
}

// ─── Glassmorphism ────────────────────────────────────────────────────────────

const GLASS = {
  sidebar: {
    background: 'rgba(18,20,28,0.72)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
  } as CSSProperties,
  content: {
    background: 'rgba(14,16,22,0.55)',
    backdropFilter: 'blur(16px) saturate(140%)',
    WebkitBackdropFilter: 'blur(16px) saturate(140%)',
  } as CSSProperties,
  header: {
    background: 'rgba(12,14,20,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  } as CSSProperties,
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  } as CSSProperties,
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#e2e4ea',
    padding: '10px 14px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
  } as CSSProperties,
  msgInput: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#e2e4ea',
    padding: '12px 16px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
    resize: 'none' as const,
    fontFamily: 'inherit',
    lineHeight: '1.5',
  } as CSSProperties,
}

// ─── Sidebar-Hilfskomponenten ──────────────────────────────────────────────────

function SidebarSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '16px 10px 4px' }}>
        {label}
      </p>
      {children}
    </div>
  )
}

function SidebarBtn({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', width: '100%',
        padding: '5px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', textAlign: 'left',
        background: active ? 'rgba(255,255,255,0.1)' : hov ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active ? '#fff' : hov ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.38)',
        fontSize: 14, fontWeight: active ? 600 : 400, transition: 'all 0.1s',
      }}>
      {children}
    </button>
  )
}

function TicketChannel({ ticket, active, onClick }: { ticket: Ticket; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  const cat = catOf(ticket.category)
  const st  = STATUS[ticket.status]
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        padding: '5px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', textAlign: 'left',
        background: active ? 'rgba(255,255,255,0.1)' : hov ? 'rgba(255,255,255,0.05)' : 'transparent',
        transition: 'all 0.1s',
      }}>
      <span style={{ color: active ? cat.color : 'rgba(255,255,255,0.22)', fontSize: 15, lineHeight: 1, flexShrink: 0, fontWeight: 400 }}>#</span>
      <span style={{
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: active ? '#fff' : hov ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.38)',
        fontSize: 14, fontWeight: active ? 600 : 400, transition: 'color 0.1s',
      }}>{ticket.subject}</span>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, flexShrink: 0, opacity: active ? 1 : 0.5 }} />
    </button>
  )
}

// ─── Chat-Komponente (inline, kein eigener API-Hook) ──────────────────────────

function TicketChat({ ticket, currentUserId }: { ticket: Ticket; currentUserId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading]   = useState(true)
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const closed                  = ticket.status === 'closed'

  const load = () => {
    fetch(`/api/support/tickets/${ticket.id}/messages`)
      .then(r => r.json())
      .then(d => { setMessages(d.messages || []); setLoading(false) })
  }

  useEffect(() => { load() }, [ticket.id])

  useEffect(() => {
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [ticket.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async () => {
    if (!text.trim() || sending || closed) return
    setSending(true)
    await fetch(`/api/support/tickets/${ticket.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text.trim() }),
    })
    setText('')
    setSending(false)
    load()
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  // Nachrichten nach Datum gruppieren
  const grouped: { date: string; msgs: Message[] }[] = []
  messages.forEach(m => {
    const d = new Date(m.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    if (!grouped.length || grouped[grouped.length - 1].date !== d) grouped.push({ date: d, msgs: [m] })
    else grouped[grouped.length - 1].msgs.push(m)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Ticket-Infoleiste */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 2 }}>
            {catOf(ticket.category).label} · #{ticket.id} · erstellt {timeAgo(ticket.created_at)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <span style={{ background: PRIORITY[ticket.priority].color + '1a', color: PRIORITY[ticket.priority].color, border: `1px solid ${PRIORITY[ticket.priority].color}33`, borderRadius: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px' }}>
            {PRIORITY[ticket.priority].label}
          </span>
          <span style={{ background: STATUS[ticket.status].bg, color: STATUS[ticket.status].text, borderRadius: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS[ticket.status].dot, display: 'inline-block' }} />
            {STATUS[ticket.status].label}
          </span>
        </div>
      </div>

      {/* Nachrichten-Scroll-Bereich */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Lädt...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>Noch keine Nachrichten.</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.date}>
              {/* Datums-Trenner */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 12px' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{group.date}</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
              </div>

              {group.msgs.map((m, i) => {
                const isOwn    = m.sender_id === currentUserId && !m.is_staff
                const prev     = group.msgs[i - 1]
                const grouped  = prev && prev.sender_id === m.sender_id && prev.is_staff === m.is_staff
                const name     = m.is_staff ? (m.sender?.username ?? 'Team') : (m.sender?.username ?? '')

                return (
                  <div key={m.id} style={{ marginBottom: grouped ? 2 : 12 }}>
                    {!grouped && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isOwn ? '#a5b4fc' : m.is_staff ? '#f472b6' : '#e2e4ea' }}>
                          {m.is_staff ? `${name} (Team)` : name}
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{formatTime(m.created_at)}</span>
                      </div>
                    )}
                    <p style={{
                      color: 'rgba(255,255,255,0.82)',
                      fontSize: 14,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      paddingLeft: 0,
                    }}>{m.body}</p>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Eingabe */}
      <div style={{ padding: '12px 20px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {closed ? (
          <div style={{ background: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.2)', borderRadius: 10, padding: '10px 16px', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Dieses Ticket ist geschlossen.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Nachricht schreiben… (Enter senden, Shift+Enter neue Zeile)"
              rows={1}
              style={{ ...GLASS.msgInput, flex: 1, maxHeight: 120 }}
            />
            <button onClick={send} disabled={!text.trim() || sending}
              style={{
                background: text.trim() ? '#5865f2' : 'rgba(88,101,242,0.25)',
                border: 'none', borderRadius: 8, padding: '10px 16px', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default',
                flexShrink: 0, transition: 'background 0.15s',
              }}>
              {sending ? '…' : '↑'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { user } = useAuth()

  const [tickets, setTickets]       = useState<Ticket[]>([])
  const [loadingTickets, setLT]     = useState(true)
  const [serverStatus, setSS]       = useState<ServerStatus | null>(null)
  const [active, setActive]         = useState<ActiveView>(null)
  const [openFaq, setFaq]           = useState<number | null>(null)

  // Form
  const [fCategory, setFCat]        = useState('bug')
  const [fSubject, setFSubj]        = useState('')
  const [fMessage, setFMsg]         = useState('')
  const [fPriority, setFPrio]       = useState<'low' | 'normal' | 'high'>('normal')
  const [fTarget, setFTarget]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubErr]    = useState('')
  const [suggestions, setSug]       = useState<PlayerOption[]>([])
  const [sugFocus, setSugFocus]     = useState(false)
  const [selectedTarget, setSelTgt] = useState<PlayerOption | null>(null)

  const selectedCat = catOf(fCategory)

  useEffect(() => {
    if (!selectedCat.needsTarget || fTarget.trim().length < 2) { setSug([]); return }
    const t = setTimeout(() => {
      fetch(`/api/smp/players-search?q=${encodeURIComponent(fTarget.trim())}`)
        .then(r => r.json()).then(d => setSug(d.players || []))
    }, 200)
    return () => clearTimeout(t)
  }, [fTarget, fCategory])

  const loadTickets = () => {
    if (!user) return
    setLT(true)
    fetch('/api/support/tickets').then(r => r.json()).then(d => {
      setTickets(d.tickets || [])
      setLT(false)
    })
  }

  useEffect(() => { loadTickets() }, [user])

  useEffect(() => {
    fetch('/api/smp/server-status').then(r => r.json()).then(setSS).catch(() => {})
    const t = setInterval(() => fetch('/api/smp/server-status').then(r => r.json()).then(setSS).catch(() => {}), 30000)
    return () => clearInterval(t)
  }, [])

  const submit = async () => {
    if (!fSubject.trim() || !fMessage.trim()) return
    setSubmitting(true); setSubErr('')
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: fCategory, subject: fSubject, message: fMessage, priority: fPriority,
        targetUsername: selectedCat.needsTarget ? (selectedTarget?.player_name || undefined) : undefined,
      }),
    })
    setSubmitting(false)
    if (!res.ok) { const d = await res.json(); setSubErr(d.error || 'Fehler'); return }
    setFSubj(''); setFMsg(''); setFTarget(''); setSelTgt(null); setFCat('bug'); setFPrio('normal')
    // Tickets neu laden und neu erstelltes Ticket auswählen
    fetch('/api/support/tickets').then(r => r.json()).then(d => {
      const list: Ticket[] = d.tickets || []
      setTickets(list)
      setLT(false)
      if (list.length > 0) setActive(list[0].id)
    })
  }

  const openTickets   = tickets.filter(t => t.status !== 'closed')
  const closedTickets = tickets.filter(t => t.status === 'closed')
  const activeTicket  = typeof active === 'number' ? tickets.find(t => t.id === active) ?? null : null

  const headerName = active === 'new' ? 'neues-ticket'
    : active === 'faq' ? 'faq'
    : activeTicket ? activeTicket.subject
    : 'support'

  const headerDesc = active === 'new' ? 'Neue Anfrage erstellen'
    : active === 'faq' ? 'Häufige Fragen'
    : activeTicket ? catOf(activeTicket.category).label
    : 'Wähle ein Ticket oder erstelle ein neues'

  return (
    <div style={{ position: 'fixed', top: 65, left: 0, right: 0, bottom: 0, display: 'flex', overflow: 'hidden', zIndex: 10, height: 'calc(100vh - 65px)' }}>

      {/* Hintergrund */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'linear-gradient(135deg, #0a0b10 0%, #0e1020 40%, #0c0e1a 70%, #0a0b14 100%)' }} />
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', top: -200, left: -150, background: 'radial-gradient(circle, rgba(88,65,212,0.35) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', bottom: -150, right: -100, background: 'radial-gradient(circle, rgba(124,45,200,0.28) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', top: '40%', left: '45%', background: 'radial-gradient(circle, rgba(37,99,200,0.18) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div style={{ ...GLASS.sidebar, width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, height: '100%' }}>

        {/* Server-Status */}
        <div style={{ padding: '14px 10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>seekclan.de</p>
          {serverStatus === null ? (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>—</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: serverStatus.online ? '#23a55a' : '#ed4245', boxShadow: serverStatus.online ? '0 0 7px #23a55a88' : 'none' }} />
              <span style={{ fontSize: 12, color: serverStatus.online ? '#23a55a' : '#ed4245', fontWeight: 600 }}>
                {serverStatus.online ? `${serverStatus.players} / ${serverStatus.maxPlayers} online` : 'Offline'}
              </span>
            </div>
          )}
        </div>

        {/* Nav + Ticket-Liste */}
        <div style={{ padding: '0 6px', flex: 1, overflowY: 'auto' }}>
          <SidebarSection label="Support">
            <SidebarBtn active={active === 'new'} onClick={() => setActive('new')}>Neues Ticket</SidebarBtn>
            <SidebarBtn active={active === 'faq'} onClick={() => setActive('faq')}>FAQ</SidebarBtn>
            <SidebarBtn onClick={() => window.open('https://discord.gg/MnR4usU5XT', '_blank', 'noopener')}>Discord</SidebarBtn>
          </SidebarSection>

          {user && !loadingTickets && openTickets.length > 0 && (
            <SidebarSection label={`Offen — ${openTickets.length}`}>
              {openTickets.map(t => (
                <TicketChannel key={t.id} ticket={t} active={active === t.id} onClick={() => setActive(t.id)} />
              ))}
            </SidebarSection>
          )}

          {user && !loadingTickets && closedTickets.length > 0 && (
            <SidebarSection label={`Geschlossen — ${closedTickets.length}`}>
              {closedTickets.map(t => (
                <TicketChannel key={t.id} ticket={t} active={active === t.id} onClick={() => setActive(t.id)} />
              ))}
            </SidebarSection>
          )}

          {user && loadingTickets && (
            <p style={{ padding: '12px 10px', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Lädt...</p>
          )}
          {!user && (
            <p style={{ padding: '12px 10px', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Anmelden, um Tickets zu sehen.</p>
          )}
        </div>
      </div>

      {/* ── Hauptbereich ────────────────────────────────────────────────────── */}
      <div style={{ ...GLASS.content, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1, minWidth: 0, height: '100%' }}>

        {/* Channel-Header */}
        <div style={{ ...GLASS.header, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 17, lineHeight: 1 }}>#</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{headerName}</span>
          <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: 13, whiteSpace: 'nowrap' }}>{headerDesc}</span>
        </div>

        {/* ── Ticket-Chat ────────────────────────────────────────────────────── */}
        {activeTicket && user && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <TicketChat ticket={activeTicket} currentUserId={user.id} />
          </div>
        )}

        {/* ── Kein View ──────────────────────────────────────────────────────── */}
        {active === null && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Support</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                Wähle links ein Ticket, um den Chat zu öffnen, oder erstelle eine neue Anfrage.
              </p>
              {!user && (
                <Link href="/login" style={{ background: '#5865f2', color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 600, fontSize: 14, display: 'inline-block' }}>
                  Anmelden
                </Link>
              )}
              {user && (
                <button onClick={() => setActive('new')} style={{ background: '#5865f2', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  Neues Ticket erstellen
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Neues Ticket ───────────────────────────────────────────────────── */}
        {active === 'new' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
            {!user ? (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Anmelden erforderlich</p>
                <Link href="/login" style={{ background: '#5865f2', color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 600, fontSize: 14, display: 'inline-block' }}>Anmelden</Link>
              </div>
            ) : (
              <div style={{ maxWidth: 640 }}>
                <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Neues Ticket</h2>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 28 }}>Wähle eine Kategorie und beschreibe dein Anliegen.</p>

                {/* Kategorie-Grid */}
                <div style={{ marginBottom: 24 }}>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Kategorie</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {CATS.map(c => {
                      const sel = fCategory === c.key
                      return (
                        <button key={c.key} onClick={() => setFCat(c.key)} style={{
                          background: sel ? `${c.color}18` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${sel ? c.color + '55' : 'rgba(255,255,255,0.07)'}`,
                          borderRadius: 10, padding: '11px 13px', textAlign: 'left', cursor: 'pointer',
                          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                          transition: 'all 0.13s',
                        }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color, marginBottom: 7, boxShadow: sel ? `0 0 8px ${c.color}99` : 'none' }} />
                          <p style={{ color: sel ? c.color : '#e2e4ea', fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{c.label}</p>
                          <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, lineHeight: 1.4 }}>{c.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Target Player */}
                {selectedCat.needsTarget && (
                  <div style={{ marginBottom: 18, position: 'relative' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Betroffener Spieler</p>
                    {selectedTarget ? (
                      <div style={{ background: 'rgba(35,165,90,0.1)', border: '1px solid rgba(35,165,90,0.25)', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4ade80', fontSize: 14, fontWeight: 600 }}>
                          <img src={`/api/player-heads/${selectedTarget.player_name}/24`} style={{ width: 24, height: 24, borderRadius: 6 }} alt="" />
                          {selectedTarget.player_name}
                        </span>
                        <button onClick={() => { setSelTgt(null); setFTarget('') }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer' }}>Ändern</button>
                      </div>
                    ) : (
                      <input value={fTarget} onChange={e => setFTarget(e.target.value)}
                        onFocus={() => setSugFocus(true)} onBlur={() => setTimeout(() => setSugFocus(false), 150)}
                        placeholder="Spielername eingeben..." style={GLASS.input} />
                    )}
                    {sugFocus && !selectedTarget && suggestions.length > 0 && (
                      <div style={{ position: 'absolute', left: 0, right: 0, background: 'rgba(10,11,18,0.96)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, marginTop: 4, zIndex: 10, overflow: 'hidden' }}>
                        {suggestions.map(p => (
                          <button key={p.uuid} onClick={() => { setSelTgt(p); setSugFocus(false) }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#e2e4ea', fontSize: 14, textAlign: 'left' }}
                            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.background = 'none')}>
                            <img src={`/api/player-heads/${p.player_name}/24`} style={{ width: 24, height: 24, borderRadius: 6 }} alt="" />
                            {p.player_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Betreff */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Betreff</p>
                  <input value={fSubject} onChange={e => setFSubj(e.target.value)} placeholder="Kurze Zusammenfassung..." style={GLASS.input} />
                </div>

                {/* Nachricht */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Nachricht</p>
                  <textarea value={fMessage} onChange={e => setFMsg(e.target.value)} rows={5}
                    placeholder="Beschreibe dein Anliegen so genau wie möglich..."
                    style={{ ...GLASS.input, display: 'block', resize: 'none', fontFamily: 'inherit' }} />
                </div>

                {/* Priorität */}
                <div style={{ marginBottom: 28 }}>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Priorität</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['low', 'normal', 'high'] as const).map(p => (
                      <button key={p} onClick={() => setFPrio(p)} style={{
                        background: fPriority === p ? `${PRIORITY[p].color}1a` : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${fPriority === p ? PRIORITY[p].color + '55' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 6, padding: '6px 18px', fontSize: 13, cursor: 'pointer',
                        color: fPriority === p ? PRIORITY[p].color : 'rgba(255,255,255,0.38)',
                        fontWeight: fPriority === p ? 600 : 400,
                      }}>{PRIORITY[p].label}</button>
                    ))}
                  </div>
                </div>

                {submitError && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 14 }}>{submitError}</p>}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={submit} disabled={!fSubject.trim() || !fMessage.trim() || submitting}
                    style={{ background: '#5865f2', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: !fSubject.trim() || !fMessage.trim() || submitting ? 0.45 : 1 }}>
                    {submitting ? 'Wird gesendet...' : 'Ticket erstellen'}
                  </button>
                  <button onClick={() => setActive(null)} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}>
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
        {active === 'faq' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 36px' }}>
            <div style={{ maxWidth: 620 }}>
              <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Häufige Fragen</h2>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 24 }}>Vielleicht findest du hier schon eine Antwort.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
                {FAQ.map((f, i) => (
                  <div key={i} onClick={() => setFaq(openFaq === i ? null : i)}
                    style={{ ...GLASS.card, padding: '14px 18px', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.07)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <p style={{ color: '#e2e4ea', fontWeight: 600, fontSize: 14 }}>{f.q}</p>
                      <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 14, flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
                    </div>
                    {openFaq === i && (
                      <p style={{ color: 'rgba(255,255,255,0.48)', fontSize: 14, marginTop: 10, lineHeight: 1.65 }}>{f.a}</p>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ ...GLASS.card, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#e2e4ea', fontWeight: 600, fontSize: 14, marginBottom: 3 }}>Frage nicht dabei?</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Erstell ein Ticket oder komm auf unseren Discord.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setActive('new')} style={{ background: '#5865f2', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Ticket erstellen
                  </button>
                  <a href="https://discord.gg/MnR4usU5XT" target="_blank" rel="noopener noreferrer"
                    style={{ background: 'rgba(88,101,242,0.15)', border: '1px solid rgba(88,101,242,0.3)', color: '#a5b4fc', textDecoration: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                    Discord
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}