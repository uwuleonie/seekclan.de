'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'
import {
  BdoCategory, BdoEdition, BdoNominee, BdoResult, BdoTip, BdoCategoryScore,
  categoryLabel, scoringOf,
} from '@/app/lib/ballondor'
import { B, glass, goldText, Sparkles, NomineeCard, NomineeModal, Portrait, splitName } from './components/BdoUi'
import BdoAdminPanel from './components/BdoAdminPanel'

type Data = {
  edition: BdoEdition | null
  editions: { slug: string; title: string; is_active: boolean }[]
  categories: BdoCategory[]
  nominees: BdoNominee[]
  results: BdoResult[]
  myTips: BdoTip[]
}

type PointsEntry = { key: string; points: number; details: BdoCategoryScore[]; tipCount: number }

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function BallonDorPage() {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = !!(user && (user.clan_role === 'owner' || user.clan_role === 'administrator'))

  const [slug, setSlug] = useState<string | null>(null)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [gastName, setGastName] = useState('')
  const [gastInput, setGastInput] = useState('')
  const [gastNameSet, setGastNameSet] = useState(false)

  const [gender, setGender] = useState<'m' | 'w'>('m')
  const [openCatId, setOpenCatId] = useState<number | null>(null)
  const [modal, setModal] = useState<{ nomineeId: number; catId: number | null } | null>(null)
  const [drafts, setDrafts] = useState<Record<number, number[]>>({})
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [points, setPoints] = useState<PointsEntry[]>([])
  const [now, setNow] = useState<number | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const closeModal = useCallback(() => setModal(null), [])

  // Slug aus URL + Gastname aus dem UCL-Tippspiel übernehmen
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setSlug(p.get('edition'))
    const n = localStorage.getItem('ucl_gast_name')
    if (n) { setGastName(n); setGastNameSet(true) }
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams()
      if (slug) params.set('edition', slug)
      if (!user && gastNameSet) params.set('gast_name', gastName)
      const res = await fetch(`/api/ballondor?${params}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Fehler beim Laden')
      setData(d)
      setDrafts({})
      if (d.edition) {
        const pr = await fetch(`/api/ballondor/points?edition=${encodeURIComponent(d.edition.slug)}`)
        const pd = await pr.json()
        if (pd.entries) setPoints(pd.entries)
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [slug, user, gastNameSet, gastName])

  useEffect(() => { if (!authLoading) load() }, [authLoading, load])

  const nomineeMap = useMemo(() => new Map((data?.nominees ?? []).map(n => [n.id, n])), [data])
  const resultMap = useMemo(() => new Map((data?.results ?? []).map(r => [r.category_id, r])), [data])
  const tipMap = useMemo(() => new Map((data?.myTips ?? []).map(t => [t.category_id, t])), [data])
  const catsOfNominee = useCallback((id: number) =>
    (data?.categories ?? []).filter(c => c.nominee_ids.includes(id)).map(c => categoryLabel(c.name)), [data])

  const edition = data?.edition ?? null
  const closeAt = edition?.tips_close_at ? new Date(edition.tips_close_at).getTime() : null
  const locked = !!closeAt && now !== null && now >= closeAt
  const canTip = !!user || gastNameSet
  const myKey = user?.username ?? (gastNameSet ? gastName : null)
  const myPoints = points.find(p => p.key === myKey)

  const categories = data?.categories ?? []
  const hasGenders = categories.some(c => c.gender === 'w')
  const visibleCats = categories.filter(c => !hasGenders || c.gender === gender || c.gender === null)
  const openCat = categories.find(c => c.id === openCatId) ?? null
  const tippedCount = categories.filter(c => tipMap.has(c.id)).length

  const flash = (m: { type: 'ok' | 'err'; text: string }) => { setMsg(m); setTimeout(() => setMsg(null), 3500) }

  const saveTip = async (cat: BdoCategory, payload: { pick_nominee_id?: number; ranking?: number[] }) => {
    if (!canTip) { flash({ type: 'err', text: 'Bitte zuerst anmelden oder einen Namen eingeben' }); return false }
    setSaving(true)
    try {
      const body: any = { category_id: cat.id, ...payload }
      if (!user) body.gast_name = gastName
      const res = await fetch('/api/ballondor/tip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) { flash({ type: 'err', text: d.error || 'Fehler beim Speichern' }); setSaving(false); return false }
      setData(prev => prev ? {
        ...prev,
        myTips: [...prev.myTips.filter(t => t.category_id !== cat.id), { category_id: cat.id, pick_nominee_id: payload.pick_nominee_id ?? null, ranking: payload.ranking ?? null }],
      } : prev)
      flash({ type: 'ok', text: 'Tipp gespeichert' })
      setSaving(false)
      return true
    } catch {
      flash({ type: 'err', text: 'Netzwerkfehler' })
      setSaving(false)
      return false
    }
  }

  // Ranking-Entwurf
  const draftFor = (cat: BdoCategory): number[] => {
    if (drafts[cat.id]) return drafts[cat.id]
    const tip = tipMap.get(cat.id)
    if (tip?.ranking?.length) return tip.ranking
    return [...cat.nominee_ids].sort((a, b) => (nomineeMap.get(a)?.name ?? '').localeCompare(nomineeMap.get(b)?.name ?? ''))
  }
  const moveTo = (cat: BdoCategory, from: number, to: number) => {
    const list = [...draftFor(cat)]
    if (to < 0 || to >= list.length || from === to) return
    const [x] = list.splice(from, 1)
    list.splice(to, 0, x)
    setDrafts(p => ({ ...p, [cat.id]: list }))
  }
  const draftDirty = (cat: BdoCategory) => {
    const tip = tipMap.get(cat.id)
    const d = drafts[cat.id]
    if (!d) return false
    return !tip?.ranking || tip.ranking.join(',') !== d.join(',')
  }

  // ── Countdown ──
  const countdown = (() => {
    if (!closeAt || now === null) return null
    const diff = closeAt - now
    if (diff <= 0) return null
    const d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000) % 24, m = Math.floor(diff / 60000) % 60, s = Math.floor(diff / 1000) % 60
    return [{ v: d, l: 'Tage' }, { v: h, l: 'Std' }, { v: m, l: 'Min' }, { v: s, l: 'Sek' }]
  })()

  // ── Render ──
  const page: React.CSSProperties = { minHeight: '100vh', background: B.bg, color: B.text, fontFamily: B.sans, position: 'relative', overflowX: 'hidden' }

  if (loading) {
    return <div style={page}><Sparkles /><p style={{ position: 'relative', textAlign: 'center', paddingTop: 160, color: B.muted, fontFamily: B.serif, fontSize: 22 }}>Lade…</p></div>
  }

  const modalNominee = modal ? nomineeMap.get(modal.nomineeId) ?? null : null
  const modalCat = modal?.catId ? categories.find(c => c.id === modal.catId) ?? null : null
  const modalResult = modalCat ? resultMap.get(modalCat.id) : undefined
  const modalOfficialRank = modalCat?.kind === 'ranking' && modalResult?.ranking
    ? (modalResult.ranking.indexOf(modal!.nomineeId) + 1) || null : null
  const modalMyRank = modalCat?.kind === 'ranking' ? (draftFor(modalCat).indexOf(modal!.nomineeId) + 1) || null : null

  return (
    <div style={page}>
      <Sparkles />
      <style>{`
        .bdo-card { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease }
        .bdo-card:hover { transform: translateY(-3px) }
        .bdo-row { transition: background .12s }
        .bdo-row:hover { background: rgba(255,245,220,0.07) !important }
        ::selection { background: rgba(212,175,106,0.35) }
      `}</style>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1120, margin: '0 auto', padding: '18px 18px 80px' }}>
        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26, flexWrap: 'wrap' }}>
          <Link href="/ucl2627"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 12, textDecoration: 'none', fontSize: 13, fontWeight: 600, color: '#fff',
              background: 'linear-gradient(135deg, rgba(26,35,126,0.85), rgba(61,90,254,0.75))', border: '1px solid rgba(123,159,255,0.45)', boxShadow: '0 6px 24px rgba(61,90,254,0.3)', backdropFilter: 'blur(10px)' }}>
            <img src="/ucl-badge.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain', filter: 'invert(1)' }} />
            ← Zurück zum UCL Tippspiel
          </Link>
          <span style={{ flex: 1 }} />
          {(data?.editions?.length ?? 0) > 1 && (
            <select value={edition?.slug ?? ''} onChange={e => { setSlug(e.target.value); history.replaceState(null, '', `?edition=${e.target.value}`) }}
              style={{ ...glass(), borderRadius: 10, padding: '6px 10px', color: B.goldL, fontSize: 12, fontFamily: B.sans }}>
              {data!.editions.map(e => <option key={e.slug} value={e.slug} style={{ background: '#111' }}>{e.title}</option>)}
            </select>
          )}
          {isAdmin && (
            <button onClick={() => setShowAdmin(true)} style={{ ...glass(), borderRadius: 10, padding: '6px 14px', color: B.goldL, fontSize: 12, cursor: 'pointer', fontFamily: B.sans }}>⚙ Admin</button>
          )}
        </div>

        {error && <div style={{ ...glass(), padding: 16, color: B.red, marginBottom: 20 }}>⚠ {error}</div>}

        {!edition ? (
          <div style={{ ...glass(), padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ fontFamily: B.serif, fontSize: 28, margin: 0, ...goldText }}>Noch keine Ausgabe angelegt</p>
            {isAdmin && <p style={{ color: B.muted, fontSize: 13 }}>Lege im Adminbereich eine Ausgabe an und importiere die Nominierten.</p>}
          </div>
        ) : (
          <>
            {/* ── Hero ── */}
            <header style={{ textAlign: 'center', marginBottom: 34 }}>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.42em', color: B.muted, textTransform: 'uppercase' }}>seekclan Tippspiel</p>
              <h1 style={{ margin: '10px 0 0', fontFamily: B.serif, fontWeight: 300, fontSize: 'clamp(46px, 11vw, 104px)', lineHeight: 0.95, letterSpacing: '0.02em', ...goldText }}>
                Ballon d&apos;Or
              </h1>
              <p style={{ margin: '4px 0 0', fontFamily: B.serif, fontWeight: 600, fontSize: 'clamp(22px, 5vw, 34px)', letterSpacing: '0.35em', color: B.goldL }}>{edition.slug}</p>
              {edition.ceremony_at && <p style={{ margin: '14px 0 0', fontSize: 13, color: B.muted }}>Verleihung am {fmtDate(edition.ceremony_at)}</p>}

              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 24 }}>
                {countdown ? (
                  <div style={{ ...glass(true), padding: '14px 20px', display: 'flex', gap: 18, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, letterSpacing: '0.2em', color: B.muted, textTransform: 'uppercase' }}>Tippschluss in</span>
                    {countdown.map(c => (
                      <div key={c.l} style={{ textAlign: 'center', minWidth: 34 }}>
                        <p style={{ margin: 0, fontFamily: B.serif, fontSize: 28, fontWeight: 600, lineHeight: 1, ...goldText }}>{String(c.v).padStart(2, '0')}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 9, color: B.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{c.l}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ ...glass(true), padding: '14px 20px', fontSize: 13, color: locked ? B.goldL : B.muted }}>
                    {locked ? 'Tippschluss erreicht — die Tipps sind fixiert' : 'Tippschluss noch nicht festgelegt'}
                  </div>
                )}
                <div style={{ ...glass(true), padding: '14px 20px', display: 'flex', gap: 22, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: 0, fontFamily: B.serif, fontSize: 28, fontWeight: 600, lineHeight: 1, ...goldText }}>{tippedCount}/{categories.length}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 9, color: B.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>getippt</p>
                  </div>
                  {myPoints && (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: 0, fontFamily: B.serif, fontSize: 28, fontWeight: 600, lineHeight: 1, ...goldText }}>{myPoints.points}</p>
                      <p style={{ margin: '3px 0 0', fontSize: 9, color: B.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Punkte</p>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* ── Name für Gäste ── */}
            {!user && !gastNameSet && (
              <div style={{ ...glass(true), padding: 18, maxWidth: 520, margin: '0 auto 28px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontSize: 13, color: B.muted, flex: '1 1 100%' }}>Zum Tippen einloggen oder mit dem gleichen Namen wie im UCL-Tippspiel mitmachen:</p>
                <input value={gastInput} onChange={e => setGastInput(e.target.value)} placeholder="Dein Name" maxLength={30}
                  style={{ flex: 1, minWidth: 160, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(212,175,106,0.3)', borderRadius: 10, padding: '10px 12px', color: B.text, fontSize: 14, outline: 'none', fontFamily: B.sans }} />
                <button disabled={!gastInput.trim()} onClick={() => { const v = gastInput.trim(); localStorage.setItem('ucl_gast_name', v); setGastName(v); setGastNameSet(true) }}
                  style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f3d9a0,#d4af6a)', color: '#1a1206', fontWeight: 600, cursor: 'pointer', opacity: gastInput.trim() ? 1 : 0.5 }}>Los</button>
                <Link href="/login" style={{ fontSize: 12, color: B.goldL }}>Einloggen</Link>
              </div>
            )}

            {msg && (
              <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 9600, ...glass(true), padding: '10px 18px', color: msg.type === 'ok' ? B.green : B.red, fontSize: 13, fontWeight: 600 }}>
                {msg.type === 'ok' ? '✓ ' : '⚠ '}{msg.text}
              </div>
            )}

            {/* ── Übersicht der Kategorien ── */}
            {!openCat && (
              <>
                {hasGenders && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
                    <div style={{ ...glass(), borderRadius: 40, padding: 4, display: 'flex', gap: 4 }}>
                      {([['m', 'Herren'], ['w', 'Damen']] as const).map(([g, l]) => (
                        <button key={g} onClick={() => setGender(g)}
                          style={{ padding: '9px 26px', borderRadius: 30, border: 'none', cursor: 'pointer', fontFamily: B.sans, fontSize: 13, fontWeight: 600, letterSpacing: '0.08em',
                            background: gender === g ? 'linear-gradient(135deg,#f3d9a0,#d4af6a 55%,#b08a44)' : 'transparent', color: gender === g ? '#1a1206' : B.muted }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {visibleCats.map(cat => {
                    const tip = tipMap.get(cat.id)
                    const res = resultMap.get(cat.id)
                    const pick = tip?.pick_nominee_id ? nomineeMap.get(tip.pick_nominee_id) : tip?.ranking?.length ? nomineeMap.get(tip.ranking[0]) : undefined
                    const winnerId = res ? (res.winner_nominee_id ?? res.ranking?.[0] ?? null) : null
                    const winner = winnerId ? nomineeMap.get(winnerId) : undefined
                    const score = myPoints?.details.find(d => d.category_id === cat.id)
                    const sc = scoringOf(cat)
                    const isMain = cat.kind === 'ranking'
                    return (
                      <button key={cat.id} onClick={() => { setOpenCatId(cat.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="bdo-card"
                        style={{ ...glass(isMain), padding: 18, cursor: 'pointer', textAlign: 'left', color: B.text, fontFamily: B.sans, display: 'flex', flexDirection: 'column', gap: 14,
                          gridColumn: isMain ? '1 / -1' : undefined, minHeight: isMain ? 150 : 170,
                          borderColor: isMain ? 'rgba(243,217,160,0.4)' : undefined }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontFamily: B.serif, fontSize: isMain ? 32 : 23, fontWeight: 600, lineHeight: 1.05, ...goldText }}>{categoryLabel(cat.name)}</p>
                            <p style={{ margin: '5px 0 0', fontSize: 11, color: B.muted }}>
                              {cat.nominee_ids.length} Nominierte · {isMain ? `Top ${cat.nominee_ids.length} tippen` : 'Gewinner tippen'} · bis {sc.winner} Pkt{isMain ? ' + Platzierungen' : ''}
                            </p>
                          </div>
                          {score && res?.published_at && (
                            <span style={{ fontFamily: B.serif, fontSize: 24, fontWeight: 700, color: score.points > 0 ? B.green : B.faint }}>+{score.points}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
                          {pick ? (
                            <>
                              <Portrait n={pick} size={isMain ? 52 : 44} radius={8} />
                              <div style={{ minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 10, color: B.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{isMain ? 'Dein Platz 1' : 'Dein Tipp'}</p>
                                <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600, color: B.goldL, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pick.name}</p>
                              </div>
                            </>
                          ) : (
                            <span style={{ fontSize: 13, color: locked ? B.faint : B.gold, fontWeight: 500 }}>{locked ? 'Nicht getippt' : 'Jetzt tippen →'}</span>
                          )}
                          <span style={{ flex: 1 }} />
                          {winner && (
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ margin: 0, fontSize: 10, color: B.muted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Gewinner</p>
                              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: winnerId === pick?.id ? B.green : B.goldL }}>🏆 {winner.name}</p>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {categories.length === 0 && (
                  <div style={{ ...glass(), padding: '50px 20px', textAlign: 'center', color: B.muted }}>Noch keine Nominierten importiert.</div>
                )}
              </>
            )}

            {/* ── Kategorie geöffnet ── */}
            {openCat && (() => {
              const cat = openCat
              const tip = tipMap.get(cat.id)
              const res = resultMap.get(cat.id)
              const winnerId = res ? (res.winner_nominee_id ?? res.ranking?.[0] ?? null) : null
              const nominees = cat.nominee_ids.map(id => nomineeMap.get(id)).filter(Boolean) as BdoNominee[]
              const sc = scoringOf(cat)
              const score = myPoints?.details.find(d => d.category_id === cat.id)

              return (
                <section>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                    <button onClick={() => setOpenCatId(null)} style={{ ...glass(), borderRadius: 12, padding: '9px 14px', color: B.goldL, cursor: 'pointer', fontSize: 13, fontFamily: B.sans }}>← Alle Kategorien</button>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <h2 style={{ margin: 0, fontFamily: B.serif, fontSize: 'clamp(30px, 6vw, 46px)', fontWeight: 600, lineHeight: 1, ...goldText }}>{categoryLabel(cat.name)}</h2>
                      <p style={{ margin: '6px 0 0', fontSize: 12, color: B.muted }}>
                        {cat.kind === 'ranking'
                          ? `Ordne alle ${nominees.length} Nominierten · Platz 1 richtig: ${sc.winner} Pkt · exakter Platz: ${sc.exact} · 1 daneben: ${sc.diff1} · 2 daneben: ${sc.diff2}`
                          : `Wähle den Gewinner · richtig getippt: ${sc.winner} Pkt`}
                      </p>
                    </div>
                    {score && res?.published_at && (
                      <div style={{ ...glass(true), padding: '10px 16px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontFamily: B.serif, fontSize: 28, fontWeight: 700, color: score.points > 0 ? B.green : B.faint }}>+{score.points}</p>
                        <p style={{ margin: 0, fontSize: 9, color: B.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>deine Punkte</p>
                      </div>
                    )}
                  </div>

                  {/* Gewinner-Kategorie */}
                  {cat.kind === 'winner' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 14 }}>
                      {nominees.map(n => (
                        <NomineeCard key={n.id} n={n}
                          selected={tip?.pick_nominee_id === n.id}
                          winner={winnerId === n.id}
                          onClick={() => setModal({ nomineeId: n.id, catId: cat.id })} />
                      ))}
                    </div>
                  )}

                  {/* Ranking-Kategorie */}
                  {cat.kind === 'ranking' && (() => {
                    const list = draftFor(cat)
                    const dirty = draftDirty(cat)
                    const official = res?.ranking ?? null
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
                        {/* Podium der eigenen Top 3 */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'end' }}>
                          {[1, 0, 2].map(i => {
                            const n = nomineeMap.get(list[i])
                            if (!n) return <div key={i} />
                            const [f, l] = splitName(n.name)
                            return (
                              <button key={i} onClick={() => setModal({ nomineeId: n.id, catId: cat.id })} className="bdo-card"
                                style={{ ...glass(i === 0), padding: 10, cursor: 'pointer', color: B.text, textAlign: 'center', transform: i === 0 ? 'translateY(-10px)' : undefined, borderColor: i === 0 ? 'rgba(243,217,160,0.55)' : undefined }}>
                                <Portrait n={n} size="100%" />
                                <p style={{ margin: '8px 0 0', fontFamily: B.sans, fontSize: i === 0 ? 34 : 26, fontWeight: 300, lineHeight: 1, color: B.goldL }}>{i + 1}<sup style={{ fontSize: 11, fontWeight: 700 }}>{i === 0 ? 'ST' : i === 1 ? 'ND' : 'RD'}</sup></p>
                                <p style={{ margin: '4px 0 0', fontFamily: B.serif, fontSize: 12, color: B.goldL, textTransform: 'uppercase', fontWeight: 300 }}>{f}</p>
                                <p style={{ margin: 0, fontFamily: B.serif, fontSize: 16, color: B.goldL, textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.1 }}>{l}</p>
                              </button>
                            )
                          })}
                        </div>

                        {/* Liste */}
                        <div style={{ ...glass(), padding: 8 }}>
                          {list.map((id, idx) => {
                            const n = nomineeMap.get(id)
                            if (!n) return null
                            const op = official ? official.indexOf(id) + 1 : 0
                            const diff = op ? Math.abs(op - (idx + 1)) : null
                            const rowPts = diff === null ? null : diff === 0 ? sc.exact : diff === 1 ? sc.diff1 : diff === 2 ? sc.diff2 : 0
                            return (
                              <div key={id} className="bdo-row"
                                draggable={!locked}
                                onDragStart={() => setDragIdx(idx)}
                                onDragOver={e => { e.preventDefault() }}
                                onDrop={() => { if (dragIdx !== null) moveTo(cat, dragIdx, idx); setDragIdx(null) }}
                                onDragEnd={() => setDragIdx(null)}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 12, cursor: locked ? 'default' : 'grab',
                                  background: dragIdx === idx ? 'rgba(212,175,106,0.14)' : idx < 3 ? 'rgba(212,175,106,0.05)' : 'transparent',
                                  borderBottom: idx === 2 || idx === 9 ? '1px solid rgba(212,175,106,0.2)' : '1px solid transparent' }}>
                                <span style={{ width: 34, textAlign: 'right', fontFamily: B.serif, fontSize: idx < 3 ? 24 : 19, fontWeight: 600, color: idx < 3 ? B.goldL : B.gold }}>{idx + 1}</span>
                                <Portrait n={n} size={34} radius={7} />
                                <button onClick={() => setModal({ nomineeId: id, catId: cat.id })}
                                  style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: B.text, fontFamily: B.sans }}>
                                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</p>
                                  <p style={{ margin: 0, fontSize: 11, color: B.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[n.club, n.country].filter(Boolean).join(' · ')}</p>
                                </button>
                                {op > 0 && (
                                  <span style={{ fontSize: 11, color: diff === 0 ? B.green : B.muted, whiteSpace: 'nowrap' }}>offiziell {op}.</span>
                                )}
                                {rowPts !== null && (
                                  <span style={{ minWidth: 30, textAlign: 'right', fontWeight: 700, fontSize: 13, color: rowPts > 0 ? B.green : B.faint }}>+{rowPts}</span>
                                )}
                                {!locked && (
                                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                    <input aria-label="Platz" inputMode="numeric" defaultValue={idx + 1} key={`${id}-${idx}`}
                                      onBlur={e => { const v = parseInt(e.target.value); if (!isNaN(v)) moveTo(cat, idx, Math.min(list.length, Math.max(1, v)) - 1); else e.target.value = String(idx + 1) }}
                                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                                      style={{ width: 34, textAlign: 'center', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(212,175,106,0.25)', borderRadius: 7, color: B.goldL, fontSize: 12, padding: '4px 0', outline: 'none' }} />
                                    <button onClick={() => moveTo(cat, idx, idx - 1)} disabled={idx === 0} aria-label="Hoch"
                                      style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(212,175,106,0.2)', background: 'transparent', color: B.goldL, cursor: 'pointer', opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                                    <button onClick={() => moveTo(cat, idx, idx + 1)} disabled={idx === list.length - 1} aria-label="Runter"
                                      style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(212,175,106,0.2)', background: 'transparent', color: B.goldL, cursor: 'pointer', opacity: idx === list.length - 1 ? 0.3 : 1 }}>↓</button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {!locked && (
                          <div style={{ position: 'sticky', bottom: 14, zIndex: 5, ...glass(true), padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, color: B.muted, flex: 1 }}>
                              {dirty ? 'Ungespeicherte Änderungen' : tip?.ranking ? '✓ Deine Rangliste ist gespeichert' : 'Ziehen, Pfeile oder Platz eintippen'}
                            </span>
                            {drafts[cat.id] && (
                              <button onClick={() => setDrafts(p => { const n = { ...p }; delete n[cat.id]; return n })}
                                style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(212,175,106,0.3)', background: 'transparent', color: B.muted, cursor: 'pointer', fontSize: 12 }}>Verwerfen</button>
                            )}
                            <button disabled={saving || (!dirty && !!tip?.ranking)} onClick={async () => { if (await saveTip(cat, { ranking: list })) setDrafts(p => { const n = { ...p }; delete n[cat.id]; return n }) }}
                              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: B.sans,
                                background: (!dirty && !!tip?.ranking) ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#f3d9a0,#d4af6a 55%,#b08a44)',
                                color: (!dirty && !!tip?.ranking) ? B.muted : '#1a1206' }}>
                              {saving ? '…' : 'Rangliste speichern'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </section>
              )
            })()}
          </>
        )}
      </div>

      {/* Detail */}
      {modalNominee && (
        <NomineeModal
          n={modalNominee}
          categoryNames={catsOfNominee(modalNominee.id)}
          officialRank={modalOfficialRank}
          myRank={modalMyRank}
          actionLabel={modalCat?.kind === 'winner' && !locked
            ? (tipMap.get(modalCat.id)?.pick_nominee_id === modalNominee.id ? '✓ Dein Tipp' : 'Als Gewinner tippen')
            : null}
          actionDisabled={saving || (modalCat ? tipMap.get(modalCat.id)?.pick_nominee_id === modalNominee.id : true)}
          onAction={async () => { if (modalCat && await saveTip(modalCat, { pick_nominee_id: modalNominee.id })) setModal(null) }}
          onClose={closeModal}
        />
      )}

      {showAdmin && isAdmin && (
        <BdoAdminPanel editionSlug={edition?.slug ?? null} onClose={() => { setShowAdmin(false); load() }} />
      )}
    </div>
  )
}