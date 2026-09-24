'use client'

import React, { useEffect } from 'react'
import { BdoNominee, ageFrom } from '@/app/lib/ballondor'

// ── Theme ───────────────────────────────────────────────────────────────────
export const B = {
  bg: '#07060a',
  gold: '#d4af6a',
  goldL: '#f3d9a0',
  goldD: '#8a6a2e',
  text: '#f6ecd6',
  muted: 'rgba(246,236,214,0.55)',
  faint: 'rgba(246,236,214,0.28)',
  green: '#7fd69b',
  red: '#e57373',
  serif: 'var(--bdo-serif), "Cormorant Garamond", Georgia, serif',
  sans: 'var(--bdo-sans), "Jost", system-ui, sans-serif',
}

export const glass = (strong = false): React.CSSProperties => ({
  background: strong ? 'rgba(255,245,220,0.07)' : 'rgba(255,245,220,0.04)',
  backdropFilter: 'blur(16px) saturate(140%)',
  WebkitBackdropFilter: 'blur(16px) saturate(140%)',
  border: '1px solid rgba(212,175,106,0.18)',
  borderRadius: 18,
  boxShadow: '0 10px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,245,220,0.06)',
})

export const goldText: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f3d9a0 0%, #d4af6a 45%, #8a6a2e 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
}

export function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return ['', parts[0]]
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]]
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

// ── Funkelnder Hintergrund (deterministisch, damit SSR und Client gleich rendern) ──
export function Sparkles({ count = 46 }: { count?: number }) {
  const rnd = (i: number, s: number) => {
    const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% -10%, rgba(212,175,106,0.28) 0%, rgba(212,175,106,0.06) 38%, transparent 65%), radial-gradient(ellipse at 85% 110%, rgba(138,106,46,0.22) 0%, transparent 55%)' }} />
      {Array.from({ length: count }, (_, i) => {
        const size = 1 + rnd(i, 1) * 2.4
        return (
          <span key={i} className="bdo-spark" style={{
            position: 'absolute', left: `${rnd(i, 2) * 100}%`, top: `${rnd(i, 3) * 100}%`,
            width: size, height: size, borderRadius: '50%', background: '#f3d9a0',
            boxShadow: `0 0 ${4 + size * 3}px rgba(243,217,160,0.9)`,
            animationDelay: `${rnd(i, 4) * 6}s`, animationDuration: `${3 + rnd(i, 5) * 5}s`,
          }} />
        )
      })}
      <style>{`
        @keyframes bdoTwinkle { 0%,100% { opacity: 0; transform: translateY(0) scale(.6) } 45% { opacity: .95; transform: translateY(-8px) scale(1) } }
        .bdo-spark { animation-name: bdoTwinkle; animation-iteration-count: infinite; animation-timing-function: ease-in-out; opacity: 0 }
        @media (prefers-reduced-motion: reduce) { .bdo-spark { animation: none; opacity: .35 } }
      `}</style>
    </div>
  )
}

// ── Portrait (Foto oder Monogramm auf Goldverlauf) ─────────────────────────────
export function Portrait({ n, size, radius = 12, fit = 'cover' }: { n: BdoNominee; size: number | string; radius?: number; fit?: 'cover' | 'contain' }) {
  const [err, setErr] = React.useState(false)
  useEffect(() => { setErr(false) }, [n.photo_url])
  const box: React.CSSProperties = {
    width: size, aspectRatio: '4 / 5', borderRadius: radius, overflow: 'hidden', position: 'relative', flexShrink: 0,
    background: 'radial-gradient(circle at 70% 20%, rgba(243,217,160,0.55) 0%, rgba(212,175,106,0.25) 35%, rgba(20,16,10,0.95) 80%)',
  }
  if (n.photo_url && !err) {
    return (
      <div style={box}>
        <img src={n.photo_url} alt={n.name} onError={() => setErr(true)}
          style={{ width: '100%', height: '100%', objectFit: fit, objectPosition: 'center top', display: 'block' }} />
      </div>
    )
  }
  return (
    <div style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: B.serif, fontWeight: 600, fontSize: typeof size === 'number' ? size * 0.34 : 42, ...goldText, letterSpacing: '0.02em' }}>
        {n.nominee_type === 'club' ? n.name.slice(0, 3).toUpperCase() : initials(n.name)}
      </span>
    </div>
  )
}

// ── Nominierten-Karte (Raster) ─────────────────────────────────────────────────
export function NomineeCard({ n, selected, winner, rankLabel, onClick }: {
  n: BdoNominee; selected?: boolean; winner?: boolean; rankLabel?: string | null; onClick: () => void
}) {
  const [first, last] = splitName(n.name)
  return (
    <button onClick={onClick} className="bdo-card"
      style={{
        ...glass(selected), padding: 10, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10,
        borderColor: winner ? B.goldL : selected ? B.gold : 'rgba(212,175,106,0.18)',
        boxShadow: winner ? '0 0 0 1px #f3d9a0, 0 0 38px rgba(243,217,160,0.35)' : selected ? '0 0 26px rgba(212,175,106,0.28)' : glass().boxShadow,
        position: 'relative', color: B.text, fontFamily: B.sans,
      }}>
      <Portrait n={n} size="100%" />
      {(selected || winner || rankLabel) && (
        <span style={{ position: 'absolute', top: 16, left: 16, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', padding: '4px 9px', borderRadius: 20,
          background: winner ? 'linear-gradient(135deg,#f3d9a0,#d4af6a)' : 'rgba(7,6,10,0.75)', color: winner ? '#1a1206' : B.goldL,
          border: `1px solid ${winner ? 'transparent' : 'rgba(212,175,106,0.5)'}`, backdropFilter: 'blur(6px)' }}>
          {winner ? 'GEWINNER' : rankLabel ?? 'DEIN TIPP'}
        </span>
      )}
      <div style={{ padding: '0 4px 4px' }}>
        {first && <p style={{ margin: 0, fontFamily: B.serif, fontWeight: 300, fontSize: 15, color: B.goldL, lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{first}</p>}
        <p style={{ margin: 0, fontFamily: B.serif, fontWeight: 700, fontSize: 19, color: B.goldL, lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{last}</p>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: B.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {[n.club, n.country].filter(Boolean).join(' · ')}
        </p>
      </div>
    </button>
  )
}

// ── Detailansicht (im Stil der offiziellen Ranking-Karten) ───────────────────────
export function NomineeModal({ n, categoryNames, officialRank, myRank, actionLabel, actionDisabled, onAction, onClose }: {
  n: BdoNominee
  categoryNames: string[]
  officialRank?: number | null
  myRank?: number | null
  actionLabel?: string | null
  actionDisabled?: boolean
  onAction?: () => void
  onClose: () => void
}) {
  const [first, last] = splitName(n.name)
  const age = ageFrom(n.birthdate)
  const ordinal = (r: number) => (r === 1 ? 'ST' : r === 2 ? 'ND' : r === 3 ? 'RD' : 'TH')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(3,2,5,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', background: 'linear-gradient(180deg,#0b0906 0%,#060505 100%)', borderRadius: 22, border: '1px solid rgba(212,175,106,0.25)', boxShadow: '0 30px 120px rgba(0,0,0,0.7), 0 0 80px rgba(212,175,106,0.12)', color: B.text, fontFamily: B.sans, position: 'relative' }}>
        <button onClick={onClose} aria-label="Schließen" style={{ position: 'absolute', top: 12, right: 14, zIndex: 2, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,106,0.3)', color: B.goldL, width: 32, height: 32, borderRadius: '50%', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>

        {/* Name */}
        <div style={{ padding: '30px 30px 18px' }}>
          {first && <p style={{ margin: 0, fontFamily: B.serif, fontWeight: 300, fontSize: 'clamp(30px, 8vw, 46px)', color: B.goldL, lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{first}</p>}
          <p style={{ margin: 0, fontFamily: B.serif, fontWeight: 700, fontSize: 'clamp(36px, 10vw, 58px)', color: B.goldL, lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '0.01em' }}>{last}</p>
        </div>

        {/* Bild im Goldrahmen */}
        <div style={{ margin: '0 22px', position: 'relative', padding: 1, borderRadius: 4, background: 'linear-gradient(135deg,#f3d9a0,#8a6a2e 60%,#d4af6a)', boxShadow: '0 0 60px rgba(212,175,106,0.28)' }}>
          <div style={{ position: 'relative', borderRadius: 3, overflow: 'hidden', background: B.bg }}>
            <Portrait n={n} size="100%" radius={0} />
            {/* Ballon d'Or Box */}
            <div style={{ position: 'absolute', top: 14, right: 14, width: 86, border: '1px solid rgba(243,217,160,0.8)', background: 'rgba(5,4,3,0.85)', textAlign: 'center' }}>
              <div style={{ padding: '10px 6px 8px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={B.goldL} strokeWidth="1.2"><circle cx="12" cy="12" r="9" /><path d="M12 7l3 2.2-1.1 3.5h-3.8L9 9.2z" /><path d="M12 3v4M21 12l-6-2.8M3 12l6-2.8M17 20l-3.1-7.3M7 20l3.1-7.3" /></svg>
                <p style={{ margin: '4px 0 0', fontFamily: B.sans, fontSize: 11, color: B.goldL, lineHeight: 1.1, letterSpacing: '0.04em' }}>BALLON<br />D&apos;OR</p>
              </div>
              <div style={{ borderTop: '1px solid rgba(243,217,160,0.6)', padding: '5px 4px', fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: B.goldL }}>
                {officialRank ? 'RANKING' : 'NOMINIERT'}
              </div>
            </div>
            {/* Offizieller Platz */}
            {officialRank && (
              <div style={{ position: 'absolute', left: 18, bottom: 6, display: 'flex', alignItems: 'flex-start', color: B.goldL, fontFamily: B.sans, textShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
                <span style={{ fontSize: 'clamp(80px, 22vw, 130px)', fontWeight: 300, lineHeight: 0.85 }}>{officialRank}</span>
                <span style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{ordinal(officialRank)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Fußzeile wie auf den offiziellen Karten */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', margin: '22px 22px 0', fontSize: 14 }}>
          <div style={{ paddingRight: 12 }}>
            <p style={{ margin: 0, color: B.goldL }}>{n.country ?? '—'}</p>
            {age !== null && <p style={{ margin: '2px 0 0', fontWeight: 700, color: B.goldL }}>{age} Jahre</p>}
          </div>
          <div style={{ borderLeft: '1px solid rgba(212,175,106,0.5)', borderRight: '1px solid rgba(212,175,106,0.5)', padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: B.goldL }}>
            {n.nominee_type === 'club' ? 'Verein' : n.club ?? '—'}
          </div>
          <div style={{ paddingLeft: 12 }}>
            <p style={{ margin: 0, color: B.goldL }}>{n.position ?? (n.nominee_type === 'coach' ? 'Trainer' : n.nominee_type === 'club' ? '' : '—')}</p>
            <p style={{ margin: '2px 0 0', fontWeight: 700, color: B.goldL }}>{categoryNames.length} Kategorie{categoryNames.length !== 1 ? 'n' : ''}</p>
          </div>
        </div>

        {/* Nominiert in */}
        <div style={{ margin: '18px 22px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categoryNames.map(c => (
            <span key={c} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(212,175,106,0.35)', color: B.goldL, background: 'rgba(212,175,106,0.08)' }}>{c}</span>
          ))}
        </div>

        {/* Statistiken */}
        {n.stats.length > 0 && (
          <div style={{ margin: '18px 22px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {n.stats.map((s, i) => (
              <div key={i} style={{ ...glass(), borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ margin: 0, fontFamily: B.serif, fontSize: 26, fontWeight: 600, lineHeight: 1, ...goldText }}>{s.value}</p>
                <p style={{ margin: '4px 0 0', fontSize: 10, color: B.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {n.bio && <p style={{ margin: '16px 22px 0', fontSize: 13, color: B.muted, lineHeight: 1.6 }}>{n.bio}</p>}

        {(myRank || actionLabel) && (
          <div style={{ margin: '20px 22px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            {myRank && <span style={{ fontSize: 12, color: B.muted }}>Dein Tipp: <b style={{ color: B.goldL }}>Platz {myRank}</b></span>}
            <span style={{ flex: 1 }} />
            {actionLabel && onAction && (
              <button onClick={onAction} disabled={actionDisabled}
                style={{ padding: '11px 20px', borderRadius: 12, border: 'none', cursor: actionDisabled ? 'default' : 'pointer', fontFamily: B.sans, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
                  background: actionDisabled ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#f3d9a0,#d4af6a 55%,#b08a44)', color: actionDisabled ? B.muted : '#1a1206',
                  boxShadow: actionDisabled ? 'none' : '0 6px 24px rgba(212,175,106,0.35)' }}>
                {actionLabel}
              </button>
            )}
          </div>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}