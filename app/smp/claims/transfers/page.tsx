'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../lib/auth-context'

type Transfer = {
  id: number
  groupId: number
  groupName: string
  senderName: string
  chunkCount: number
  createdAt: string
  expiresAt: string
}

function timeLeft(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Abgelaufen'
  const hours = Math.floor(ms / (1000 * 60 * 60))
  return `noch ca. ${hours}h`
}

export default function TransfersPage() {
  const { user } = useAuth()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [keepPermissions, setKeepPermissions] = useState<Record<number, boolean>>({})
  const [respondingId, setRespondingId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/smp/transfers')
      .then(r => r.json())
      .then(data => {
        const list: Transfer[] = data.transfers || []
        setTransfers(list)
        setKeepPermissions(Object.fromEntries(list.map(t => [t.id, true])))
        setLoading(false)
      })
  }

  useEffect(() => {
    if (user) load()
  }, [user])

  const respond = async (id: number, action: 'accept' | 'decline') => {
    setRespondingId(id)
    await fetch(`/api/smp/transfers/${id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, keepPermissions: keepPermissions[id] }),
    })
    setRespondingId(null)
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
    <div className="space-y-4">
      <Link href="/smp/claims" className="text-sm flex items-center gap-1 hover:opacity-70" style={{ color: 'var(--muted)' }}>
        ← Zurück zu deinen Claims
      </Link>

      <div className="card rounded-2xl p-6">
        <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>📨 Übertragungsanfragen ({transfers.length})</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Andere Spieler können dir Gruppen mit allen Chunks übertragen. Anfragen verfallen nach 96 Stunden automatisch.
        </p>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Lädt...</p>
        ) : transfers.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Keine offenen Anfragen.</p>
        ) : (
          <div className="space-y-3">
            {transfers.map(t => (
              <div key={t.id} className="rounded-xl p-4" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                <p className="font-medium text-sm mb-1" style={{ color: 'var(--foreground)' }}>
                  🗂️ {t.groupName} <span style={{ color: 'var(--muted)' }}>von {t.senderName}</span>
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                  {t.chunkCount} Chunk{t.chunkCount === 1 ? '' : 's'} · {timeLeft(t.expiresAt)}
                </p>

                <label className="flex items-center gap-2 text-xs mb-3 cursor-pointer" style={{ color: 'var(--foreground)' }}>
                  <input
                    type="checkbox"
                    checked={keepPermissions[t.id] ?? true}
                    onChange={e => setKeepPermissions(prev => ({ ...prev, [t.id]: e.target.checked }))}
                  />
                  Individuelle Rechte &amp; vertraute Spieler dieser Gruppe übernehmen
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() => respond(t.id, 'decline')}
                    disabled={respondingId === t.id}
                    className="flex-1 text-xs font-medium py-2 rounded-lg disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                  >
                    Ablehnen
                  </button>
                  <button
                    onClick={() => respond(t.id, 'accept')}
                    disabled={respondingId === t.id}
                    className="flex-1 text-xs font-medium py-2 rounded-lg disabled:opacity-50"
                    style={{ background: '#16A34A', color: 'white' }}
                  >
                    {respondingId === t.id ? '...' : 'Annehmen'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}