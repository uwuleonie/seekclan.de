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
  archived_at: string | null
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
type ActiveView = 'new' | 'faq' | 'archive' | number | null

// ─── Daten ────────────────────────────────────────────────────────────────────

const CATS = [
  { key: 'bug',              label: 'Bug-Report',          color: '#f87171', desc: 'Fehler im Spiel oder auf der Website',  needsTarget: false },
  { key: 'clan_application', label: 'Clan-Bewerbung',      color: '#4ade80', desc: 'Bewirb dich als Clan-Mitglied',          needsTarget: false },
  { key: 'complaint',        label: 'Beschwerde',          color: '#fb923c', desc: 'Probleme mit anderen Spielern',          needsTarget: true  },
  { key: 'suggestion',       label: 'Vorschlag',           color: '#60a5fa', desc: 'Ideen und Verbesserungsvorschläge',       needsTarget: false },
  { key: 'missing_badge',    label: 'Abzeichen fehlt',     color: '#c084fc', desc: 'Du hast ein Abzeichen nicht erhalten',   needsTarget: false },
  { key: 'whitelist',        label: 'Whitelist-Problem',   color: '#38bdf8', desc: 'Kein Zugang zum Server',                needsTarget: false },
  { key: 'player_report',    label: 'Spieler melden',      color: '#fb7185', desc: 'Regelverstoß eines Spielers melden',    needsTarget: true  },
  { key: 'account_link',     label: 'Account-Verknüpfung', color: '#a78bfa', desc: 'Minecraft/Discord-Account verknüpfen',  needsTarget: false },
  { key: 'map_submission',   label: 'Map einreichen',      color: '#34d399', desc: 'Reiche eine eigene Map als .zip ein',   needsTarget: false },
  { key: 'discord',          label: 'Discord-Support',     color: '#5865f2', desc: 'Fragen und Probleme rund um Discord',   needsTarget: false },
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
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '5px 10px', borderRadius: 4, border: 'none', cursor: 'pointer', textAlign: 'left',
        background: active ? 'rgba(255,255,255,0.1)' : hov ? 'rgba(255,255,255,0.05)' : 'transparent',
        transition: 'all 0.1s',
      }}>
      {/* Kategorie-Farbpunkt statt # */}
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? cat.color : 'rgba(255,255,255,0.2)', flexShrink: 0, boxShadow: active ? `0 0 6px ${cat.color}88` : 'none', transition: 'all 0.1s' }} />
      <span style={{
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: active ? '#fff' : hov ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.38)',
        fontSize: 14, fontWeight: active ? 600 : 400, transition: 'color 0.1s',
      }}>{ticket.subject}</span>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, flexShrink: 0, opacity: active ? 1 : 0.4 }} />
    </button>
  )
}

// ─── Ticket-Info-Typen ────────────────────────────────────────────────────────

type TicketFile = { id: number; filename: string; original_name: string; size_bytes: number; mime_type: string; uploaded_at: string; uploader_username: string }
type TicketParticipant = { id: string; username: string; minecraft_username: string | null; added_at: string; invited_by_username: string | null }
type TicketDetail = {
  ticket: Ticket & { closed_at: string | null }
  creator: { id: string; username: string; minecraft_username: string | null }
  participants: TicketParticipant[]
  files: TicketFile[]
}

// ─── Chat-Komponente (inline, kein eigener API-Hook) ──────────────────────────

function TicketChat({ ticket, currentUserId, infoOpen, setInfoOpen }: { ticket: Ticket; currentUserId: string; infoOpen: boolean; setInfoOpen: (v: boolean | ((prev: boolean) => boolean)) => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading]   = useState(true)
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)

  // Info-Drawer
  const [detail, setDetail]         = useState<TicketDetail | null>(null)
  const [detailLoading, setDL]      = useState(false)
  const [inviteInput, setInviteInp] = useState('')
  const [inviting, setInviting]     = useState(false)
  const [inviteMsg, setInviteMsg]   = useState('')

  // Versteckt Footer auf dieser Seite
  useEffect(() => {
    const footer = document.querySelector('footer') as HTMLElement | null
    if (footer) footer.style.display = 'none'
    return () => { if (footer) footer.style.display = '' }
  }, [])

  const loadDetail = () => {
    setDL(true)
    fetch(`/api/support/tickets/${ticket.id}`)
      .then(r => r.json())
      .then(d => { if (d.ticket) setDetail(d); setDL(false) })
      .catch(() => setDL(false))
  }

  // Detail laden sobald Drawer geöffnet wird
  useEffect(() => {
    if (infoOpen && !detail) loadDetail()
  }, [infoOpen])

  useEffect(() => {
    setDetail(null)
    setInfoOpen(false)
  }, [ticket.id])

  const invite = async () => {
    if (!inviteInput.trim() || inviting) return
    setInviting(true); setInviteMsg('')
    const res = await fetch(`/api/support/tickets/${ticket.id}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: inviteInput.trim() }),
    })
    const d = await res.json()
    setInviting(false)
    if (res.ok) { setInviteMsg(`${d.invited} wurde eingeladen`); setInviteInp(''); loadDetail() }
    else setInviteMsg(d.error || 'Fehler')
  }

  const exportPDF = async () => {
    const det = detail ?? await fetch(`/api/support/tickets/${ticket.id}`).then(r => r.json())
    const cat = catOf(ticket.category)
    const pr  = PRIORITY[ticket.priority]
    const st  = STATUS[ticket.status]

    const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleString('de-DE') : '—'
    const formatBytes = (b: number) => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`

    // html2pdf.js via CDN laden falls noch nicht geladen
    await new Promise<void>((resolve, reject) => {
      if ((window as any).html2pdf) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
      s.onload = () => resolve()
      s.onerror = reject
      document.head.appendChild(s)
    })

    const el = document.createElement('div')
    el.style.cssText = 'font-family:Arial,sans-serif;font-size:13px;color:#222;padding:0 4px;'
    el.innerHTML = `
      <h1 style="font-size:18px;margin:0 0 4px">${ticket.subject}</h1>
      <p style="color:#666;font-size:12px;margin:0 0 14px">Ticket #${ticket.id} · ${cat.label}</p>
      <p style="margin:0 0 18px">
        <span style="background:#f3f4f6;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;margin-right:6px">${pr.label}</span>
        <span style="background:#f3f4f6;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700">${st.label}</span>
      </p>

      <h2 style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:0 0 10px">Details</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px">
        <tr><td style="padding:3px 0;color:#888;width:140px">Erstellt</td><td>${formatDate(ticket.created_at)}</td></tr>
        <tr><td style="padding:3px 0;color:#888">Geschlossen</td><td>${formatDate(det?.ticket?.closed_at ?? null)}</td></tr>
        <tr><td style="padding:3px 0;color:#888">Ersteller</td><td>${det?.creator?.username ?? '—'}</td></tr>
        <tr><td style="padding:3px 0;color:#888">Kategorie</td><td>${cat.label}</td></tr>
        <tr><td style="padding:3px 0;color:#888">Priorität</td><td>${pr.label}</td></tr>
      </table>

      ${det?.participants?.length ? `
        <h2 style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:0 0 10px">Teilnehmer</h2>
        <p style="margin:0 0 18px">${det.participants.map((p: TicketParticipant) =>
          `<span style="background:#f3f4f6;border-radius:4px;padding:2px 8px;font-size:11px;margin:0 4px 4px 0;display:inline-block">${p.username}${p.invited_by_username ? ` (von ${p.invited_by_username})` : ''}</span>`
        ).join('')}</p>` : ''}

      ${det?.files?.length ? `
        <h2 style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:0 0 10px">Dateien</h2>
        <div style="margin-bottom:18px">${det.files.map((f: TicketFile) =>
          `<div style="margin-bottom:4px;font-size:12px">${f.original_name} <span style="color:#aaa">${formatBytes(f.size_bytes)}</span></div>`
        ).join('')}</div>` : ''}

      <h2 style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:0 0 12px">Chatverlauf</h2>
      ${(() => {
        let lastDate = ''
        return messages.map(m => {
          const d = new Date(m.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
          const sep = d !== lastDate
            ? `<div style="text-align:center;color:#bbb;font-size:11px;margin:12px 0 8px;border-top:1px solid #f0f0f0;padding-top:6px">${d}</div>`
            : ''
          lastDate = d
          const name = m.sender?.username ?? '?'
          const isStaff = m.is_staff
          return `${sep}<div style="margin-bottom:9px">
            <span style="font-weight:700;font-size:12px;color:${isStaff ? '#be185d' : '#111'}">${isStaff ? name + ' (Team)' : name}</span>
            <span style="color:#aaa;font-size:11px;margin-left:6px">${new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
            <div style="margin-top:3px;line-height:1.55;font-size:13px;white-space:pre-wrap">${m.body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          </div>`
        }).join('')
      })()}
    `

    const filename = `ticket-${ticket.id}-${ticket.subject.slice(0, 40).replace(/[^a-z0-9äöüÄÖÜ]/gi, '-').toLowerCase()}.pdf`;
    (window as any).html2pdf().set({
      margin: [12, 14],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(el).save()

    setInfoOpen(false)
  }

  const scrollRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }
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
    scrollToBottom()
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
    setTimeout(scrollToBottom, 100)
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

  const [menuOpen, setMenuOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Menü schließen bei Klick außerhalb
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const archiveTicket = async () => {
    setArchiving(true)
    await fetch(`/api/support/tickets/${ticket.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unarchive: false }),
    })
    setArchiving(false)
    setMenuOpen(false)
    window.location.reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>

      {/* Archiv-Zeile — nur bei geschlossenen Tickets */}
      {ticket.status === 'closed' && (
        <div style={{ padding: '6px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(v => !v)}
              style={{ background: 'none', border: 'none', borderRadius: 4, color: 'rgba(255,255,255,0.3)', fontSize: 14, cursor: 'pointer', padding: '2px 8px', letterSpacing: 2 }}>
              ···
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: 'rgba(15,16,24,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, zIndex: 50, minWidth: 160, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                <button onClick={archiveTicket} disabled={archiving}
                  style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#fbbf24', fontSize: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: archiving ? 0.5 : 1 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  {archiving ? 'Wird archiviert…' : 'Ins Archiv'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info-Drawer */}
      {infoOpen && (
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 320, zIndex: 20, display: 'flex', flexDirection: 'column', background: 'rgba(10,11,18,0.97)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.08)', boxShadow: '-8px 0 32px rgba(0,0,0,0.4)' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Ticket-Info</span>
            <button onClick={() => setInfoOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <div className="support-scroll" style={{ flex: 1, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {detailLoading && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Lädt…</p>}
            {detail && (
              <>
                {/* Zeiten */}
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Zeitstempel</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Erstellt</span>
                      <span style={{ color: '#e2e4ea' }}>{new Date(detail.ticket.created_at).toLocaleString('de-DE')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Geschlossen</span>
                      <span style={{ color: detail.ticket.closed_at ? '#e2e4ea' : 'rgba(255,255,255,0.2)' }}>
                        {detail.ticket.closed_at ? new Date(detail.ticket.closed_at).toLocaleString('de-DE') : '—'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Kategorie</span>
                      <span style={{ color: catOf(ticket.category).color, fontWeight: 600 }}>{catOf(ticket.category).label}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Priorität</span>
                      <span style={{ color: PRIORITY[ticket.priority].color, fontWeight: 600 }}>{PRIORITY[ticket.priority].label}</span>
                    </div>
                  </div>
                </div>

                {/* Mitglieder */}
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Mitglieder</p>
                  {/* Ersteller */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <img src={`/api/player-heads/${detail.creator.minecraft_username || detail.creator.username}/24`} style={{ width: 24, height: 24, borderRadius: 6 }} alt="" onError={e => (e.currentTarget.style.display = 'none')} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: '#e2e4ea', fontSize: 13, fontWeight: 600 }}>{detail.creator.username}</p>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Ersteller</p>
                    </div>
                  </div>
                  {detail.participants.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <img src={`/api/player-heads/${p.minecraft_username || p.username}/24`} style={{ width: 24, height: 24, borderRadius: 6 }} alt="" onError={e => (e.currentTarget.style.display = 'none')} />
                      <div style={{ flex: 1 }}>
                        <p style={{ color: '#e2e4ea', fontSize: 13, fontWeight: 600 }}>{p.username}</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                          {p.added_at ? `hinzugefügt ${timeAgo(p.added_at)}` : ''}
                          {p.invited_by_username ? ` · von ${p.invited_by_username}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Einladen */}
                  {ticket.status !== 'closed' && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input value={inviteInput} onChange={e => setInviteInp(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && invite()}
                          placeholder="Spieler einladen…"
                          style={{ ...GLASS.input, flex: 1, padding: '7px 10px', fontSize: 12 }} />
                        <button onClick={invite} disabled={!inviteInput.trim() || inviting}
                          style={{ background: '#5865f2', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, opacity: !inviteInput.trim() || inviting ? 0.5 : 1 }}>
                          {inviting ? '…' : 'Einladen'}
                        </button>
                      </div>
                      {inviteMsg && <p style={{ fontSize: 11, marginTop: 5, color: inviteMsg.includes('eingeladen') ? '#23a55a' : '#f87171' }}>{inviteMsg}</p>}
                    </div>
                  )}
                </div>

                {/* Dateien */}
                {detail.files.length > 0 && (
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Dateien ({detail.files.length})</p>
                    {detail.files.map(f => (
                      <a key={f.id} href={`/api/uploads/support-files/${f.filename}`} download={f.original_name}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 5, textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>↓</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: '#e2e4ea', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.original_name}</p>
                          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{f.size_bytes > 1024*1024 ? `${(f.size_bytes/1024/1024).toFixed(1)} MB` : `${(f.size_bytes/1024).toFixed(0)} KB`}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Export */}
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Export</p>
                  <button onClick={exportPDF}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '9px 12px', color: '#e2e4ea', fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
                    <span style={{ opacity: 0.5 }}>↓</span> Als PDF exportieren
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Nachrichten-Scroll-Bereich */}
      <div ref={scrollRef} className="support-scroll" style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 0 }}>
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
                const isOwn   = m.sender_id === currentUserId && !m.is_staff
                const prev    = group.msgs[i - 1]
                const grpd    = prev && prev.sender_id === m.sender_id && prev.is_staff === m.is_staff
                const name    = m.is_staff ? (m.sender?.username ?? 'Team') : (m.sender?.username ?? '')

                return (
                  <div key={m.id} style={{ marginBottom: grpd ? 2 : 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {/* Avatar-Spalte — immer 32px breit für Ausrichtung */}
                    <div style={{ width: 32, flexShrink: 0, paddingTop: grpd ? 0 : 2 }}>
                      {!grpd && (
                        m.is_staff ? (
                          /* Admin-Shield-Icon */
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                            🛡
                          </div>
                        ) : (
                          /* MC-Kopf */
                          <img
                            src={`/api/player-heads/${name}/32`}
                            style={{ width: 32, height: 32, borderRadius: 8, display: 'block' }}
                            alt=""
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          />
                        )
                      )}
                    </div>

                    {/* Nachricht */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {!grpd && (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isOwn ? '#a5b4fc' : m.is_staff ? '#f472b6' : '#e2e4ea' }}>
                            {m.is_staff ? `${name} (Team)` : name}
                          </span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>{formatTime(m.created_at)}</span>
                        </div>
                      )}
                      <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {m.body}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div style={{ height: 1 }} />
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

// ─── Kategorie-spezifische Felder ────────────────────────────────────────────

const BADGES_LIST = [
  'Clan-Mitglied', 'Veteran', 'Builder', 'PvP-Meister', 'Explorer', 'Händler',
  'Redstone-Profi', 'Farmer', 'Fischer', 'Bergmann', 'Sammler', 'Event-Teilnehmer',
  'Moderator', 'Supporter', 'Content Creator', 'Beta-Tester',
]

type ExtraFields = Record<string, any>

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 7 }}>{children}</p>
}

function SelectRow({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          background: value === o.key ? 'rgba(88,101,242,0.2)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${value === o.key ? 'rgba(88,101,242,0.5)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 6, padding: '5px 14px', fontSize: 13, cursor: 'pointer',
          color: value === o.key ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
          fontWeight: value === o.key ? 600 : 400,
        }}>{o.label}</button>
      ))}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, required }: { value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,${required && !value ? '0.3' : '0.1'})`, borderRadius: 8, color: '#e2e4ea', padding: '9px 13px', width: '100%', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} />
  )
}

function CategoryFields({ category, extra, setExtra, inputStyle }: {
  category: string
  extra: ExtraFields
  setExtra: (fn: (prev: ExtraFields) => ExtraFields) => void
  inputStyle: React.CSSProperties
}) {
  const set = (key: string, val: any) => setExtra(prev => ({ ...prev, [key]: val }))
  const toggle = (key: string, val: string) => {
    const arr: string[] = extra[key] || []
    setExtra(prev => ({ ...prev, [key]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] }))
  }

  const AREA_SHARED = ['Verbindungsprobleme', 'Lags', 'Befehle funktionieren nicht', 'Baufehler', 'Sonstiges']
  const AREA_MC_EXTRA = ['Lobbysystem', 'Serverwechsel']
  const AREA_SMP_EXTRA = ['Claims', 'Items verschwunden', 'Trustsystem', 'Shulker', 'Sonstiges']
  const CLAIM_SUB = ['Claim ID angeben (optional)', 'Sonstiges']
  const SHULKER_SUB = ['Shulker ID angeben (optional)', 'Statistiken', 'Sonstiges']

  // ── Bug-Report ──────────────────────────────────────────────────────────────
  if (category === 'bug') {
    const loc = extra.location || ''
    const server = extra.server || ''
    const area = extra.area || ''
    const areaOptions = loc === 'seekclan.de'
      ? [...AREA_SHARED, ...AREA_MC_EXTRA]
      : loc === 'modpack'
      ? AREA_SHARED
      : []
    const smpAreas = server === 'smp' ? AREA_SMP_EXTRA : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><FieldLabel>Wo ist der Fehler aufgetreten?</FieldLabel>
          <SelectRow value={loc} onChange={v => setExtra(prev => ({ ...prev, location: v, server: '', area: '' }))} options={[
            { key: 'seekclan.de', label: 'seekclan.de (Minecraft)' },
            { key: 'modpack', label: 'modpack.seekclan.de' },
            { key: 'website', label: 'Website' },
            { key: 'discord', label: 'Discord' },
          ]} />
        </div>
        {(loc === 'seekclan.de' || loc === 'modpack') && (
          <div><FieldLabel>Server</FieldLabel>
            <SelectRow value={server} onChange={v => setExtra(prev => ({ ...prev, server: v, area: '' }))} options={[
              { key: 'smp', label: 'SMP' },
              { key: 'lobby', label: 'Lobby' },
            ]} />
          </div>
        )}
        {(loc === 'seekclan.de' || loc === 'modpack') && server && (
          <div><FieldLabel>Bereich</FieldLabel>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
              {[...areaOptions, ...(server === 'smp' ? smpAreas : [])].map(a => (
                <button key={a} onClick={() => set('area', area === a ? '' : a)} style={{
                  background: area === a ? 'rgba(88,101,242,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${area === a ? 'rgba(88,101,242,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                  color: area === a ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                }}>{a}</button>
              ))}
            </div>
          </div>
        )}
        {area === 'Claims' && (
          <div><FieldLabel>Claim ID (optional)</FieldLabel>
            <TextInput value={extra.claim_id || ''} onChange={v => set('claim_id', v)} placeholder="z.B. 1234" />
          </div>
        )}
        {area === 'Shulker' && (
          <>
            <div><FieldLabel>Shulker-Unterkategorie</FieldLabel>
              <SelectRow value={extra.shulker_sub || ''} onChange={v => set('shulker_sub', v)} options={SHULKER_SUB.map(s => ({ key: s, label: s }))} />
            </div>
            {extra.shulker_sub === 'Shulker ID angeben (optional)' && (
              <div><FieldLabel>Shulker ID</FieldLabel>
                <TextInput value={extra.shulker_id || ''} onChange={v => set('shulker_id', v)} placeholder="Shulker ID" />
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Clan-Bewerbung ──────────────────────────────────────────────────────────
  if (category === 'clan_application') {
    return (
      <div><FieldLabel>Minecraft-Name (Pflicht)</FieldLabel>
        <TextInput value={extra.mc_name || ''} onChange={v => set('mc_name', v)} placeholder="Dein Minecraft-Username" required />
      </div>
    )
  }

  // ── Beschwerde ──────────────────────────────────────────────────────────────
  if (category === 'complaint') {
    return (
      <div><FieldLabel>Wo ist es passiert?</FieldLabel>
        <SelectRow value={extra.location || ''} onChange={v => set('location', v)} options={[
          { key: 'minecraft', label: 'Minecraft-Server' },
          { key: 'discord', label: 'Discord' },
        ]} />
      </div>
    )
  }

  // ── Vorschlag ───────────────────────────────────────────────────────────────
  if (category === 'suggestion') {
    return (
      <div><FieldLabel>Bereich</FieldLabel>
        <SelectRow value={extra.area || ''} onChange={v => set('area', v)} options={[
          { key: 'seekclan.de', label: 'seekclan.de (Minecraft)' },
          { key: 'discord', label: 'Discord' },
          { key: 'website', label: 'Website' },
        ]} />
      </div>
    )
  }

  // ── Abzeichen fehlt ─────────────────────────────────────────────────────────
  if (category === 'missing_badge') {
    const sel: string[] = extra.badges || []
    return (
      <div>
        <FieldLabel>Welche Abzeichen fehlen? (Mehrfachauswahl)</FieldLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {BADGES_LIST.map(b => (
            <button key={b} onClick={() => toggle('badges', b)} style={{
              background: sel.includes(b) ? 'rgba(192,132,252,0.18)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${sel.includes(b) ? 'rgba(192,132,252,0.5)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 6, padding: '4px 11px', fontSize: 12, cursor: 'pointer',
              color: sel.includes(b) ? '#c084fc' : 'rgba(255,255,255,0.4)',
              fontWeight: sel.includes(b) ? 600 : 400,
            }}>{b}</button>
          ))}
        </div>
      </div>
    )
  }

  // ── Whitelist-Problem ───────────────────────────────────────────────────────
  if (category === 'whitelist') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><FieldLabel>Minecraft-Name (Pflicht)</FieldLabel>
          <TextInput value={extra.mc_name || ''} onChange={v => set('mc_name', v)} placeholder="Dein Minecraft-Username" required />
        </div>
        <div><FieldLabel>Welchen Server?</FieldLabel>
          <SelectRow value={extra.server || ''} onChange={v => set('server', v)} options={[
            { key: 'seekclan.de', label: 'seekclan.de' },
            { key: 'modpack', label: 'modpack.seekclan.de' },
          ]} />
        </div>
      </div>
    )
  }

  // ── Spieler melden ──────────────────────────────────────────────────────────
  if (category === 'player_report') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><FieldLabel>Gemeldeter Spieler (Ingame-Name)</FieldLabel>
          <TextInput value={extra.reported_player || ''} onChange={v => set('reported_player', v)} placeholder="Minecraft-Username" required />
        </div>
        <div><FieldLabel>Regelverstoß</FieldLabel>
          <SelectRow value={extra.reason || ''} onChange={v => set('reason', v)} options={[
            { key: 'scam', label: 'Scam' },
            { key: 'griefing', label: 'Griefing' },
            { key: 'beleidigung', label: 'Beleidigung' },
            { key: 'hacking', label: 'Hacking / Cheating' },
            { key: 'sonstiges', label: 'Sonstiger Regelbruch' },
          ]} />
        </div>
      </div>
    )
  }

  // ── Account-Verknüpfung ─────────────────────────────────────────────────────
  if (category === 'account_link') {
    const type = extra.link_type || ''
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><FieldLabel>Was möchtest du verknüpfen?</FieldLabel>
          <SelectRow value={type} onChange={v => setExtra(prev => ({ ...prev, link_type: v, account_name: '' }))} options={[
            { key: 'mc', label: 'Minecraft-Account' },
            { key: 'discord', label: 'Discord-Account' },
            { key: 'other', label: 'Sonstiges' },
          ]} />
        </div>
        {type === 'mc' && (
          <div><FieldLabel>Ingame-Name (Pflicht)</FieldLabel>
            <TextInput value={extra.account_name || ''} onChange={v => set('account_name', v)} placeholder="Minecraft-Username" required />
          </div>
        )}
        {type === 'discord' && (
          <div><FieldLabel>Discord-Tag (Pflicht)</FieldLabel>
            <TextInput value={extra.account_name || ''} onChange={v => set('account_name', v)} placeholder="Name#0000 oder @name" required />
          </div>
        )}
      </div>
    )
  }

  // ── Map einreichen ──────────────────────────────────────────────────────────
  if (category === 'map_submission') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><FieldLabel>Map-Name (Pflicht)</FieldLabel>
          <TextInput value={extra.map_name || ''} onChange={v => set('map_name', v)} placeholder="Name deiner Map" required />
        </div>
        <div>
          <FieldLabel>Map-Datei (.zip, Pflicht)</FieldLabel>
          <label style={{ display: 'block', background: 'rgba(255,255,255,0.05)', border: `2px dashed ${extra.map_file ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 10, padding: '18px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
            <input type="file" accept=".zip" style={{ display: 'none' }} onChange={e => {
              const f = e.target.files?.[0]
              if (f) set('map_file', { name: f.name, size: f.size, file: f })
            }} />
            {extra.map_file
              ? <span style={{ color: '#34d399', fontSize: 13, fontWeight: 600 }}>✓ {extra.map_file.name} ({(extra.map_file.size / 1024 / 1024).toFixed(1)} MB)</span>
              : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>ZIP-Datei auswählen (unbegrenzte Größe)</span>
            }
          </label>
        </div>
        <div>
          <FieldLabel>Map-Fotos (optional, max. 5)</FieldLabel>
          <label style={{ display: 'block', background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(255,255,255,0.12)', borderRadius: 10, padding: '14px', textAlign: 'center', cursor: 'pointer' }}>
            <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
              const files = Array.from(e.target.files || []).slice(0, 5)
              set('map_images', files.map(f => ({ name: f.name, file: f })))
            }} />
            {extra.map_images?.length
              ? <span style={{ color: '#60a5fa', fontSize: 13 }}>{extra.map_images.length} Bild(er) ausgewählt</span>
              : <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Bilder auswählen (optional)</span>
            }
          </label>
        </div>
      </div>
    )
  }

  // ── Discord ─────────────────────────────────────────────────────────────────
  if (category === 'discord') {
    return (
      <div><FieldLabel>Discord-Name (Pflicht)</FieldLabel>
        <TextInput value={extra.discord_name || ''} onChange={v => set('discord_name', v)} placeholder="Dein Discord-Name oder Tag" required />
      </div>
    )
  }

  return null
}

// ─── Kategorie-Hilfe (rechte Spalte beim Ticket erstellen) ───────────────────

const CAT_HELP: Record<string, { title: string; tips: string[]; time: string }> = {
  bug:              { title: 'Guter Bug-Report',       time: '< 24h', tips: ['Wo genau ist der Fehler aufgetreten?', 'Was hast du davor gemacht?', 'Passiert es reproduzierbar oder zufällig?', 'Screenshot falls möglich'] },
  clan_application: { title: 'Clan-Bewerbung',         time: '2–5 Tage', tips: ['Wie lange spielst du schon Minecraft?', 'Was machst du am liebsten im Spiel?', 'Wie bist du auf seekclan aufmerksam geworden?', 'Alter und Aktivität kurz beschreiben'] },
  complaint:        { title: 'Beschwerde einreichen',  time: '< 48h', tips: ['Name des betroffenen Spielers', 'Was genau ist passiert?', 'Wann und wo (Server, Koordinaten)?', 'Screenshot oder Beweis wenn vorhanden'] },
  suggestion:       { title: 'Vorschlag einreichen',   time: '< 1 Woche', tips: ['Was soll hinzugefügt oder geändert werden?', 'Warum wäre das gut für die Community?', 'Wie könnte es technisch umgesetzt werden?'] },
  missing_badge:    { title: 'Fehlendes Abzeichen',    time: '< 48h', tips: ['Welches Abzeichen fehlt dir?', 'Wann hast du die Bedingung erfüllt?', 'Dein Minecraft-Username'] },
  whitelist:        { title: 'Whitelist-Problem',      time: '< 24h', tips: ['Dein exakter Minecraft-Username', 'Welchen Server versuchst du zu betreten?', 'Welche Fehlermeldung siehst du?'] },
  rollback_request: { title: 'Rollback-Anfrage',       time: '1–3 Tage', tips: ['Was genau wurde beschädigt oder verloren?', 'Wann ist es passiert (Datum + Uhrzeit)?', 'Koordinaten des betroffenen Bereichs', 'Mögliche Ursache (Griefer, Bug, Absturz?)'] },
  player_report:    { title: 'Spieler melden',         time: '< 48h', tips: ['Name des gemeldeten Spielers', 'Welche Regel wurde gebrochen?', 'Wann und wo ist es passiert?', 'Screenshot oder Beweis'] },
  account_link:     { title: 'Account-Verknüpfung',   time: '< 24h', tips: ['Welchen Account möchtest du verknüpfen? (MC / Discord)', 'Dein Minecraft-Username', 'Dein Discord-Tag falls relevant'] },
  map_submission:   { title: 'Map einreichen',         time: '1–2 Wochen', tips: ['Name der Map', 'Für welchen Modus ist die Map gedacht?', 'Kurze Beschreibung des Layouts', 'ZIP-Datei bereit? (wird nach Ticket-Erstellung angefragt)'] },
  other:            { title: 'Sonstiges',              time: 'variiert', tips: ['Beschreibe dein Anliegen so genau wie möglich', 'Was hast du bereits versucht?'] },
}

function CategoryHelp({ category }: { category: string }) {
  const h = CAT_HELP[category] ?? CAT_HELP.other
  const cat = catOf(category)
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${cat.color}22`, borderRadius: 12, padding: '18px 20px', transition: 'border-color 0.2s' }}>
      {/* Farbakzent-Linie oben */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${cat.color}, transparent)`, borderRadius: 2, marginBottom: 16 }} />

      <p style={{ color: cat.color, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{h.title}</p>
      <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginBottom: 16 }}>Typische Antwortzeit: {h.time}</p>

      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Was solltest du angeben?</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {h.tips.map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: cat.color, flexShrink: 0, marginTop: 5, opacity: 0.7 }} />
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 1.5 }}>{tip}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, lineHeight: 1.6 }}>
          Je mehr Details du angibst, desto schneller können wir helfen.
        </p>
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
  const [fExtra, setFExtra]         = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubErr]    = useState('')
  const [suggestions, setSug]       = useState<PlayerOption[]>([])
  const [sugFocus, setSugFocus]     = useState(false)
  const [selectedTarget, setSelTgt] = useState<PlayerOption | null>(null)

  const selectedCat = catOf(fCategory)

  const setActiveAndScroll = (v: ActiveView) => {
    window.scrollTo(0, 0)
    setActive(v)
  }

  // Kategorie-Wechsel setzt extra-Felder zurück
  const switchCategory = (key: string) => { setFCat(key); setFExtra({}) }

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

  // Validierung pro Kategorie
  const validate = (): string | null => {
    if (!fSubject.trim()) return 'Betreff fehlt'
    if (!fMessage.trim()) return 'Nachricht fehlt'
    if (fCategory === 'clan_application' && !fExtra.mc_name?.trim()) return 'Minecraft-Name ist Pflicht'
    if (fCategory === 'whitelist' && !fExtra.mc_name?.trim()) return 'Minecraft-Name ist Pflicht'
    if (fCategory === 'player_report' && !fExtra.reported_player?.trim()) return 'Name des gemeldeten Spielers fehlt'
    if (fCategory === 'account_link' && fExtra.link_type && !fExtra.account_name?.trim()) return 'Account-Name ist Pflicht'
    if (fCategory === 'map_submission' && !fExtra.map_name?.trim()) return 'Map-Name ist Pflicht'
    if (fCategory === 'map_submission' && !fExtra.map_file) return 'ZIP-Datei ist Pflicht'
    if (fCategory === 'discord' && !fExtra.discord_name?.trim()) return 'Discord-Name ist Pflicht'
    return null
  }

  const submit = async () => {
    const err = validate()
    if (err) { setSubErr(err); return }
    setSubmitting(true); setSubErr('')

    // Extra-Felder serialisieren (ohne File-Objekte)
    const extraForServer: Record<string, any> = {}
    for (const [k, v] of Object.entries(fExtra)) {
      if (k === 'map_file' || k === 'map_images') continue
      extraForServer[k] = v
    }

    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: fCategory, subject: fSubject, message: fMessage,
        priority: fCategory === 'clan_application' ? 'normal' : fPriority,
        targetUsername: selectedCat.needsTarget ? (selectedTarget?.player_name || undefined) : undefined,
        extraFields: extraForServer,
      }),
    })
    if (!res.ok) { const d = await res.json(); setSubErr(d.error || 'Fehler'); setSubmitting(false); return }
    const { ticket } = await res.json()

    // Dateien hochladen wenn Map-Einreichung
    if (fCategory === 'map_submission' && ticket?.id) {
      if (fExtra.map_file?.file) {
        const fd = new FormData()
        fd.append('file', fExtra.map_file.file)
        fd.append('type', 'map')
        await fetch(`/api/support/tickets/${ticket.id}/files`, { method: 'POST', body: fd })
      }
      if (fExtra.map_images?.length) {
        for (const img of fExtra.map_images) {
          const fd = new FormData()
          fd.append('file', img.file)
          fd.append('type', 'image')
          await fetch(`/api/support/tickets/${ticket.id}/files`, { method: 'POST', body: fd })
        }
      }
    }

    setFSubj(''); setFMsg(''); setFTarget(''); setSelTgt(null); setFCat('bug'); setFPrio('normal'); setFExtra({})
    setSubmitting(false)
    fetch('/api/support/tickets').then(r => r.json()).then(d => {
      const list: Ticket[] = d.tickets || []
      setTickets(list)
      setLT(false)
      if (list.length > 0) setActiveAndScroll(list[0].id)
    })
  }

  const [infoOpen, setInfoOpen]     = useState(false)

  const openTickets     = tickets.filter(t => t.status !== 'closed' && !t.archived_at)
  const closedTickets   = tickets.filter(t => t.status === 'closed' && !t.archived_at)
  const archivedTickets = tickets.filter(t => t.archived_at)
  const activeTicket  = typeof active === 'number' ? tickets.find(t => t.id === active) ?? null : null

  const headerName = active === 'new' ? 'neues-ticket'
    : active === 'faq' ? 'faq'
    : active === 'archive' ? 'archiv'
    : activeTicket ? activeTicket.subject
    : 'support'

  const headerDesc = active === 'new' ? 'Neue Anfrage erstellen'
    : active === 'faq' ? 'Häufige Fragen'
    : active === 'archive' ? 'Archivierte Tickets'
    : activeTicket ? catOf(activeTicket.category).label
    : 'Wähle ein Ticket oder erstelle ein neues'

  // Sperrt body/html-Scroll für diese Seite komplett
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = ''
      body.style.overflow = ''
    }
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)

  // Meet de echte navbar hoogte en setzt de container-hoogte exact
  useEffect(() => {
    const navbar = document.querySelector('nav') as HTMLElement | null
    const set = () => {
      const navH = navbar ? navbar.getBoundingClientRect().height : 65
      if (containerRef.current) {
        containerRef.current.style.height = `${window.innerHeight - navH}px`
      }
    }
    set()
    window.addEventListener('resize', set)
    return () => window.removeEventListener('resize', set)
  }, [])

  return (
    <div ref={containerRef} style={{ display: 'flex', overflow: 'hidden', width: '100%', position: 'relative' }}>
      <style>{`
        /* Versteckt alle Scrollbars auf dieser Seite — scrollen funktioniert trotzdem */
        .support-scroll { overflow-y: auto; scrollbar-width: none; }
        .support-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Hintergrund */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'linear-gradient(135deg, #0a0b10 0%, #0e1020 40%, #0c0e1a 70%, #0a0b14 100%)' }} />
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', top: -200, left: -150, background: 'radial-gradient(circle, rgba(88,65,212,0.35) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', bottom: -150, right: -100, background: 'radial-gradient(circle, rgba(124,45,200,0.28) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', top: '40%', left: '45%', background: 'radial-gradient(circle, rgba(37,99,200,0.18) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div style={{ ...GLASS.sidebar, width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, overflow: 'hidden' }}>

        {/* Server-Status */}
        <div style={{ padding: '14px 10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>seekclan.de</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            {/* Admin-Zahnrad — nur für admins/owner sichtbar */}
            {user && (user.clan_role === 'administrator' || user.clan_role === 'owner') && (
              <Link href="/admin2/support-tickets" title="Support-Admin" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', transition: 'color 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>
                ⚙
              </Link>
            )}
          </div>
        </div>

        {/* Nav + Ticket-Liste */}
        <div className="support-scroll" style={{ padding: "0 6px", flex: 1 }}>
          <SidebarSection label="Support">
            <SidebarBtn active={active === 'new'} onClick={() => setActiveAndScroll('new')}>Neues Ticket</SidebarBtn>
            <SidebarBtn active={active === 'faq'} onClick={() => setActiveAndScroll('faq')}>FAQ</SidebarBtn>
            <SidebarBtn onClick={() => window.open('https://discord.gg/MnR4usU5XT', '_blank', 'noopener')}>Discord</SidebarBtn>
          </SidebarSection>

          {user && !loadingTickets && openTickets.length > 0 && (
            <SidebarSection label={`Offen — ${openTickets.length}`}>
              {openTickets.map(t => (
                <TicketChannel key={t.id} ticket={t} active={active === t.id} onClick={() => setActiveAndScroll(t.id)} />
              ))}
            </SidebarSection>
          )}

          {user && !loadingTickets && closedTickets.length > 0 && (
            <SidebarSection label={`Geschlossen — ${closedTickets.length}`}>
              {closedTickets.map(t => (
                <TicketChannel key={t.id} ticket={t} active={active === t.id} onClick={() => setActiveAndScroll(t.id)} />
              ))}
            </SidebarSection>
          )}

          {user && loadingTickets && (
            <p style={{ padding: '12px 10px', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Lädt...</p>
          )}
          {!user && (
            <p style={{ padding: '12px 10px', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Anmelden, um Tickets zu sehen.</p>
          )}

          {/* Archiv-Button ganz unten */}
          {user && !loadingTickets && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 8 }}>
              <SidebarBtn active={active === 'archive'} onClick={() => setActiveAndScroll('archive')}>
                Archiv {archivedTickets.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{archivedTickets.length}</span>}
              </SidebarBtn>
            </div>
          )}
        </div>
      </div>

      {/* ── Hauptbereich ────────────────────────────────────────────────────── */}
      <div style={{ ...GLASS.content, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1, minWidth: 0 }}>

        {/* Channel-Header */}
        <div style={{ ...GLASS.header, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>{headerName}</span>
          <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.32)', fontSize: 13, whiteSpace: 'nowrap' }}>{headerDesc}</span>
          {activeTicket && (
            <>
              <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px', flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, whiteSpace: 'nowrap' }}>
                {catOf(activeTicket.category).label} · #{activeTicket.id} · erstellt {timeAgo(activeTicket.updated_at)}
              </span>
            </>
          )}
          {activeTicket && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{ background: PRIORITY[activeTicket.priority].color + '1a', color: PRIORITY[activeTicket.priority].color, border: `1px solid ${PRIORITY[activeTicket.priority].color}33`, borderRadius: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px' }}>
                {PRIORITY[activeTicket.priority].label}
              </span>
              <span style={{ background: STATUS[activeTicket.status].bg, color: STATUS[activeTicket.status].text, borderRadius: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS[activeTicket.status].dot, display: 'inline-block' }} />
                {STATUS[activeTicket.status].label}
              </span>
              <button onClick={() => setInfoOpen(v => !v)}
                style={{ background: infoOpen ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: infoOpen ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', padding: '4px 12px', transition: 'all 0.1s' }}>
                Ticket-Info
              </button>
            </div>
          )}
        </div>

        {/* ── Ticket-Chat ────────────────────────────────────────────────────── */}
        {activeTicket && user && (
          <TicketChat ticket={activeTicket} currentUserId={user.id} infoOpen={infoOpen} setInfoOpen={setInfoOpen} />
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
                <button onClick={() => setActiveAndScroll('new')} style={{ background: '#5865f2', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  Neues Ticket erstellen
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Neues Ticket ───────────────────────────────────────────────────── */}
        {active === 'new' && (
          <div className="support-scroll" style={{ flex: 1, padding: '28px 32px' }}>
            {!user ? (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <p style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Anmelden erforderlich</p>
                <Link href="/login" style={{ background: '#5865f2', color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 600, fontSize: 14, display: 'inline-block' }}>Anmelden</Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 28, alignItems: 'start' }}>

                {/* ── Linke Spalte: Formular ── */}
                <div>
                  <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Neues Ticket</h2>

                  {/* Kategorie */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Kategorie</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
                      {CATS.map(c => {
                        const sel = fCategory === c.key
                        return (
                          <button key={c.key} onClick={() => switchCategory(c.key)} style={{
                            background: sel ? `${c.color}18` : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${sel ? c.color + '55' : 'rgba(255,255,255,0.07)'}`,
                            borderRadius: 8, padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                            transition: 'all 0.13s',
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, marginBottom: 6, boxShadow: sel ? `0 0 7px ${c.color}99` : 'none' }} />
                            <p style={{ color: sel ? c.color : '#e2e4ea', fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{c.label}</p>
                            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, lineHeight: 1.4 }}>{c.desc}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Kategorie-spezifische Felder */}
                  {fCategory && (
                    <div style={{ marginBottom: 16 }}>
                      <CategoryFields category={fCategory} extra={fExtra} setExtra={setFExtra} inputStyle={GLASS.input} />
                    </div>
                  )}

                  {/* Target Player (complaint / player_report) */}
                  {selectedCat.needsTarget && (
                    <div style={{ marginBottom: 16, position: 'relative' }}>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Betroffener Spieler</p>
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
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Betreff</p>
                    <input value={fSubject} onChange={e => setFSubj(e.target.value)} placeholder="Kurze Zusammenfassung..." style={GLASS.input} />
                  </div>

                  {/* Nachricht */}
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Nachricht</p>
                    <textarea value={fMessage} onChange={e => setFMsg(e.target.value)} rows={6}
                      placeholder="Beschreibe dein Anliegen so genau wie möglich..."
                      style={{ ...GLASS.input, display: 'block', resize: 'none', fontFamily: 'inherit' }} />
                  </div>

                  {/* Priorität — nicht bei Clan-Bewerbung */}
                  {fCategory !== 'clan_application' && (
                    <div style={{ marginBottom: 24 }}>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Priorität</p>
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
                  )}

                  {submitError && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 14 }}>{submitError}</p>}

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={submit} disabled={submitting}
                      style={{ background: '#5865f2', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: submitting ? 0.45 : 1 }}>
                      {submitting ? 'Wird gesendet...' : 'Ticket erstellen'}
                    </button>
                    <button onClick={() => setActiveAndScroll(null)} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}>
                      Abbrechen
                    </button>
                  </div>
                </div>

                {/* ── Rechte Spalte: Kontextueller Hilfe-Block ── */}
                <div style={{ position: 'sticky', top: 0 }}>
                  <CategoryHelp category={fCategory} />
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── Archiv ───────────────────────────────────────────────────────────── */}
        {active === 'archive' && (
          <div className="support-scroll" style={{ flex: 1, padding: '32px 36px' }}>
            <div style={{ maxWidth: 660 }}>
              <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Archiv</h2>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginBottom: 24 }}>Archivierte, geschlossene Tickets.</p>
              {archivedTickets.length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>Noch keine archivierten Tickets.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {archivedTickets.map(t => {
                    const cat = catOf(t.category)
                    return (
                      <div key={t.id}
                        onClick={() => setActiveAndScroll(t.id)}
                        style={{ ...GLASS.card, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.07)'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.color, flexShrink: 0, opacity: 0.6 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: '#e2e4ea', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</p>
                          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 1 }}>{cat.label} · archiviert {timeAgo(t.archived_at!)}</p>
                        </div>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>→</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
        {active === 'faq' && (
          <div className="support-scroll" style={{ flex: 1, padding: '32px 36px' }}>
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
                  <button onClick={() => setActiveAndScroll('new')} style={{ background: '#5865f2', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
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