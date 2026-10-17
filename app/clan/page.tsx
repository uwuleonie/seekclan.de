'use client'

// /clan – alle Mitglieder des seek-Clans, nach Rang gruppiert (Ränge mit „Clan“-Haken, siehe /admin2/raenge).
// Aussehen: dunkler Hintergrund mit Farbflecken und Glas-Karten (glassmorphism) wie Startseite und Changelog.
// Styles: app/clan/clan.css (Präfix cn-). Daten: /api/clan/members.
// Ganze Karte → Fenster mit Clan-Verlauf der Person (Profil-Link darin), Abzeichen-Bild → /<Name>/abzeichen.
// Unterseiten: /clan/ex-clan (Ehemalige) und /clan-history (Verlauf).

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { signatureFont } from '../lib/fonts'
import { STUFEN, stufeVon, zeitSeit } from '../lib/clan-stufen'
import ClanNav from './_parts/ClanNav'
import PersonVerlauf from './_parts/PersonVerlauf'
import './clan.css'

type Badge = {
  id: string
  name: string
  icon_url: string
}

type RangInfo = { id: number; anzeige: string; farbe: string; prioritaet: number }

type Member = {
  id: string
  display_name: string
  mc_name: string
  username: string | null
  rang: RangInfo
  join_date: string | null
  /** false = Beitritt unbekannt (join_date ist dann nur ein Platzhalter) */
  seit_bekannt?: boolean
  discord_tag: string | null
  badges: Badge[]
  stufe_override: number | null
}

const BADGE_URL = '/api/uploads/badge-icons'
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
  const [offen, setOffen] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/clan/members').then(r => r.json()).then(d => {
      setMembers(d.members || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Unbekannter Beitritt = vor allen Aufzeichnungen → ganz vorne
  const zeit = (m: Member) => (m.seit_bekannt === false ? 0 : m.join_date ? new Date(m.join_date).getTime() : Date.now())
  const sorted = [...members].sort((a, b) =>
    sortierung === 'az' ? a.display_name.localeCompare(b.display_name) : zeit(a) - zeit(b)
  )

  // Gruppen = Ränge, höchster zuerst
  const raenge = [...new Map(members.map(m => [m.rang.id, m.rang])).values()].sort((a, b) => b.prioritaet - a.prioritaet)
  const grouped = raenge.map(r => ({ rang: r, mitglieder: sorted.filter(m => m.rang.id === r.id) }))

  const oldest = members.filter(m => m.join_date && m.seit_bekannt !== false).sort((a, b) => zeit(a) - zeit(b))[0] ?? null

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
            <p className="cn-lead">Hier findest du alle aktiven Mitglieder im seek-Clan. Tipp auf eine Person für ihren ganzen Clan-Verlauf.</p>
            <ClanNav aktiv="mitglieder" />
            {members.length > 0 && (
              <div className="cn-stats">
                <span><Svg d={ICON.users} /> {members.length} {members.length === 1 ? 'Mitglied' : 'Mitglieder'}</span>
                {oldest?.join_date && <span><Svg d={ICON.clock} /> Dabei seit {fmtDate(oldest.join_date)}</span>}
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
            {grouped.map(({ rang, mitglieder }) => (
              <section key={rang.id} className="cn-role" style={{ '--rc': rang.farbe } as React.CSSProperties}>
                <div className="cn-role-head">
                  <span className="cn-pill">{rang.anzeige}</span>
                  <span className="cn-line" />
                  <span className="cn-count">{mitglieder.length} {mitglieder.length !== 1 ? 'Mitglieder' : 'Mitglied'}</span>
                </div>
                <div className="cn-grid">
                  {mitglieder.map(member => {
                    const stufeIndex = stufeVon(member.join_date, member.stufe_override)
                    const stufe = STUFEN[stufeIndex] ?? STUFEN[0]
                    return (
                      <div key={member.id} className="cn-glass cn-card">
                        <button type="button" className="cn-card-link" onClick={() => setOffen(member.mc_name)} aria-label={`Clan-Verlauf von ${member.display_name}`} />
                        <div className="cn-card-top">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/player-heads/${encodeURIComponent(member.mc_name)}/64?v=2`} alt={member.display_name} className="cn-head-img" loading="lazy" />
                          <div className="cn-card-name">
                            <b>{member.display_name}</b>
                            <span className="cn-pill sm">{rang.anzeige}</span>
                          </div>
                          <Link href={`/${encodeURIComponent(member.username ?? member.mc_name)}/abzeichen`} title={`${stufe.name} – alle Abzeichen`} className="cn-stufe">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`${BADGE_URL}/stufe${stufeIndex}.png`} alt={stufe.name} />
                          </Link>
                        </div>
                        <div className="cn-card-info">
                          <span><Svg d={ICON.calendar} size={15} /> {member.seit_bekannt === false ? 'Beitritt unbekannt' : member.join_date ? <>Im Clan seit <b>{zeitSeit(member.join_date)}</b></> : 'Neu im Clan'}</span>
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
      {offen && <PersonVerlauf name={offen} schliessen={() => setOffen(null)} />}
    </div>
  )
}