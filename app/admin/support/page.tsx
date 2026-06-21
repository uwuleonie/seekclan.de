'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../lib/auth-context'

type Ticket = {
  id: number
  category: string
  subject: string
  priority: 'low' | 'normal' | 'high'
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
  creator?: { username: string } | null
  target_user?: { username: string } | null
  target_badge?: { name: string } | null
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  bug: { label: 'Bug-Report', icon: '🐛' },
  clan_application: { label: 'Clan-Beitrittsanfrage', icon: '📝' },
  complaint: { label: 'Beschwerde', icon: '⚠️' },
  suggestion: { label: 'Vorschlag', icon: '💡' },
  missing_badge: { label: 'Abzeichen fehlt', icon: '🏅' },
  whitelist: { label: 'Whitelist/Zugangsproblem', icon: '🔒' },
  rollback_request: { label: 'Rollback-Anfrage', icon: '⏪' },
  player_report: { label: 'Spieler melden', icon: '🚩' },
  account_link: { label: 'Konto-Verknüpfung', icon: '🔗' },
  other: { label: 'Sonstiges', icon: '❓' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: 'Offen', color: '#EAB308' },
  in_progress: { label: 'In Bearbeitung', color: '#3B82F6' },
  closed: { label: 'Geschlossen', color: 'var(--muted)' },
}

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Niedrig', color: 'var(--muted)' },
  normal: { label: 'Normal', color: '#3B82F6' },
  high: { label: 'Hoch', color: '#EF4444' },
}

export default function AdminSupportPage() {
  const { user, loading: authLoading } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('open')

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

  if (authLoading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Laden...</div>

  if (!user || (user.clan_role?.toLowerCase() !== 'admin' && user.clan_role?.toLowerCase() !== 'mod')) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <p className="text-4xl mb-4">🚫</p>
          <p className="font-bold text-xl mb-2" style={{ color: 'var(--foreground)' }}>Kein Zugriff</p>
          <Link href="/" className="btn-gradient text-white px-6 py-3 rounded-xl">Zur Startseite</Link>
        </div>
      </div>
    )
  }

  const filtered = statusFilter === 'all' ? tickets : tickets.filter(t => t.status === statusFilter)

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-4xl mx-auto px-8 py-10">
        <Link href="/admin" className="text-sm flex items-center gap-1 mb-6 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zum Admin-Panel</Link>

        <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>🎫 Support-Tickets</h1>

        <div className="flex gap-2 mb-4">
          {['open', 'in_progress', 'closed', 'all'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition"
              style={statusFilter === s
                ? { background: '#16A34A', color: 'white' }
                : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
              {s === 'all' ? 'Alle' : STATUS_LABELS[s].label}
            </button>
          ))}
        </div>

        <div className="card rounded-2xl p-6">
          {loading ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Keine Tickets in dieser Ansicht.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(t => {
                const cat = CATEGORY_LABELS[t.category]
                const status = STATUS_LABELS[t.status]
                const prio = PRIORITY_LABELS[t.priority]
                return (
                  <Link key={t.id} href={`/admin/support/${t.id}`} className="block rounded-xl p-3 transition hover:opacity-80"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                        {cat?.icon} {t.subject}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${prio.color}22`, color: prio.color }}>{prio.label}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${status.color}22`, color: status.color }}>{status.label}</span>
                      </div>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      {cat?.label} · von {t.creator?.username}
                      {t.target_user && ` · betrifft ${t.target_user.username}`}
                      {t.target_badge && ` · Abzeichen: ${t.target_badge.name}`}
                      {' · '}{new Date(t.created_at).toLocaleDateString('de-DE')}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}