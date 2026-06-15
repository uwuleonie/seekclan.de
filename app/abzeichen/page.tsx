'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'

type Badge = {
  id: string
  name: string
  icon_url: string
  erreichbar: boolean
}

type Member = {
  id: string
  display_name: string
  role: string
  join_date: string
  stufe_override: number | null
  badges: Badge[]
}

const STUFEN = [
  { name: 'Neuling',         min: 0    },
  { name: 'Mitglied',        min: 90   },
  { name: 'Treues Mitglied', min: 180  },
  { name: 'Vertrauter',      min: 365  },
  { name: 'Goat',            min: 730  },
  { name: 'OG',              min: 1095 },
]

const SUPABASE_URL = 'https://lgvrborqklwfbkgbjnvs.supabase.co/storage/v1/object/public/badge-icons'

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function dateForStufe(joinDate: string, stufeIndex: number) {
  const d = new Date(joinDate)
  d.setDate(d.getDate() + STUFEN[stufeIndex].min)
  return d
}

function formatDate(d: Date) {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getCurrentStufe(joinDate: string, override: number | null): number {
  if (override !== null && override >= 0 && override <= 5) return override
  const days = daysSince(joinDate)
  for (let i = STUFEN.length - 1; i >= 0; i--) {
    if (days >= STUFEN[i].min) return i
  }
  return 0
}

export default function AbzeichenPage() {
  const { user } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [allBadges, setAllBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)
  const [focusIndex, setFocusIndex] = useState(0)

  useEffect(() => {
    Promise.all([
      fetch('/api/clan/members').then(r => r.json()),
      fetch('/api/badges').then(r => r.json()),
    ]).then(([membersData, badgesData]) => {
      setMembers(membersData.members || [])
      setAllBadges(badgesData.badges || [])
      setLoading(false)
    })
  }, [])

  const me = members.find(m => m.display_name === user?.username)
  const currentStufe = me ? getCurrentStufe(me.join_date, me.stufe_override) : -1
  const myBadgeIds = new Set(me?.badges?.map(b => b.id) || [])

  useEffect(() => {
    if (currentStufe >= 0) setFocusIndex(currentStufe)
  }, [currentStufe])

  let progressPercent = 100
  let daysToNext = 0
  let nextStufeName = ''
  if (me && currentStufe < STUFEN.length - 1) {
    const days = daysSince(me.join_date)
    const curMin = STUFEN[currentStufe].min
    const nextMin = STUFEN[currentStufe + 1].min
    progressPercent = Math.min(100, Math.max(0, ((days - curMin) / (nextMin - curMin)) * 100))
    daysToNext = Math.max(0, nextMin - days)
    nextStufeName = STUFEN[currentStufe + 1].name
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Laden...</div>

  const visibleIndexes = [focusIndex - 1, focusIndex, focusIndex + 1].filter(i => i >= 0 && i < STUFEN.length)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <Link href="/clan" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück zum Clan</Link>

        <h1 className="text-4xl font-bold mb-2 text-gray-900">Abzeichen</h1>

        {!me ? (
          <div className="bg-red-200 border-2 border-red-400 rounded-2xl px-6 py-4 mb-8">
            <p className="text-gray-900 font-medium">Nicht eingeloggt oder Minecraft nicht verknüpft</p>
            <p className="text-gray-700 text-sm mt-1">Logge dich ein und verknüpfe deinen Minecraft-Account, um deinen Fortschritt zu sehen. Unten siehst du alle Stufen im Überblick.</p>
          </div>
        ) : (
          <p className="text-gray-500 mb-8">Du bist seit {daysSince(me.join_date)} Tagen im Clan — aktuelle Stufe: <span className="font-medium text-gray-700">{STUFEN[currentStufe].name}</span></p>
        )}

        {/* Fortschrittsbalken */}
        {me && currentStufe < STUFEN.length - 1 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs text-gray-400 w-14">Stufe {currentStufe}</span>
              <div className="flex-1 h-3.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(124,58,237,0.12)', boxShadow: '0 0 16px rgba(124,58,237,0.45), inset 0 0 4px rgba(124,58,237,0.2)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(135deg,#4F46E5,#7C3AED,#C026D3)',
                    boxShadow: '0 0 20px rgba(124,58,237,0.9), 0 0 8px rgba(192,38,211,0.8)'
                  }} />
              </div>
              <span className="text-xs text-gray-400 w-14 text-right">Stufe {currentStufe + 1}</span>
            </div>
            <p className="text-xs text-gray-400 text-center">noch {daysToNext} Tage bis „{nextStufeName}"</p>
          </div>
        )}

        {/* Stufen-Karussell */}
        <div className="flex items-center justify-center gap-3 mb-16">
          <button onClick={() => setFocusIndex(Math.max(0, focusIndex - 1))}
            disabled={focusIndex === 0}
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 flex-shrink-0 text-2xl text-gray-600 leading-none pb-1">
            ‹
          </button>

          <div className="flex gap-3 items-center">
            {visibleIndexes.map(i => {
              const isCurrent = i === currentStufe
              const isPast = me && i < currentStufe
              const isFuture = me && i > currentStufe
              const reachedDate = me ? dateForStufe(me.join_date, i) : null
              const reached = me && daysSince(me.join_date) >= STUFEN[i].min
              let subtitle = ''
              if (me) {
                if (reached && reachedDate) subtitle = `seit ${formatDate(reachedDate)}`
                else {
                  const d = Math.max(0, STUFEN[i].min - daysSince(me.join_date))
                  subtitle = `noch ${d} Tage`
                }
              } else {
                subtitle = `ab Tag ${STUFEN[i].min}`
              }

              const style: React.CSSProperties = {}
              if (isCurrent) {
                style.background = 'rgba(99,153,34,0.15)'
                style.border = '2px solid #639922'
              } else if (isPast) {
                style.background = 'rgba(136,135,128,0.12)'
                style.border = '2px solid #888780'
              } else if (isFuture) {
                style.background = 'rgba(226,75,74,0.10)'
                style.border = '2px solid #E24B4A'
              } else {
                style.border = '2px solid #d1d5db'
              }

              const isFocus = i === focusIndex

              return (
                <div key={i}
                  className="rounded-2xl text-center transition-all"
                  style={{ ...style, width: isFocus ? 150 : 130, padding: isFocus ? '20px 10px' : '16px 8px' }}>
                  <div className="mx-auto mb-2.5 rounded-xl bg-white flex items-center justify-center"
                    style={{ width: isFocus ? 72 : 60, height: isFocus ? 72 : 60 }}>
                    <img src={`${SUPABASE_URL}/stufe${i}.png`} alt={STUFEN[i].name}
                      style={{ width: isFocus ? 60 : 48, height: isFocus ? 60 : 48 }} />
                  </div>
                  <p className="font-medium text-gray-900" style={{ fontSize: isFocus ? 15 : 13 }}>{STUFEN[i].name}</p>
                  <p className="text-gray-500" style={{ fontSize: 11 }}>{subtitle}</p>
                </div>
              )
            })}
          </div>

          <button onClick={() => setFocusIndex(Math.min(STUFEN.length - 1, focusIndex + 1))}
            disabled={focusIndex === STUFEN.length - 1}
            className="w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-30 flex-shrink-0 text-2xl text-gray-600 leading-none pb-1">
            ›
          </button>
        </div>

        {/* Spezielle Abzeichen */}
        <div>
          <h2 className="text-2xl font-bold mb-2 text-gray-900">Spezielle Abzeichen</h2>
          <p className="text-gray-500 text-sm mb-6">Besondere Auszeichnungen für besondere Errungenschaften.</p>

          {allBadges.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 px-6 py-10 text-center">
              <p className="text-4xl mb-3">🎖️</p>
              <p className="text-gray-500 text-sm">Noch keine speziellen Abzeichen erstellt.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {allBadges.map(badge => {
                const hasIt = myBadgeIds.has(badge.id)
                const style: React.CSSProperties = {}
                if (hasIt) {
                  style.background = 'rgba(99,153,34,0.15)'
                  style.border = '2px solid #639922'
                } else if (!badge.erreichbar) {
                  style.background = 'rgba(226,75,74,0.10)'
                  style.border = '2px solid #E24B4A'
                } else {
                  style.background = 'rgba(136,135,128,0.08)'
                  style.border = '2px solid #888780'
                }

                return (
                  <div key={badge.id}
                    className="rounded-2xl p-6 flex flex-col items-center text-center transition-all"
                    style={style}>
                    <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-3">
                      {badge.icon_url.startsWith('http') ? (
                        <img src={badge.icon_url} alt={badge.name} className="rounded-xl object-contain" style={{ width: 48, height: 48 }} />
                      ) : (
                        <span className="text-4xl">{badge.icon_url}</span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 text-sm">{badge.name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {hasIt ? '✓ Du hast dieses Abzeichen' : badge.erreichbar ? 'Noch erreichbar' : 'Nicht mehr erreichbar'}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}