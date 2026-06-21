'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

type Ticket = {
  id: number
  category: string
  subject: string
  priority: 'low' | 'normal' | 'high'
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
  updated_at: string
  target_user?: { username: string } | null
  target_badge?: { name: string } | null
}

const CATEGORIES: { key: string; label: string; icon: string; needsTarget?: 'player' | 'badge' }[] = [
  { key: 'bug', label: 'Bug-Report', icon: '🐛' },
  { key: 'clan_application', label: 'Clan-Beitrittsanfrage', icon: '📝' },
  { key: 'complaint', label: 'Beschwerde', icon: '⚠️', needsTarget: 'player' },
  { key: 'suggestion', label: 'Vorschlag', icon: '💡' },
  { key: 'missing_badge', label: 'Abzeichen fehlt', icon: '🏅', needsTarget: 'badge' },
  { key: 'whitelist', label: 'Whitelist/Zugangsproblem', icon: '🔒' },
  { key: 'rollback_request', label: 'Rollback-Anfrage', icon: '⏪' },
  { key: 'player_report', label: 'Spieler melden', icon: '🚩', needsTarget: 'player' },
  { key: 'account_link', label: 'Konto-Verknüpfung', icon: '🔗' },
  { key: 'other', label: 'Sonstiges', icon: '❓' },
]

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Offen', color: '#EAB308' },
  in_progress: { label: 'In Bearbeitung', color: '#3B82F6' },
  closed: { label: 'Geschlossen', color: 'var(--muted)' },
}

type PlayerOption = { uuid: string; player_name: string }

export default function SupportPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [category, setCategory] = useState('bug')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [targetUsername, setTargetUsername] = useState('')
  const [targetSuggestions, setTargetSuggestions] = useState<PlayerOption[]>([])
  const [targetFocused, setTargetFocused] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState<PlayerOption | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (targetUsername.trim().length < 2) {
      setTargetSuggestions([])
      return
    }
    const timeout = setTimeout(() => {
      fetch(`/api/smp/players-search?q=${encodeURIComponent(targetUsername.trim())}`)
        .then(r => r.json())
        .then(data => setTargetSuggestions(data.players || []))
    }, 200)
    return () => clearTimeout(timeout)
  }, [targetUsername])

  const load = () => {
    setLoading(true)
    fetch('/api/support/tickets')
      .then(r => r.json())
      .then(data => {
        setTickets(data.tickets || [])
        setLoading(false)
      })
  }

  useEffect(() => { if (user) load() }, [user])

  const selectedCategory = CATEGORIES.find(c => c.key === category)

  const submit = async () => {
    if (!subject.trim() || !message.trim()) return
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category, subject, message, priority,
        targetUsername: selectedCategory?.needsTarget === 'player' ? selectedTarget?.player_name : undefined,
      }),
    })
    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Fehler beim Erstellen')
      return
    }
    setSubject('')
    setMessage('')
    setTargetUsername('')
    setSelectedTarget(null)
    setShowForm(false)
    load()
  }

  if (!user) {
    return (
      <div className="card rounded-2xl p-12 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-bold" style={{ color: 'var(--foreground)' }}>Du musst eingeloggt sein.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>🎫 Support</h1>
        <button onClick={() => setShowForm(prev => !prev)}
          className="text-sm font-medium px-4 py-2 rounded-lg" style={{ background: '#16A34A', color: 'white' }}>
          {showForm ? 'Abbrechen' : '➕ Neues Ticket'}
        </button>
      </div>

      {showForm && (
        <div className="card rounded-2xl p-6 space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Kategorie</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
            </select>
          </div>

          {selectedCategory?.needsTarget === 'player' && (
            <div className="relative">
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Betroffener Spieler (optional)</label>
              {selectedTarget ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid #16A34A' }}>
                  <span className="text-sm font-medium flex items-center gap-2" style={{ color: '#16A34A' }}>
                    <img src={`https://mc-heads.net/avatar/${selectedTarget.player_name}/24`} alt="" className="w-6 h-6 rounded flex-shrink-0" />
                    {selectedTarget.player_name}
                  </span>
                  <button onClick={() => { setSelectedTarget(null); setTargetUsername('') }} className="text-xs hover:opacity-70" style={{ color: '#16A34A' }}>
                    Ändern
                  </button>
                </div>
              ) : (
                <input type="text" value={targetUsername} onChange={e => setTargetUsername(e.target.value)} onFocus={() => setTargetFocused(true)} onBlur={() => setTimeout(() => setTargetFocused(false), 150)}
                  placeholder="Spielername eingeben..."
                  className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
              )}

              {targetFocused && !selectedTarget && targetSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-10" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                  {targetSuggestions.map(p => (
                    <button
                      key={p.uuid}
                      onClick={() => { setSelectedTarget(p); setTargetFocused(false) }}
                      className="w-full text-left px-3 py-1.5 text-sm transition flex items-center gap-2"
                      style={{ color: 'var(--foreground)' }}
                    >
                      <img src={`https://mc-heads.net/avatar/${p.player_name}/24`} alt="" className="w-6 h-6 rounded flex-shrink-0" />
                      {p.player_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Betreff</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Kurze Zusammenfassung..."
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Nachricht</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              placeholder="Beschreibe dein Anliegen..."
              className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--muted)' }}>Priorität</label>
            <select value={priority} onChange={e => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
              <option value="low">Niedrig</option>
              <option value="normal">Normal</option>
              <option value="high">Hoch</option>
            </select>
          </div>

          {error && <p className="text-xs" style={{ color: '#EF4444' }}>{error}</p>}

          <button onClick={submit} disabled={!subject.trim() || !message.trim() || submitting}
            className="w-full text-sm font-medium py-2.5 rounded-lg disabled:opacity-40" style={{ background: '#16A34A', color: 'white' }}>
            {submitting ? 'Wird gesendet...' : 'Ticket erstellen'}
          </button>
        </div>
      )}

      <div className="card rounded-2xl p-6">
        <h2 className="font-bold text-sm mb-3" style={{ color: 'var(--foreground)' }}>Deine Tickets ({tickets.length})</h2>
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Tickets erstellt.</p>
        ) : (
          <div className="space-y-2">
            {tickets.map(t => {
              const cat = CATEGORIES.find(c => c.key === t.category)
              const status = STATUS_LABELS[t.status]
              return (
                <Link key={t.id} href={`/support/${t.id}`} className="block rounded-xl p-3 transition hover:opacity-80"
                  style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                      {cat?.icon} {t.subject}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: `${status.color}22`, color: status.color }}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{cat?.label} · {new Date(t.created_at).toLocaleDateString('de-DE')}</p>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}