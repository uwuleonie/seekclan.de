'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'
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
  stufe_override: number | null
}

const ROLE_ORDER = ['Owner', 'Admin', 'VIP', 'Mod', 'Mitglied']

const ROLE_COLORS: Record<string, string> = {
  Owner: 'bg-red-900 text-white',
  Admin: 'bg-red-700 text-white',
  VIP: 'bg-purple-600 text-white',
  Mod: 'bg-red-500 text-white',
  Mitglied: 'bg-green-400 text-white',
}

const ROLE_GLOW: Record<string, string> = {
  Owner: 'shadow-lg shadow-red-800/60 border-2 border-red-900/40',
  Admin: 'shadow-lg shadow-red-500/60 border-2 border-red-700/40',
  VIP: 'shadow-lg shadow-purple-600/60 border-2 border-purple-600/60',
  Mod: 'shadow-lg shadow-red-300/60 border-2 border-red-500/40',
  Mitglied: 'shadow-lg shadow-green-400/60 border-2 border-green-400/60',
}

const ROLE_LABEL: Record<string, { singular: string, plural: string }> = {
  Owner: { singular: 'Owner', plural: 'Owner' },
  Admin: { singular: 'Admin', plural: 'Admins' },
  VIP: { singular: 'VIP', plural: 'VIPs' },
  Mod: { singular: 'Mod', plural: 'Mods' },
  Mitglied: { singular: 'Mitglied', plural: 'Mitglieder' },
}

const STUFEN = [
  { name: 'Neuling', min: 0, max: 90 },
  { name: 'Mitglied', min: 90, max: 180 },
  { name: 'Treues Mitglied', min: 180, max: 365 },
  { name: 'Vertrauter', min: 365, max: 730 },
  { name: 'Goat', min: 730, max: 1095 },
  { name: 'OG', min: 1095, max: Infinity },
]

const SUPABASE_URL = '/api/uploads/badge-icons'

function getStufe(joinDate: string, override: number | null): number {
  if (override !== null && override >= 0 && override <= 5) return override
  const days = Math.floor((Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24))
  for (let i = STUFEN.length - 1; i >= 0; i--) {
    if (days >= STUFEN[i].min) return i
  }
  return 0
}

function getTimeSince(dateStr: string) {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  const remainingDays = days % 30
  const parts = []
  if (years > 0) parts.push(`${years} Jahr${years !== 1 ? 'e' : ''}`)
  if (months > 0) parts.push(`${months} Monat${months !== 1 ? 'e' : ''}`)
  if (remainingDays > 0) parts.push(`${remainingDays} Tag${remainingDays !== 1 ? 'e' : ''}`)
  return parts.join(' ') || '0 Tage'
}

export default function ClanPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [sortierung, setSortierung] = useState<'az' | 'zeit'>('zeit')
  const { user } = useAuth()

  useEffect(() => {
    fetch('/api/clan/members').then(r => r.json()).then(d => {
      setMembers(d.members || [])
      setLoading(false)
    })
  }, [])

  const sorted = [...members].sort((a, b) =>
    sortierung === 'az'
      ? a.display_name.localeCompare(b.display_name)
      : new Date(a.join_date).getTime() - new Date(b.join_date).getTime()
  )

  const grouped = ROLE_ORDER.reduce((acc, role) => {
    const roleMembers = sorted.filter(m => m.role.toLowerCase() === role.toLowerCase())
    if (roleMembers.length > 0) acc[role] = roleMembers
    return acc
  }, {} as Record<string, Member[]>)

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-6xl mx-auto px-8 py-10">
        <Link href="/" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück</Link>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-bold" style={{ color: 'var(--foreground)' }}>Der Clan</h1>
          <div className="flex rounded-xl overflow-hidden text-sm border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
            <button onClick={() => setSortierung('zeit')}
              className={`px-4 py-2 font-medium transition-all ${sortierung === 'zeit' ? 'bg-gray-900 dark:bg-white wine:bg-red-900 navy:bg-blue-900 text-white dark:text-gray-900 wine:text-white navy:text-white' : ''}`}
              style={sortierung === 'zeit' ? {} : { color: 'var(--muted)' }}>
              Zeit im Clan
            </button>
            <button onClick={() => setSortierung('az')}
              className={`px-4 py-2 font-medium transition-all ${sortierung === 'az' ? 'bg-gray-900 dark:bg-white wine:bg-red-900 navy:bg-blue-900 text-white dark:text-gray-900 wine:text-white navy:text-white' : ''}`}
              style={sortierung === 'az' ? {} : { color: 'var(--muted)' }}>
              A → Z
            </button>
          </div>
        </div>
        <p className="mb-10" style={{ color: 'var(--muted)' }}>Hier findest du alle aktiven Mitglieder im seek-clan.</p>

        {loading ? (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>Laden...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>Noch keine Mitglieder eingetragen.</div>
        ) : (
          <div className="space-y-10">
            {ROLE_ORDER.filter(role => grouped[role]).map(role => (
              <div key={role}>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${ROLE_COLORS[role]}`}>{role}</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--card-border)' }} />
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{grouped[role].length} {grouped[role].length !== 1 ? ROLE_LABEL[role].plural : ROLE_LABEL[role].singular}</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {grouped[role].map(member => {
                    const stufeIndex = getStufe(member.join_date, member.stufe_override)
                    const stufe = STUFEN[stufeIndex] ?? STUFEN[0]
                    return (
                      <Link href="/support" key={member.id}
                        className={`rounded-2xl p-5 shadow-md border-2 transition-all hover:shadow-lg block ${ROLE_GLOW[role]}`}
                        style={{ background: 'var(--card)' }}>
                        <div className="flex items-center gap-3 mb-3">
                          <img src={`https://mc-heads.net/avatar/${member.display_name}/48`} alt={member.display_name} className="w-12 h-12 rounded-xl" />
                          <div className="flex-1">
                            <p className="font-bold" style={{ color: 'var(--foreground)' }}>{member.display_name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${ROLE_COLORS[role]}`}>{role}</span>
                          </div>
                          <Link href={`/${member.display_name}/abzeichen`} title={stufe.name} onClick={e => e.stopPropagation()}>
                            <img src={`${SUPABASE_URL}/stufe${stufeIndex}.png`} alt={stufe.name} className="w-10 h-10 hover:scale-110 transition-transform cursor-pointer" />
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                          <span>📅</span>
                          <span>Im Clan seit: <span className="font-medium" style={{ color: 'var(--foreground)' }}>{getTimeSince(member.join_date)}</span></span>
                        </div>
                        {member.discord_tag && (
                          <div className="flex items-center gap-2 text-sm mt-1" style={{ color: 'var(--muted)' }}>
                            <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.037.05a19.902 19.902 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                            </svg>
                            <span className="font-medium text-indigo-500">{member.discord_tag}</span>
                          </div>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}