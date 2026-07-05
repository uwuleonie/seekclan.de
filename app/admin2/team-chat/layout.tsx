'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../../lib/auth-context'

type Tag = { id: string, name: string, color: string }
type ConceptSummary = { id: string, title: string, isFinished: boolean, tags: Tag[] }

const TEAM_CHANNELS = [
  { slug: 'admin-chat', label: 'admin-chat', icon: '🔒', adminOnly: true },
  { slug: 'team-lounge', label: 'team-lounge', icon: '#', adminOnly: false },
]

export default function TeamChatLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const [concepts, setConcepts] = useState<ConceptSummary[]>([])

  useEffect(() => {
    fetch('/api/admin2/concepts')
      .then(r => r.json())
      .then(data => setConcepts((data.concepts || []).filter((c: any) => !c.isFinished)))
  }, [])

  const isAdmin = user?.clan_role === 'administrator' || user?.clan_role === 'owner'
  const visibleChannels = TEAM_CHANNELS.filter(c => !c.adminOnly || isAdmin)

  return (
    <div className="fixed inset-0 flex" style={{ background: 'var(--background)' }}>
      {/* Mini-Sidebar: Bereiche + Team-Chats + Konzept-Chats, wie im Team-Hub-Konzept */}
      <div className="w-64 flex-shrink-0 overflow-y-auto p-4" style={{ borderRight: '1px solid var(--card-border)' }}>
        <Link href="/admin2" className="text-sm hover:opacity-70 transition-all inline-block mb-4" style={{ color: 'var(--muted)' }}>
          ← Admin2
        </Link>

        <h2 className="text-xs font-bold mb-2 px-1" style={{ color: 'var(--muted)' }}>BEREICHE</h2>
        <div className="space-y-1 mb-6">
          <Link href="/admin2/notizen"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
            style={{ color: 'var(--foreground)' }}>
            <span className="w-4 text-center flex-shrink-0">📌</span>
            Schwarzes Brett
          </Link>
        </div>

        <h2 className="text-xs font-bold mb-2 px-1" style={{ color: 'var(--muted)' }}>TEAM-CHATS</h2>
        <div className="space-y-1 mb-6">
          {visibleChannels.map(ch => {
            const active = pathname === `/admin2/team-chat/${ch.slug}`
            return (
              <Link key={ch.slug} href={`/admin2/team-chat/${ch.slug}`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
                style={active
                  ? { background: '#7C3AED22', color: '#7C3AED' }
                  : { color: 'var(--foreground)' }}>
                <span className="w-4 text-center flex-shrink-0">{ch.icon}</span>
                {ch.label}
              </Link>
            )
          })}
        </div>

        <h2 className="text-xs font-bold mb-2 px-1" style={{ color: 'var(--muted)' }}>KONZEPT-CHATS</h2>
        <div className="space-y-1">
          {concepts.length === 0 ? (
            <p className="text-xs px-3" style={{ color: 'var(--muted)' }}>Keine aktiven Konzepte.</p>
          ) : concepts.map(c => {
            const active = pathname === `/admin2/team-chat/konzept/${c.id}`
            return (
            <Link key={c.id} href={`/admin2/team-chat/konzept/${c.id}`}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:opacity-80"
              style={active ? { background: '#7C3AED22', color: '#7C3AED' } : { color: 'var(--foreground)' }}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-4 text-center flex-shrink-0" style={{ color: active ? '#7C3AED' : 'var(--muted)' }}>#</span>
                <span className="truncate">{c.title}</span>
              </span>
              {c.tags[0] && (
                <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: `${c.tags[0].color}22`, color: c.tags[0].color }}>
                  {c.tags[0].name}
                </span>
              )}
            </Link>
          )})}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}