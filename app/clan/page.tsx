'use client'

// /clan – alle Mitglieder des seek-Clans, nach Rolle gruppiert.
// Aussehen: dunkler Hintergrund mit Farbflecken und Glas-Karten (glassmorphism) wie Startseite und Changelog.
// Styles: app/clan/clan.css (Präfix cn-). Daten: /api/clan/members.
// Ganze Karte → /support, Abzeichen-Bild → /<Name>/abzeichen (zwei Links nebeneinander, kein Link im Link).

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { signatureFont } from '../lib/fonts'
import './clan.css'

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

/** Farbe je Rolle (Rand, Leuchten, Rollen-Schild) */
const ROLE_COLOR: Record<string, string> = {
  Owner: '#dc2626',
  Admin: '#f05252',
  VIP: '#a855f7',
  Mod: '#fb7185',
  Mitglied: '#4ade80',
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

const BADGE_URL = '/api/uploads/badge-icons'

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

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

// Kleine Linien-Icons (keine Emojis)
const Svg = ({ d, size = 16 }: { d: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const ICON = {
  back: <path d="m15 18-6-6 6-6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
}

export default function ClanPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [sortierung, setSortierung] = useState<'az' | 'zeit'>('zeit')

  useEffect(() => {
    fetch('/api/clan/members').then(r => r.json()).then(d => {
      setMembers(d.members || [])
      setLoading(false)
    }).catch(() => setLoading(false))
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

  const oldest = members.length ? [...members].sort((a, b) => new Date(a.join_date).getTime() - new Date(b.join_date).getTime())[0] : null

  return (
    <div className="cn">
      {/* Hintergrund: Farbflecken hinter dem Glas */}
      <div className="cn-bg" aria-hidden="true">
        <span className="cn-blob a" /><span className="cn-blob b" /><span className="cn-blob c" />
      </div>

      <div className="cn-wrap">
        <Link href="/" className="cn-back"><Svg d={ICON.back} /> Zurück</Link>

        {/* Kopf */}
        <header className="cn-glass cn-head">
          <div className="cn-head-text">
            <h1 className="cn-title">Der <span className={`cn-sig ${signatureFont.className}`}>Clan</span></h1>
            <p className="cn-lead">Hier findest du alle aktiven Mitglieder im seek-Clan.</p>
            {members.length > 0 && (
              <div className="cn-stats">
                <span><Svg d={ICON.users} /> {members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'}</span>
                {oldest && <span><Svg d={ICON.clock} /> Dabei seit {fmtDate(oldest.join_date)}</span>}
              </div>
            )}
          </div>
          <div className="cn-seg" role="group" aria-label="Sortierung">
            <button className={sortierung === 'zeit' ? 'on' : ''} onClick={() => setSortierung('zeit')} aria-pressed={sortierung === 'zeit'}>Zeit im Clan</button>
            <button className={sortierung === 'az' ? 'on' : ''} onClick={() => setSortierung('az')} aria-pressed={sortierung === 'az'}>A → Z</button>
          </div>
        </header>

        {loading ? (
          <div className="cn-grid">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="cn-glass cn-card skeleton" />)}</div>
        ) : members.length === 0 ? (
          <div className="cn-glass cn-empty">Noch keine Mitglieder eingetragen.</div>
        ) : (
          <div className="cn-roles">
            {ROLE_ORDER.filter(role => grouped[role]).map(role => (
              <section key={role} className="cn-role" style={{ '--rc': ROLE_COLOR[role] } as React.CSSProperties}>
                <div className="cn-role-head">
                  <span className="cn-pill">{role}</span>
                  <span className="cn-line" />
                  <span className="cn-count">{grouped[role].length} {grouped[role].length !== 1 ? ROLE_LABEL[role].plural : ROLE_LABEL[role].singular}</span>
                </div>
                <div className="cn-grid">
                  {grouped[role].map(member => {
                    const stufeIndex = getStufe(member.join_date, member.stufe_override)
                    const stufe = STUFEN[stufeIndex] ?? STUFEN[0]
                    return (
                      <div key={member.id} className="cn-glass cn-card">
                        <Link href="/support" className="cn-card-link" aria-label={`${member.display_name} – Support`} />
                        <div className="cn-card-top">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/player-heads/${member.display_name}/64`} alt={member.display_name} className="cn-head-img" />
                          <div className="cn-card-name">
                            <b>{member.display_name}</b>
                            <span className="cn-pill sm">{role}</span>
                          </div>
                          <Link href={`/${member.display_name}/abzeichen`} title={`${stufe.name} – alle Abzeichen`} className="cn-stufe">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`${BADGE_URL}/stufe${stufeIndex}.png`} alt={stufe.name} />
                          </Link>
                        </div>
                        <div className="cn-card-info">
                          <span><Svg d={ICON.calendar} size={15} /> Im Clan seit <b>{getTimeSince(member.join_date)}</b></span>
                          <span className="cn-stufe-name">{stufe.name}</span>
                        </div>
                        {member.discord_tag && (
                          <div className="cn-discord">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.037.05a19.902 19.902 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                            </svg>
                            {member.discord_tag}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}