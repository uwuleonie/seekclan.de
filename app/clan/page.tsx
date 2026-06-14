'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Member = {
  id: string
  display_name: string
  role: string
  join_date: string
}

const ROLE_ORDER = ['Owner', 'Admin', 'VIP', 'Mod', 'Mitglied']

const ROLE_COLORS: Record<string, string> = {
  Owner: 'bg-red-500 text-white',
  Admin: 'bg-red-400 text-white',
  VIP: 'bg-yellow-500 text-white',
  Mod: 'bg-red-300 text-white',
  Mitglied: 'bg-green-500 text-white',
}

function getTimeSince(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
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

  useEffect(() => {
    fetch('/api/clan/members')
      .then(r => r.json())
      .then(d => {
        setMembers(d.members || [])
        setLoading(false)
      })
  }, [])

  // Nach Rolle gruppieren
  const grouped = ROLE_ORDER.reduce((acc, role) => {
    const roleMembers = members.filter(m => m.role.toLowerCase() === role.toLowerCase())
    if (roleMembers.length > 0) acc[role] = roleMembers
    return acc
  }, {} as Record<string, Member[]>)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-8 py-10">
        <Link href="/" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück</Link>

        <h1 className="text-4xl font-bold mb-2 text-gray-900">Der Clan</h1>
        <p className="text-gray-500 mb-10">Alle aktiven Mitglieder, sortiert nach Rolle.</p>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Laden...</div>
        ) : members.length === 0 ? (
          <div className="text-center text-gray-400 py-20">Noch keine Mitglieder eingetragen.</div>
        ) : (
          <div className="space-y-10">
            {ROLE_ORDER.filter(role => grouped[role]).map(role => (
              <div key={role}>
                {/* Rollen-Header */}
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${ROLE_COLORS[role]}`}>
                    {role}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-gray-400 text-sm">{grouped[role].length} Mitglied{grouped[role].length !== 1 ? 'er' : ''}</span>
                </div>

                {/* Mitglieder Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {grouped[role].map(member => (
                    <div key={member.id}
                      className={`bg-white rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md
                        ${role === 'Owner' ? 'border-red-200' : 'border-gray-100'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={`https://mc-heads.net/avatar/${member.display_name}/48`}
                          alt={member.display_name}
                          className="w-12 h-12 rounded-xl"
                        />
                        <div>
                          <p className="font-bold text-gray-900">{member.display_name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${ROLE_COLORS[role]}`}>
                            {role}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <span>📅</span>
                        <span>Dabei seit: <span className="font-medium text-gray-700">{getTimeSince(member.join_date)}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}