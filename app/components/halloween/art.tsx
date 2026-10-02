'use client'

// Selbst gezeichnete Halloween-Grafiken als SVG (keine Emojis):
// Kürbis, Süßigkeiten (Bonbon, Lolli, Candy Corn, Kugel) und das lachende Skelett.

import { useId } from 'react'

/** Kürbis mit geschnitztem, leuchtendem Gesicht */
export function PumpkinArt({ size = 34, glow = true }: { size?: number; glow?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const body = `hwpb${uid}`
  const light = `hwpl${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={body} cx="42%" cy="34%" r="72%">
          <stop offset="0" stopColor="#ffb85c" />
          <stop offset=".5" stopColor="#f7821b" />
          <stop offset="1" stopColor="#b9430b" />
        </radialGradient>
        <radialGradient id={light} cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#fffbd1" />
          <stop offset="1" stopColor={glow ? '#fbbf24' : '#7c2d12'} />
        </radialGradient>
      </defs>
      {/* Stiel und Ranke */}
      <path d="M29.5 16c-.8-5 .8-9.5 6-12.2l2.6 3c-3.2 2-4.4 5-3.6 9.4z" fill="#4d6b22" />
      <path d="M35 11.5c5-4 11.5-2.5 10.6 2.6-.4 2.2-2.6 2.8-3.8 1.6" stroke="#6b8e23" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      {/* Körper aus drei Wölbungen */}
      <ellipse cx="19" cy="38" rx="15" ry="19.5" fill="#d9600f" />
      <ellipse cx="45" cy="38" rx="15" ry="19.5" fill="#d9600f" />
      <ellipse cx="32" cy="38" rx="16" ry="21.5" fill={`url(#${body})`} />
      <path d="M24 19c-5 6-5.6 31 0 38M40 19c5 6 5.6 31 0 38" stroke="#a3410b" strokeOpacity=".45" strokeWidth="1.4" fill="none" />
      {/* Gesicht */}
      <path d="M20.5 33.5l5.8-6.5 4 7.2z" fill={`url(#${light})`} />
      <path d="M43.5 33.5l-5.8-6.5-4 7.2z" fill={`url(#${light})`} />
      <path d="M30.2 38.5l1.8-3.2 1.8 3.2z" fill={`url(#${light})`} />
      <path d="M18.5 42c3 7.5 24 7.5 27 0l-3.6 1.8-2.2 3-2.4-2.4-3.3 2.6-3.3-2.6-2.4 2.4-2.2-3z" fill={`url(#${light})`} />
      <ellipse cx="26" cy="24" rx="5" ry="2.2" fill="#fff" opacity=".18" transform="rotate(-18 26 24)" />
    </svg>
  )
}

export type CandyKind = 'wrap' | 'lolli' | 'corn' | 'ball'
export const CANDY_KINDS: CandyKind[] = ['wrap', 'lolli', 'corn', 'ball']
export const CANDY_COLORS = ['#f43f5e', '#a855f7', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6']

/** Eine Süßigkeit (für die Explosion beim Finden und als Zähler-Symbol) */
export function CandyArt({ kind = 'wrap', color = '#f43f5e', size = 22 }: { kind?: CandyKind; color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {kind === 'wrap' && (
        <g>
          <path d="M9 16 2 10.5v11z" fill={color} opacity=".85" />
          <path d="M23 16l7-5.5v11z" fill={color} opacity=".85" />
          <ellipse cx="16" cy="16" rx="8.5" ry="7" fill={color} />
          <path d="M11 12.5c2.5 2 2.5 5 0 7M16 10c2.5 2.5 2.5 9.5 0 12M21 12.5c-2.5 2-2.5 5 0 7" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" fill="none" />
          <ellipse cx="13" cy="12.5" rx="2.5" ry="1.2" fill="#fff" opacity=".5" />
        </g>
      )}
      {kind === 'lolli' && (
        <g>
          <rect x="15" y="16" width="2.4" height="15" rx="1.2" fill="#f5f0e6" />
          <circle cx="16.2" cy="11" r="9" fill={color} />
          <path d="M16.2 11a2.5 2.5 0 1 1 2.5 2.5 5 5 0 1 1-5-5 7.5 7.5 0 1 1 7.5 7.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".85" />
        </g>
      )}
      {kind === 'corn' && (
        <g>
          <path d="M16 3 27 27H5z" fill="#fde047" />
          <path d="M16 3l7.4 16.2H8.6z" fill="#fb923c" />
          <path d="M16 3l3.6 7.8h-7.2z" fill="#fffaf0" />
          <path d="M11 9.5c1-2 2-4 3.2-5.5" stroke="#fff" strokeOpacity=".6" strokeWidth="1.2" fill="none" />
        </g>
      )}
      {kind === 'ball' && (
        <g>
          <circle cx="16" cy="16" r="10" fill={color} />
          <path d="M8 13c5 2 11 2 16 0M8 19c5 2 11 2 16 0" stroke="#fff" strokeOpacity=".5" strokeWidth="1.8" fill="none" />
          <circle cx="12.5" cy="11.5" r="2.3" fill="#fff" opacity=".55" />
        </g>
      )}
    </svg>
  )
}

const BONE = '#f3efe4'
const INK = '#1f1a17'

// Knochen = dunkler, breiter Strich + heller, schmaler Strich darüber
function Bone({ d, w = 9 }: { d: string; w?: number }) {
  return (
    <g>
      <path d={d} stroke={INK} strokeWidth={w + 5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={d} stroke={BONE} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  )
}

/** Lachendes Skelett (Kiefer klappert per CSS-Animation .hw-jaw / .hw-skel) */
export function SkeletonArt({ size = 220 }: { size?: number }) {
  const bone = BONE
  const ink = INK
  return (
    <svg className="hw-skel" width={size} height={size * 1.2} viewBox="0 0 200 240" aria-hidden="true" focusable="false">
      {/* Wirbelsäule und Rippen */}
      <Bone d="M100 138v80" w={7} />
      {[0, 1, 2, 3].map(i => (
        <g key={i}>
          <Bone d={`M100 ${156 + i * 14}c-14 -6 -30 -2 -36 ${8 - i}`} w={6} />
          <Bone d={`M100 ${156 + i * 14}c14 -6 30 -2 36 ${8 - i}`} w={6} />
        </g>
      ))}
      <Bone d="M70 152h60" w={7} />
      {/* Linker Arm hält sich den Bauch */}
      <Bone d="M70 152l-20 34 34 14" w={8} />
      <circle cx="88" cy="201" r="7" fill={bone} stroke={ink} strokeWidth="3" />
      {/* Rechter Arm zeigt auf dich */}
      <g className="hw-point">
        <Bone d="M130 152l26 -10 22 -26" w={8} />
        <Bone d="M178 116l10 -12" w={5} />
        <circle cx="179" cy="115" r="6.5" fill={bone} stroke={ink} strokeWidth="3" />
      </g>
      {/* Schädel */}
      <path d="M58 70c0-42 84-42 84 0 0 20-9 30-15 37H73c-6-7-15-17-15-37z" fill={bone} stroke={ink} strokeWidth="4" />
      <ellipse cx="82" cy="72" rx="13" ry="15" fill={ink} />
      <ellipse cx="118" cy="72" rx="13" ry="15" fill={ink} />
      <circle className="hw-eye" cx="84" cy="74" r="3.6" fill="#fb923c" />
      <circle className="hw-eye" cx="116" cy="74" r="3.6" fill="#fb923c" />
      <path d="M100 86l-6 11h12z" fill={ink} />
      <path d="M76 107h48" stroke={ink} strokeWidth="3" />
      {[84, 92, 100, 108, 116].map(x => <path key={x} d={`M${x} 101v8`} stroke={ink} strokeWidth="2.4" />)}
      {/* Unterkiefer (klappert) */}
      <g className="hw-jaw">
        <path d="M74 110h52c0 15-12 24-26 24s-26-9-26-24z" fill={bone} stroke={ink} strokeWidth="4" />
        {[84, 92, 100, 108, 116].map(x => <path key={x} d={`M${x} 110v8`} stroke={ink} strokeWidth="2.4" />)}
      </g>
    </svg>
  )
}

/** Fledermaus für die Shop-Seite */
export function BatArt({ size = 40, color = '#0b0612' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 64 32" aria-hidden="true" focusable="false">
      <path d="M32 10c-2-4-3-6-3-8 2 1 3 2 3 3 0-1 1-2 3-3 0 2-1 4-3 8 4 0 6 3 6 3 4-5 13-7 22-5-5 2-7 6-7 10-3-3-7-3-9 0-2-2-6-2-8 1-1-2-3-3-4-3s-3 1-4 3c-2-3-6-3-8-1-2-3-6-3-9 0 0-4-2-8-7-10 9-2 18 0 22 5 0 0 2-3 6-3z" fill={color} />
    </svg>
  )
}

// ── Spinnennetz für die Ecken (Ecke oben links, für andere Ecken per CSS spiegeln) ──
// Speichen gehen strahlenförmig aus der Ecke, dazwischen hängen die Fäden zur Ecke hin durch.
const WEB_PATHS = (() => {
  const spokes = 6
  const rings = [46, 82, 120, 160, 200]
  const angle = (i: number) => (Math.PI / 2) * (i / (spokes - 1))
  const pt = (i: number, r: number) => [Math.cos(angle(i)) * r, Math.sin(angle(i)) * r] as const
  const f = (n: number) => n.toFixed(1)
  const spokePaths = Array.from({ length: spokes }, (_, i) => {
    const [x, y] = pt(i, 238)
    return `M0 0L${f(x)} ${f(y)}`
  })
  const ringPaths = rings.map(r => {
    let d = ''
    for (let i = 0; i < spokes - 1; i++) {
      const [x1, y1] = pt(i, r)
      const [x2, y2] = pt(i + 1, r)
      // Kontrollpunkt Richtung Ecke → Faden hängt durch
      const mid = (angle(i) + angle(i + 1)) / 2
      const cr = r * 0.62
      const cx = Math.cos(mid) * cr, cy = Math.sin(mid) * cr
      d += `${i === 0 ? `M${f(x1)} ${f(y1)}` : ''}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`
    }
    return d
  })
  return { spokePaths, ringPaths }
})()

export function WebArt({ size = 240, color = 'rgba(236, 228, 255, .55)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" aria-hidden="true" focusable="false" fill="none" stroke={color} strokeLinecap="round">
      {WEB_PATHS.spokePaths.map((d, i) => <path key={`s${i}`} d={d} strokeWidth="1.6" />)}
      {WEB_PATHS.ringPaths.map((d, i) => <path key={`r${i}`} d={d} strokeWidth={2.2 - i * 0.25} />)}
    </svg>
  )
}

/** Kleine Spinne (hängt an einem Faden, Faden kommt per CSS) */
export function SpiderArt({ size = 30, color = '#0b0612' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <g stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 18 9 12 4 15M16 21 7 19 2 23M17 24 9 27 6 33M18 26 13 32 12 38" />
        <path d="M24 18l7-6 5 3M24 21l9-2 5 4M23 24l8 3 3 6M22 26l5 6 1 6" />
      </g>
      <ellipse cx="20" cy="25" rx="6.5" ry="7.5" fill={color} />
      <circle cx="20" cy="15.5" r="4.5" fill={color} />
      <circle cx="18.4" cy="15" r="1.1" fill="#fb923c" />
      <circle cx="21.6" cy="15" r="1.1" fill="#fb923c" />
    </svg>
  )
}