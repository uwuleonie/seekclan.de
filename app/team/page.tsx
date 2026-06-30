'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Badge = {
  id: string
  name: string
  icon_url: string
}

type Member = {
  id: string
  display_name: string
  role: string
  join_date: string
  discord_tag: string | null
  badges: Badge[]
}

// Nur die Team-Rollen — "Mitglied" gehört zur normalen Clanliste (/clan), nicht hierher.
const TEAM_ROLE_ORDER = ['Owner', 'Admin', 'Mod', 'VIP']

const ROLE_GRADIENT: Record<string, string> = {
  Owner: 'linear-gradient(135deg, #DC2626, #991B1B)',
  Admin: 'linear-gradient(135deg, #EF4444, #B91C1C)',
  Mod: 'linear-gradient(135deg, #F87171, #DC2626)',
  VIP: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)',
}

const ROLE_LABEL: Record<string, { singular: string, plural: string, tagline: string }> = {
  Owner: { singular: 'Owner', plural: 'Owner', tagline: 'Gründung & Gesamtleitung' },
  Admin: { singular: 'Admin', plural: 'Admins', tagline: 'Serververwaltung & Entscheidungen' },
  Mod: { singular: 'Mod', plural: 'Mods', tagline: 'Moderation & Spielerbetreuung' },
  VIP: { singular: 'VIP', plural: 'VIPs', tagline: 'Besondere Unterstützer des Clans' },
}

function getTimeSince(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  if (years > 0) return `${years} Jahr${years !== 1 ? 'e' : ''}`
  if (months > 0) return `${months} Monat${months !== 1 ? 'e' : ''}`
  return `${days} Tag${days !== 1 ? 'e' : ''}`
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/clan/members').then(r => r.json()).then(d => {
      setMembers(d.members || [])
      setLoading(false)
    })
  }, [])

  const grouped = TEAM_ROLE_ORDER.reduce((acc, role) => {
    const roleMembers = members
      .filter(m => m.role.toLowerCase() === role.toLowerCase())
      .sort((a, b) => new Date(a.join_date).getTime() - new Date(b.join_date).getTime())
    if (roleMembers.length > 0) acc[role] = roleMembers
    return acc
  }, {} as Record<string, Member[]>)

  const hasAnyTeamMembers = TEAM_ROLE_ORDER.some(role => grouped[role])

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-5xl mx-auto px-8 py-10">
        <Link href="/" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück</Link>

        {/* Spotlight-Hero */}
        <div
          className="rounded-3xl p-10 mb-12 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}
        >
          <h1 className="text-4xl font-bold mb-3 text-white">Das Team </h1>
          <p className="text-white/85 max-w-xl mx-auto">
                Das Team besteht aktuell aus 10 Mitgliedern.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>Laden...</div>
        ) : !hasAnyTeamMembers ? (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>Noch keine Team-Mitglieder eingetragen.</div>
        ) : (
          <div className="space-y-14">
            {TEAM_ROLE_ORDER.filter(role => grouped[role]).map(role => (
              <div key={role}>
                <div className="text-center mb-6">
                  <span
                    className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-white mb-2"
                    style={{ background: ROLE_GRADIENT[role] }}
                  >
                    {grouped[role].length === 1 ? ROLE_LABEL[role].singular : ROLE_LABEL[role].plural}
                  </span>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>{ROLE_LABEL[role].tagline}</p>
                </div>

                <div className={`grid gap-6 ${grouped[role].length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {grouped[role].map(member => (
                    <div
                      key={member.id}
                      className="rounded-2xl p-1"
                      style={{ background: ROLE_GRADIENT[role] }}
                    >
                      <Link
                        href="/support"
                        className="rounded-2xl p-6 flex flex-col items-center text-center block transition-transform hover:scale-[1.02]"
                        style={{ background: 'var(--card)' }}
                      >
                        <img
                          src={`https://api.creepernation.net/avatar/${member.display_name}/80`}
                          alt={member.display_name}
                          className="w-20 h-20 rounded-2xl mb-4"
                        />
                        <p className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>{member.display_name}</p>
                        <span
                          className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase text-white mb-3"
                          style={{ background: ROLE_GRADIENT[role] }}
                        >
                          {role}
                        </span>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          Im Team seit {getTimeSince(member.join_date)}
                        </p>
                        {member.discord_tag && (
                          <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: 'var(--muted)' }}>
                            <svg className="w-3.5 h-3.5 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.037.05a19.902 19.902 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                            </svg>
                            <span className="font-medium text-indigo-500">{member.discord_tag}</span>
                          </div>
                        )}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-16">
          <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>Die vollständige Mitgliederliste findest du hier:</p>
          <Link href="/clan" className="text-sm font-medium underline" style={{ color: 'var(--muted)' }}>
            Zur Clanliste →
          </Link>
        </div>
      </div>
    </div>
  )
}