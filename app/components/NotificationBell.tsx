'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

type Notification = {
  id: number
  category: 'system' | 'friends' | 'leadership'
  title: string
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

const TABS: { key: Notification['category']; label: string; icon: string }[] = [
  { key: 'system', label: 'System', icon: '⚙️' },
  { key: 'friends', label: 'Freunde', icon: '👥' },
  { key: 'leadership', label: 'Leitung', icon: '🛡️' },
]

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'gerade eben'
  if (min < 60) return `vor ${min} Min.`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  return `vor ${days} Tag${days === 1 ? '' : 'en'}`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [activeTab, setActiveTab] = useState<Notification['category']>('system')
  const ref = useRef<HTMLDivElement>(null)

  const load = () => {
    // Stößt zuerst kurz den Trust-Check an (ersetzt den früheren Vercel-Cron-Job),
    // bevor die eigentlichen Benachrichtigungen geladen werden. Schlägt der Check
    // mal fehl, werden trotzdem ganz normal die vorhandenen Benachrichtigungen geladen.
    fetch('/api/cron/check-new-trusts').catch(() => {}).finally(() => {
      fetch('/api/notifications')
        .then(r => r.json())
        .then(data => setNotifications(data.notifications || []))
    })
  } 

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000) // alle 15s nach neuen Benachrichtigungen schauen
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length
  const hasUnread = unreadCount > 0

  const markAsRead = async (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
  }

  const filtered = notifications.filter(n => n.category === activeTab)
  const unreadByTab = (cat: Notification['category']) => notifications.filter(n => n.category === cat && !n.read).length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative text-lg px-1"
        style={{ color: 'var(--muted)' }}
        aria-label="Benachrichtigungen"
      >
        <span style={hasUnread ? { animation: 'bell-glow 1.5s ease-in-out infinite' } : undefined}>✉️</span>
        {hasUnread && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
            style={{ width: 16, height: 16, fontSize: 9, background: '#EF4444' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {hasUnread && (
        <style>{`
          @keyframes bell-glow {
            0%, 100% { filter: drop-shadow(0 0 0px #EF4444); }
            50% { filter: drop-shadow(0 0 6px #EF4444); }
          }
        `}</style>
      )}

      {open && (
        <div className="absolute right-0 mt-2 rounded-xl shadow-lg overflow-hidden z-50 border w-96"
          style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>Benachrichtigungen</span>
            {hasUnread && (
              <button onClick={markAllRead} className="text-xs hover:opacity-70" style={{ color: 'var(--muted)' }}>
                Alle als gelesen markieren
              </button>
            )}
          </div>

          <div className="flex" style={{ borderBottom: '1px solid var(--card-border)' }}>
            {TABS.map(tab => {
              const count = unreadByTab(tab.key)
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex-1 text-xs font-medium py-2.5 transition flex items-center justify-center gap-1"
                  style={activeTab === tab.key
                    ? { color: '#16A34A', borderBottom: '2px solid #16A34A' }
                    : { color: 'var(--muted)' }}
                >
                  {tab.icon} {tab.label}
                  {count > 0 && (
                    <span className="rounded-full text-white font-bold flex items-center justify-center"
                      style={{ width: 14, height: 14, fontSize: 8, background: '#EF4444' }}>
                      {count > 9 ? '9' : count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Keine Benachrichtigungen.</p>
            ) : (
              filtered.map(n => {
                const content = (
                  <div
                    className="px-4 py-3 transition cursor-pointer"
                    style={{ background: n.read ? 'transparent' : 'rgba(22,163,74,0.06)', borderBottom: '1px solid var(--card-border)' }}
                    onClick={() => { if (!n.read) markAsRead(n.id); setOpen(false) }}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#16A34A' }} />}
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{n.title}</p>
                        {n.body && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{n.body}</p>}
                        <p className="text-xs mt-1" style={{ color: 'var(--muted)', opacity: 0.7 }}>{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                )
                return n.link ? (
                  <Link key={n.id} href={n.link} className="block hover:opacity-90">{content}</Link>
                ) : (
                  <div key={n.id}>{content}</div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}