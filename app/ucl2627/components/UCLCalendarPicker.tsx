'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

type Match = { id: string; matchday: number; home_club_id: string; away_club_id: string; kickoff: string }
type Club  = { id: string; name: string; short: string; logo_url?: string | null }
type Props = { matches: Match[]; clubs: Club[]; value: string | null; onChange: (date: string) => void }

const G = {
  gold:   '#c9a84c',
  blue:   '#3d5afe',
  muted:  'rgba(180,210,255,0.45)',
  border: 'rgba(255,255,255,0.09)',
}

const WEEKDAYS = ['Mo','Di','Mi','Do','Fr','Sa','So']
const MONTHS   = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

function Logo({ club, size = 28 }: { club: Club | undefined; size?: number }) {
  const [err, setErr] = useState(false)
  const s = { width: size, height: size, flexShrink: 0 as const }
  if (!club) return <div style={{ ...s, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
  if (club.logo_url && !err) return <img src={club.logo_url} alt={club.short} style={{ ...s, objectFit: 'contain' }} onError={() => setErr(true)} />
  return <div style={{ ...s, borderRadius: '50%', background: 'linear-gradient(135deg,#1a237e,#3d5afe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700 }}>{club.short.slice(0,3)}</div>
}

export default function UCLCalendarPicker({ matches, clubs, value, onChange }: Props) {
  const [open, setOpen]             = useState(false)
  const [mounted, setMounted]       = useState(false)
  const [viewYear, setViewYear]     = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth]   = useState(() => new Date().getMonth())
  const [detailDate, setDetailDate] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const clubMap = Object.fromEntries(clubs.map(c => [c.id, c]))

  const byDate: Record<string, Match[]> = {}
  for (const m of matches) {
    const d = m.kickoff.slice(0, 10)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(m)
  }

  const firstDow    = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const pad  = (n: number) => String(n).padStart(2, '0')
  const toISO = (y: number, m: number, d: number) => `${y}-${pad(m+1)}-${pad(d)}`
  const today = new Date(); today.setHours(0,0,0,0)

  const fmtDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m-1, d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const prev = () => viewMonth === 0 ? (setViewMonth(11), setViewYear(y => y-1)) : setViewMonth(m => m-1)
  const next = () => viewMonth === 11 ? (setViewMonth(0), setViewYear(y => y+1)) : setViewMonth(m => m+1)

  const panel = (
    <>
      <style>{`@keyframes ucl-slide { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 99999,
        width: 'min(48vw, 780px)', minWidth: 560,
        background: 'linear-gradient(170deg, rgba(3,6,24,0.99) 0%, rgba(5,10,36,0.99) 100%)',
        borderLeft: '1px solid rgba(201,168,76,0.2)',
        boxShadow: '-40px 0 140px rgba(0,0,0,0.95)',
        display: 'flex', flexDirection: 'column',
        animation: 'ucl-slide 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Header */}
        <div style={{ padding: '28px 32px 20px', borderBottom: `1px solid ${G.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: G.gold, textTransform: 'uppercase', letterSpacing: '0.14em' }}>UCL 26/27</p>
              <h2 style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#fff' }}>Spielplan-Kalender</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: G.muted }}>Tag anklicken → Details → Datum wählen</p>
            </div>
            <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', width: 40, height: 40, borderRadius: 10, border: `1px solid ${G.border}`, background: 'rgba(255,255,255,0.04)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={prev} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${G.border}`, background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={next} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${G.border}`, background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ flexShrink: 0, padding: '16px 32px 12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 8 }}>
            {WEEKDAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: G.muted, padding: '4px 0' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />
              const dateStr  = toISO(viewYear, viewMonth, day)
              const cellDate = new Date(viewYear, viewMonth, day)
              const isPast   = cellDate < today
              const isToday  = cellDate.getTime() === today.getTime()
              const isSel    = value === dateStr
              const isDet    = detailDate === dateStr
              const hasMtch  = !!byDate[dateStr]
              return (
                <div key={idx}
                  onClick={() => { if (!isPast) setDetailDate(isDet ? null : dateStr) }}
                  style={{
                    borderRadius: 12, padding: '12px 4px', textAlign: 'center',
                    cursor: isPast ? 'default' : 'pointer',
                    background: isSel ? `linear-gradient(135deg,#1a237e,${G.blue})` : isDet ? 'rgba(201,168,76,0.14)' : isToday ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
                    border: isSel ? 'none' : isDet ? `1px solid rgba(201,168,76,0.55)` : hasMtch ? `1px solid rgba(201,168,76,0.28)` : isToday ? `1px solid rgba(255,255,255,0.15)` : `1px solid transparent`,
                    opacity: isPast ? 0.22 : 1, transition: 'all 0.12s',
                  }}
                >
                  <div style={{ fontSize: 17, fontWeight: isSel || isToday ? 800 : 400, color: isSel ? '#fff' : isToday ? G.gold : '#fff' }}>{day}</div>
                  {hasMtch && <div style={{ fontSize: 10, fontWeight: 700, color: isSel ? 'rgba(255,255,255,0.7)' : G.gold, marginTop: 3 }}>{byDate[dateStr].length}×</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Tagesdetail */}
        {detailDate ? (
          <div style={{ flex: 1, overflowY: 'auto', borderTop: `1px solid ${G.border}`, padding: '20px 32px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: G.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gewählter Tag</p>
                <p style={{ margin: '3px 0 0', fontSize: 17, fontWeight: 700, color: '#fff' }}>
                  {(() => { const [y,m,d] = detailDate.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}) })()}
                </p>
              </div>
              <button
                onClick={() => { onChange(detailDate); setOpen(false) }}
                style={{ marginLeft: 'auto', padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg,#1a237e,${G.blue})`, color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: '0 0 20px rgba(61,90,254,0.4)' }}
              >Als Datum wählen ✓</button>
            </div>
            {(byDate[detailDate] || []).length === 0
              ? <p style={{ fontSize: 14, color: G.muted }}>Keine UCL-Spiele an diesem Tag.</p>
              : byDate[detailDate].map(m => {
                const home = clubMap[m.home_club_id]
                const away = clubMap[m.away_club_id]
                const uhr  = new Date(m.kickoff).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 8, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${G.border}` }}>
                    <span style={{ fontSize: 12, color: G.muted, width: 44, flexShrink: 0, fontWeight: 600 }}>{uhr} Uhr</span>
                    <Logo club={home as any} size={30} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{home?.name ?? '?'}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>vs</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' as const }}>{away?.name ?? '?'}</span>
                    <Logo club={away as any} size={30} />
                    <span style={{ fontSize: 10, color: G.muted, background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 6, flexShrink: 0 }}>ST{m.matchday}</span>
                  </div>
                )
              })
            }
          </div>
        ) : (
          <div style={{ marginTop: 'auto', padding: '16px 32px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid rgba(201,168,76,0.35)` }} />
              <span style={{ fontSize: 12, color: G.muted }}>UCL-Spieltag</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: `linear-gradient(135deg,#1a237e,${G.blue})` }} />
              <span style={{ fontSize: 12, color: G.muted }}>Gewählt</span>
            </div>
          </div>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', border: `1px solid ${value ? 'rgba(201,168,76,0.45)' : G.border}`, borderRadius: 10, padding: '10px 14px', color: value ? '#fff' : G.muted, fontSize: 13, cursor: 'pointer', textAlign: 'left' as const }}>
        <span style={{ fontSize: 16 }}>📅</span>
        <span style={{ flex: 1 }}>{value ? fmtDate(value) : 'Datum auswählen — Kalender öffnen'}</span>
        {value && <span onClick={e => { e.stopPropagation(); onChange('') }} style={{ fontSize: 14, color: G.muted, cursor: 'pointer', padding: '0 4px' }}>✕</span>}
      </button>

      {/* Portal direkt in document.body */}
      {mounted && open && createPortal(panel, document.body)}
    </>
  )
}