'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '../lib/auth-context'
import EventBanner from '../components/EventBanner'

type NavItem = { href: string; label: string; icon: string }

export default function SmpLayout({ children }: { children: React.ReactNode }) {
  console.log('SMPLAYOUT MOUNTED', Math.random())
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [nextEvent, setNextEvent] = useState<any>(null)

  useEffect(() => {
    fetch('/api/smp/events').then(r => r.json()).then(data => {
      setNextEvent((data.events || [])[0] || null)
    })
  }, [])

  const myUsername = user ? ((user as any).minecraft_username || user.username) : null

  const NAV_ITEMS: NavItem[] = [
    ...(myUsername ? [{ href: `/smp/${myUsername}`, label: 'Eigener Bereich', icon: '🏠' }] : []),
    { href: '/smp/livemap', label: 'Livemap', icon: '🗺️' },
    { href: '/smp/statistiken', label: 'Statistiken', icon: '📊' },
    { href: '/smp/leaderboards', label: 'Leaderboards', icon: '🏆' },
    { href: '/smp/claims', label: 'Claims', icon: '📍' },
    { href: '/smp/shulkers', label: 'Shulkerkisten', icon: '📦' },
    { href: '/smp/chat', label: 'Chat', icon: '💬' },
    { href: '/smp/regelwerk', label: 'Regelwerk', icon: '📜' },
  ]

  const isActive = (href: string) => {
    if (href.startsWith('/smp/') && myUsername && href === `/smp/${myUsername}`) {
      return pathname === href
    }
    return pathname === href
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <div className="w-full relative" style={{ background: 'linear-gradient(135deg, #16A34A, #15803D, #166534)' }}>
        <div className="max-w-7xl mx-auto px-8 py-12">
          <h1 className="text-4xl font-bold text-white mb-2">Seek SMP</h1>
          <p className="text-white/80">Alles rund um den SMP-Server.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <EventBanner event={nextEvent} />
      </div>

      <div className="max-w-7xl mx-auto px-8 pb-8 flex gap-6">
        {/* Sidebar */}
        <div
          className="flex-shrink-0 transition-all"
          style={{ width: collapsed ? '56px' : '220px' }}
        >
          <div className="card rounded-2xl p-2 sticky" style={{ top: '24px' }}>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full flex items-center justify-center p-2 mb-1 rounded-xl hover:opacity-70 transition"
              style={{ color: 'var(--muted)' }}
              title={collapsed ? 'Ausklappen' : 'Einklappen'}
            >
              {collapsed ? '»' : '«'}
            </button>
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map(item => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-sm transition-all text-left"
                  style={isActive(item.href)
                    ? { background: '#16A34A', color: 'white' }
                    : { background: 'transparent', color: 'var(--muted)' }}
                  title={item.label}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="whitespace-nowrap overflow-hidden">{item.label}</span>}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Inhalt */}
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
