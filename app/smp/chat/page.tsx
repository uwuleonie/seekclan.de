'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../lib/auth-context'

type ChatMessage = {
  id: number
  sender_name: string
  sender_uuid: string | null
  message: string
  source: string
  created_at: string
}

// HINWEIS (Migration): Live-Updates liefen früher über Supabase Realtime
// (supabase.channel(...).on('postgres_changes', ...)). Das gibt es mit der eigenen
// Postgres-Instanz nicht mehr automatisch. Bis ein eigener Realtime-Ersatz (z.B. ein
// schlanker WebSocket-Server) steht, holen wir neue Nachrichten per einfachem Polling.
const POLL_INTERVAL_MS = 5000

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = () => {
      fetch('/api/smp/chat').then(r => r.json()).then(data => {
        setMessages(data.messages || [])
        setLoading(false)
      })
    }

    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim()) return
    setSending(true)
    const res = await fetch('/api/smp/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input.trim() }),
    })
    if (res.ok) setInput('')
    setSending(false)
  }

  return (
    <div className="card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold" style={{ color: 'var(--foreground)' }}>Server-Chat</h2>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>Verbunden mit dem Minecraft-Server</span>
      </div>

      <div className="rounded-xl overflow-y-auto mb-3 p-4 flex flex-col gap-2"
        style={{ height: '380px', background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Nachrichten. Schreib die erste!</p>
        ) : (
          messages.map(m => (
            <div key={m.id} className="flex items-start gap-2">
              <img src={`https://api.creepernation.net/avatar/${m.sender_name}/24`} alt="" className="w-6 h-6 rounded mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{m.sender_name}</span>
                {m.source === 'web' && (
                  <span className="text-xs ml-1.5 px-1.5 py-0.5 rounded" style={{ background: 'rgba(22,163,74,0.15)', color: '#16A34A' }}>Web</span>
                )}
                <span className="text-sm ml-2" style={{ color: 'var(--foreground)' }}>{m.message}</span>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {user ? (
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
            placeholder="Nachricht schreiben..." maxLength={256}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          <button onClick={send} disabled={sending || !input.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
            style={{ background: '#16A34A' }}>
            Senden
          </button>
        </div>
      ) : (
        <p className="text-sm text-center py-2" style={{ color: 'var(--muted)' }}>Du musst eingeloggt sein, um zu schreiben.</p>
      )}
    </div>
  )
}