'use client'

import React, { useState, useRef } from 'react'

type Club = { id: string; name: string; short: string; logo_url: string | null }
type Match = { id: string; matchday: number; home_club_id: string; away_club_id: string; kickoff: string }
type Props = { clubs: Club[]; matches: Match[]; canSkip?: boolean; onSkip?: () => void; onSubmit: (ranking: string[]) => void; initialRanking?: string[]; readOnly?: boolean; onClose?: () => void }

function Logo({ club, size = 24 }: { club: Club | undefined; size?: number }) {
  const [err, setErr] = React.useState(false)
  const s = { width: size, height: size, flexShrink: 0 as const }
  if (!club) return <div style={{ ...s, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
  if (club.logo_url && !err) return <img src={club.logo_url} alt={club.short} style={{ ...s, objectFit: 'contain' }} onError={() => setErr(true)} />
  return <div style={{ ...s, borderRadius: '50%', background: 'linear-gradient(135deg,#1a237e,#3d5afe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#fff', fontWeight: 700 }}>{club.short.slice(0,3)}</div>
}

function IBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={e => { e.stopPropagation(); onClick() }}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 10, background: active ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.15)', color: active ? '#c9a84c' : 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 900, cursor: 'pointer', flexShrink: 0, userSelect: 'none', lineHeight: 1 }}
    >i</span>
  )
}

export default function UCLTableTip({ clubs, matches, canSkip, onSkip, onSubmit, initialRanking, readOnly, onClose }: Props) {
  const [ranking, setRanking] = useState<(string | null)[]>(initialRanking ? initialRanking.map(id => id || null) : Array(36).fill(null))
  const [saving, setSaving] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<number | 'pool' | null>(null)
  const src = useRef<{ type: 'pool' | 'slot'; id: string; idx?: number } | null>(null)

  const placed = new Set(ranking.filter(Boolean) as string[])
  const pool = clubs.filter(c => !placed.has(c.id))
  const byId = Object.fromEntries(clubs.map(c => [c.id, c]))
  const done = ranking.every(Boolean)

  function dragPool(e: React.DragEvent, id: string) { src.current = { type: 'pool', id }; e.dataTransfer.effectAllowed = 'move' }
  function dragSlot(e: React.DragEvent, id: string, idx: number) { src.current = { type: 'slot', id, idx }; e.dataTransfer.effectAllowed = 'move' }

  function dropOn(e: React.DragEvent, ti: number) {
    e.preventDefault(); setDragOver(null)
    const s = src.current; if (!s) return
    setRanking(prev => {
      const n = [...prev]
      if (s.type === 'pool') { n[ti] = s.id }
      else if (s.idx !== undefined) { const ex = n[ti]; n[ti] = s.id; n[s.idx] = ex }
      return n
    }); src.current = null
  }

  function dropPool(e: React.DragEvent) {
    e.preventDefault(); setDragOver(null)
    const s = src.current; if (!s || s.type !== 'slot' || s.idx === undefined) return
    setRanking(prev => { const n = [...prev]; n[s.idx!] = null; return n }); src.current = null
  }

  async function submit() {
    if (!done) return; setSaving(true)
    await new Promise(r => setTimeout(r, 400))
    onSubmit(ranking as string[]); setSaving(false)
  }

  function zone(p: number) {
    if (p <= 8)  return { bg: 'rgba(76,175,80,0.15)',  line: '#4caf50', tag: 'AF' }
    if (p <= 24) return { bg: 'rgba(61,90,254,0.12)',  line: '#3d5afe', tag: 'PO' }
    return             { bg: 'rgba(156,39,176,0.12)', line: '#9c27b0', tag: 'OUT' }
  }

  const matchesFor = (id: string) => matches.filter(m => m.home_club_id === id || m.away_club_id === id).sort((a,b) => a.matchday - b.matchday)

  // shared row style
  const rowBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, userSelect: 'none' }

  return (
    <div onClick={e => { if (e.target === e.currentTarget && onClose) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,5,25,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'default' }}>
      <style>{`.sc::-webkit-scrollbar{display:none}.sc{scrollbar-width:none}`}</style>
      <div style={{ width: '100%', maxWidth: 1100, height: 'calc(100vh - 80px)', maxHeight: 820, display: 'flex', flexDirection: 'column', background: 'rgba(4,12,48,0.88)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid rgba(201,168,76,0.28)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>

        {/* ── HEADER ── */}
        <div style={{ padding: '16px 24px 14px', borderBottom: '1px solid rgba(201,168,76,0.14)', background: 'rgba(201,168,76,0.05)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c9a84c' }}>UEFA Champions League 26/27</p>
              <h2 style={{ margin: '3px 0 0', fontSize: 'clamp(15px,2.2vw,22px)', fontWeight: 900, color: '#fff', fontStyle: 'italic' }}>TABELLENVORHERSAGE</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(180,210,255,0.55)' }}>Ziehe alle 36 Vereine in die Reihenfolge — klicke i um den Spielplan zu sehen.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {onClose && <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(18px,2.5vw,28px)', fontWeight: 900, color: done ? '#4caf50' : '#c9a84c', lineHeight: 1 }}>{placed.size}<span style={{ fontSize: '0.55em', color: 'rgba(255,255,255,0.35)' }}>/36</span></div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>platziert</div>
              </div>
              {!readOnly && canSkip && onSkip && <button onClick={onSkip} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>Überspringen</button>}
              {readOnly
                ? <span style={{ fontSize: 12, color: 'rgba(180,210,255,0.5)', fontStyle: 'italic' }}>Nur-Ansicht — kein Bearbeiten möglich</span>
                : <button onClick={submit} disabled={!done || saving} style={{ padding: '10px 22px', borderRadius: 10, border: 'none', cursor: done ? 'pointer' : 'not-allowed', background: done ? 'linear-gradient(135deg,#c9a84c,#e8c96a)' : 'rgba(255,255,255,0.07)', color: done ? '#05081a' : 'rgba(255,255,255,0.25)', fontSize: 13, fontWeight: 800, boxShadow: done ? '0 0 20px rgba(201,168,76,0.35)' : 'none' }}>
                    {saving ? 'Speichert...' : 'Tipp abgeben'}
                  </button>
              }
            </div>
          </div>
          <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
            <div style={{ height: '100%', width: `${(placed.size/36)*100}%`, background: 'linear-gradient(90deg,#c9a84c,#4caf50)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'clamp(180px,20vw,280px) 1fr auto', minHeight: 0, overflow: 'hidden' }}>

          {/* POOL */}
          <div onDragOver={e => { if (!readOnly) { e.preventDefault(); setDragOver('pool') } }} onDrop={e => { if (!readOnly) dropPool(e) }} onDragLeave={() => setDragOver(null)}
            style={{ borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', background: dragOver === 'pool' ? 'rgba(61,90,254,0.07)' : 'transparent', minHeight: 0 }}>
            <div style={{ padding: '8px 12px 6px', flexShrink: 0 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(180,210,255,0.4)' }}>Verfugbar ({pool.length})</span>
            </div>
            <div className="sc" style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }}>
              {pool.map(club => (
                <div key={club.id} style={{ ...rowBase, marginBottom: 3, background: openId === club.id ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${openId === club.id ? 'rgba(201,168,76,0.35)' : 'rgba(255,255,255,0.06)'}` }}>
                  <div draggable={!readOnly} onDragStart={e => dragPool(e, club.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: 'grab', minWidth: 0 }}>
                    <Logo club={club} size={20} />
                    <span style={{ fontSize: 12, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.name}</span>
                    <span style={{ fontSize: 9, color: 'rgba(180,210,255,0.4)', flexShrink: 0 }}>{matchesFor(club.id).length}/8</span>
                  </div>
                  <IBtn active={openId === club.id} onClick={() => setOpenId(p => p === club.id ? null : club.id)} />
                </div>
              ))}
              {pool.length === 0 && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 20 }}>Alle platziert</p>}
            </div>
          </div>

          {/* TABLE */}
          <div className="sc" style={{ overflowY: 'auto', padding: '6px 10px', minHeight: 0 }}>
            {/* col headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 52px', padding: '4px 8px 6px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(180,210,255,0.38)', flexShrink: 0 }}>
              <span>#</span><span>Verein</span><span style={{ textAlign: 'center' }}>Zone</span>
            </div>

            {ranking.map((cid, idx) => {
              const pos = idx + 1
              const club = cid ? byId[cid] : null
              const z = zone(pos)
              const over = dragOver === idx
              const sel = !!club && openId === club.id
              const cms = club ? matchesFor(club.id) : []

              return (
                <React.Fragment key={idx}>
                  {(pos === 9 || pos === 25) && <div style={{ height: 1, background: pos === 9 ? '#3d5afe' : '#9c27b0', opacity: 0.28, margin: '2px 0' }} />}
                  <div
                    onDragOver={e => { if (!readOnly) { e.preventDefault(); setDragOver(idx) } }}
                    onDrop={e => { if (!readOnly) dropOn(e, idx) }}
                    onDragLeave={() => setDragOver(null)}
                    style={{ borderRadius: 7, marginBottom: 2, overflow: 'hidden', background: over ? 'rgba(61,90,254,0.18)' : sel ? 'rgba(201,168,76,0.07)' : club ? z.bg : 'rgba(255,255,255,0.025)', border: `1px solid ${sel ? 'rgba(201,168,76,0.3)' : over ? z.line : club ? z.line+'28' : 'rgba(255,255,255,0.04)'}` }}
                  >
                    {/* main row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 52px', alignItems: 'center', minHeight: 32 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: z.line, paddingLeft: 7 }}>{pos}</span>

                      {club ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, padding: '4px 0' }}>
                          <div draggable={!readOnly} onDragStart={e => { if (!readOnly) dragSlot(e, club.id, idx) }} style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, cursor: readOnly ? 'default' : 'grab', minWidth: 0 }}>
                            <Logo club={club} size={20} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.name}</span>
                          </div>
                          <IBtn active={sel} onClick={() => setOpenId(p => p === club.id ? null : club.id)} />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0' }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1px dashed ${z.line}35`, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', fontStyle: 'italic' }}>Hierher ziehen...</span>
                        </div>
                      )}

                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 8, fontWeight: 700, color: z.line, background: z.bg, padding: '2px 5px', borderRadius: 20 }}>{z.tag}</span>
                      </div>
                    </div>


                  </div>
                </React.Fragment>
              )
            })}
          </div>

          {/* SIDE PANEL */}
          {openId && byId[openId] && (() => {
            const club = byId[openId]
            const cms = matchesFor(club.id)
            return (
              <div style={{ width: 270, borderLeft: '1px solid rgba(201,168,76,0.15)', display: 'flex', flexDirection: 'column', background: 'rgba(2,8,40,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', flexShrink: 0 }}>
                {/* Panel Header */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(201,168,76,0.12)', background: 'linear-gradient(135deg, rgba(201,168,76,0.08), rgba(61,90,254,0.06))', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <Logo club={club} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 700 }}>Ligaphase</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{club.name}</div>
                  </div>
                  <span role="button" onClick={() => setOpenId(null)} style={{ color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 18, lineHeight: 1, flexShrink: 0, padding: 4 }}>x</span>
                </div>
                {/* Spieltag label */}
                <div style={{ padding: '8px 16px 4px', flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(180,210,255,0.35)' }}>
                    Gespielt 0/{cms.length} &nbsp;·&nbsp; Ausstehend {cms.length}
                  </span>
                </div>
                {/* Matches */}
                <div className="sc" style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 10px' }}>
                  {cms.length === 0
                    ? <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 24 }}>Keine Spiele gefunden</p>
                    : cms.map(m => {
                      const home = m.home_club_id === club.id
                      const opp = byId[home ? m.away_club_id : m.home_club_id]
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, marginBottom: 4, background: home ? 'rgba(76,175,80,0.06)' : 'rgba(61,90,254,0.06)', border: `1px solid ${home ? 'rgba(76,175,80,0.15)' : 'rgba(61,90,254,0.15)'}` }}>
                          <div style={{ flexShrink: 0, textAlign: 'center' }}>
                            <div style={{ fontSize: 8, color: 'rgba(201,168,76,0.6)', fontWeight: 700, textTransform: 'uppercase' }}>ST</div>
                            <div style={{ fontSize: 13, fontWeight: 900, color: '#c9a84c', lineHeight: 1 }}>{m.matchday}</div>
                          </div>
                          <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 4, flexShrink: 0, background: home ? 'rgba(76,175,80,0.2)' : 'rgba(61,90,254,0.2)', color: home ? '#4caf50' : '#7986cb', letterSpacing: '0.05em' }}>{home ? 'HEIM' : 'AUSW'}</span>
                          <Logo club={opp} size={20} />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{opp?.name ?? '?'}</span>
                          <span style={{ fontSize: 9, color: 'rgba(180,210,255,0.3)', flexShrink: 0 }}>{new Date(m.kickoff).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})}</span>
                        </div>
                      )
                    })
                  }
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}