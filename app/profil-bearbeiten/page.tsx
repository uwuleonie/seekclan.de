'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'
import { compressImageFile } from '../lib/image-compress'
import ImageCropModal from '../components/ImageCropModal'

// ─── Types ────────────────────────────────────────────────────────────────────

type PresetId = 'default' | 'sunset' | 'ocean' | 'forest' | 'rose' | 'gold' | 'mono' | 'custom'

const PRESETS: { id: PresetId; label: string; accent: string; swatch: string }[] = [
  { id: 'default', label: 'Standard',        accent: '#7C3AED', swatch: 'linear-gradient(135deg,#4F46E5,#7C3AED,#C026D3)' },
  { id: 'sunset',  label: 'Sunset',          accent: '#F97316', swatch: 'linear-gradient(135deg,#F97316,#EF4444,#EC4899)' },
  { id: 'ocean',   label: 'Ocean',           accent: '#0EA5E9', swatch: 'linear-gradient(135deg,#06B6D4,#0EA5E9,#3B82F6)' },
  { id: 'forest',  label: 'Forest',          accent: '#16A34A', swatch: 'linear-gradient(135deg,#16A34A,#22C55E,#84CC16)' },
  { id: 'rose',    label: 'Rosé',            accent: '#EC4899', swatch: 'linear-gradient(135deg,#EC4899,#F472B6,#FB7185)' },
  { id: 'gold',    label: 'Gold',            accent: '#D97706', swatch: 'linear-gradient(135deg,#D97706,#F59E0B,#FCD34D)' },
  { id: 'mono',    label: 'Mono',            accent: '#52525B', swatch: 'linear-gradient(135deg,#3F3F46,#52525B,#71717A)' },
]

type SteamGame = { appid: number; name: string; icon: string }

// ─── Glass config (new) ───────────────────────────────────────────────────────

type GlassConfig = {
  color: string       // hex — base tint of the glass
  opacity: number     // 0–100, card background alpha
  blur: number        // 0–40px
  radius: number      // 8–48px
  borderEnabled: boolean
  borderWidth: number // 1–4px
  borderOpacity: number // 0–100
  shadowBlur: number  // 0–60px
  shadowSpread: number // 0–20px
  shadowOpacity: number // 0–100
  shadowColor: string // hex
}

const DEFAULT_GLASS: GlassConfig = {
  color: '#ffffff',
  opacity: 10,
  blur: 20,
  radius: 16,
  borderEnabled: true,
  borderWidth: 1,
  borderOpacity: 18,
  shadowBlur: 20,
  shadowSpread: 0,
  shadowOpacity: 15,
  shadowColor: '#000000',
}

function glassToCSS(g: GlassConfig, accent: string): React.CSSProperties {
  const hex = g.color === 'accent' ? accent : g.color
  const r = parseInt(hex.slice(1, 3), 16)
  const ro = parseInt(g.color.slice(1, 3), 16)
  const go2 = parseInt(g.color.slice(3, 5), 16)
  const b2 = parseInt(g.color.slice(5, 7), 16)
  const sr = parseInt(g.shadowColor.slice(1, 3), 16)
  const sg = parseInt(g.shadowColor.slice(3, 5), 16)
  const sb = parseInt(g.shadowColor.slice(5, 7), 16)
  return {
    background: `rgba(${ro},${go2},${b2},${g.opacity / 100})`,
    backdropFilter: `blur(${g.blur}px)`,
    WebkitBackdropFilter: `blur(${g.blur}px)`,
    borderRadius: `${g.radius}px`,
    border: g.borderEnabled
      ? `${g.borderWidth}px solid rgba(${ro},${go2},${b2},${g.borderOpacity / 100})`
      : 'none',
    boxShadow: `0 0 ${g.shadowBlur}px ${g.shadowSpread}px rgba(${sr},${sg},${sb},${g.shadowOpacity / 100})`,
  }
}

function glassToCSSString(g: GlassConfig): string {
  const hex = g.color
  const r = parseInt(hex.slice(1, 3), 16)
  const go2 = parseInt(hex.slice(3, 5), 16)
  const b2 = parseInt(hex.slice(5, 7), 16)
  const sr = parseInt(g.shadowColor.slice(1, 3), 16)
  const sg = parseInt(g.shadowColor.slice(3, 5), 16)
  const sb = parseInt(g.shadowColor.slice(5, 7), 16)
  return `.glass-card {
  background: rgba(${r}, ${go2}, ${b2}, ${(g.opacity / 100).toFixed(2)});
  backdrop-filter: blur(${g.blur}px);
  -webkit-backdrop-filter: blur(${g.blur}px);
  border-radius: ${g.radius}px;${g.borderEnabled ? `
  border: ${g.borderWidth}px solid rgba(${r}, ${go2}, ${b2}, ${(g.borderOpacity / 100).toFixed(2)});` : ''}
  box-shadow: 0 0 ${g.shadowBlur}px ${g.shadowSpread}px rgba(${sr}, ${sg}, ${sb}, ${(g.shadowOpacity / 100).toFixed(2)});
}`
}

// ─── CSS → GlassConfig Parser ─────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function parseCSSToGlass(css: string): Partial<GlassConfig> | null {
  const result: Partial<GlassConfig> = {}
  try {
    // background: rgba(r,g,b,a)
    const bg = css.match(/background\s*:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/)
    if (bg) {
      result.color = rgbToHex(+bg[1], +bg[2], +bg[3])
      result.opacity = Math.round(parseFloat(bg[4]) * 100)
    }
    // backdrop-filter: blur(Npx)
    const blur = css.match(/backdrop-filter\s*:\s*blur\(\s*([\d.]+)px\s*\)/)
    if (blur) result.blur = Math.round(parseFloat(blur[1]))
    // border-radius: Npx
    const radius = css.match(/border-radius\s*:\s*([\d.]+)px/)
    if (radius) result.radius = Math.round(parseFloat(radius[1]))
    // border: Npx solid rgba(r,g,b,a)
    const border = css.match(/border\s*:\s*([\d.]+)px\s+solid\s+rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/)
    if (border) {
      result.borderEnabled = true
      result.borderWidth   = Math.round(parseFloat(border[1]))
      result.borderOpacity = Math.round(parseFloat(border[5]) * 100)
    } else if (css.includes('border') && css.match(/border\s*:\s*none/)) {
      result.borderEnabled = false
    }
    // box-shadow: 0 0 Blur Spread rgba(r,g,b,a)
    const shadow = css.match(/box-shadow\s*:\s*[\d.-]+px\s+[\d.-]+px\s+([\d.]+)px\s+([\d.-]+)px\s+rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/)
    if (shadow) {
      result.shadowBlur    = Math.round(parseFloat(shadow[1]))
      result.shadowSpread  = Math.round(parseFloat(shadow[2]))
      result.shadowColor   = rgbToHex(+shadow[3], +shadow[4], +shadow[5])
      result.shadowOpacity = Math.round(parseFloat(shadow[6]) * 100)
    }
    return Object.keys(result).length > 0 ? result : null
  } catch { return null }
}

// ─── Saved design presets (localStorage) ─────────────────────────────────────

const LS_KEY = 'seekclan_glass_presets'

type SavedPreset = {
  id: string
  name: string
  savedAt: string
  fromUser?: string
  glass: GlassConfig
  accent?: string
}

function loadPresets(): SavedPreset[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

function savePreset(p: Omit<SavedPreset, 'id' | 'savedAt'>): SavedPreset {
  const presets = loadPresets()
  const entry: SavedPreset = { ...p, id: Date.now().toString(), savedAt: new Date().toISOString() }
  if (typeof window !== 'undefined')
    localStorage.setItem(LS_KEY, JSON.stringify([entry, ...presets].slice(0, 30)))
  return entry
}

function deletePreset(id: string) {
  const presets = loadPresets().filter(p => p.id !== id)
  if (typeof window !== 'undefined')
    localStorage.setItem(LS_KEY, JSON.stringify(presets))
}

// ─── CSS / Import-Export Modal ────────────────────────────────────────────────

function CSSModal({ css, accent, onClose, onImport }: {
  css: string; accent: string; onClose: () => void; onImport: (g: Partial<GlassConfig>) => void
}) {
  const [tab, setTab]         = useState<'export' | 'import'>('export')
  const [copied, setCopied]   = useState(false)
  const [importText, setImportText] = useState('')
  const [parseError, setParseError] = useState('')
  const [parseOk, setParseOk]       = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(css)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleImport = () => {
    setParseError(''); setParseOk(false)
    const result = parseCSSToGlass(importText)
    if (!result) { setParseError('Kein gültiges Glass-CSS gefunden. Prüfe das Format.'); return }
    onImport(result)
    setParseOk(true)
    setTimeout(onClose, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex gap-1">
            {(['export', 'import'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={tab === t ? { background: accent, color: '#fff' } : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
                {t === 'export' ? 'CSS exportieren' : 'CSS importieren'}
              </button>
            ))}
          </div>
          <button onClick={onClose}
            className="text-xs px-2 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>✕</button>
        </div>

        <div className="p-5">
          {tab === 'export' ? (
            <>
              <pre className="text-xs leading-relaxed overflow-x-auto p-4 rounded-xl mb-4"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#a5b4fc', fontFamily: 'monospace' }}>
                {css}
              </pre>
              <button onClick={copy}
                className="w-full py-2 rounded-xl text-sm font-medium transition-all"
                style={{ background: copied ? '#22c55e' : accent, color: '#fff' }}>
                {copied ? '✓ Kopiert!' : 'CSS kopieren'}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Füge CSS ein das du von einem anderen Profil oder dem Export kopiert hast. Unterstützte Properties: background, backdrop-filter, border-radius, border, box-shadow.
              </p>
              <textarea
                value={importText}
                onChange={e => { setImportText(e.target.value); setParseError(''); setParseOk(false) }}
                placeholder={`.glass-card {\n  background: rgba(255, 255, 255, 0.09);\n  backdrop-filter: blur(20px);\n  border-radius: 16px;\n  border: 1px solid rgba(255, 255, 255, 0.15);\n  box-shadow: 0 0 20px 0px rgba(0, 0, 0, 0.15);\n}`}
                rows={8}
                className="w-full rounded-xl px-4 py-3 text-xs font-mono outline-none resize-none mb-3"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#a5b4fc' }}
              />
              {parseError && <p className="text-xs mb-3 text-red-400">{parseError}</p>}
              {parseOk    && <p className="text-xs mb-3 text-green-400">Importiert!</p>}
              <button onClick={handleImport}
                className="w-full py-2 rounded-xl text-sm font-medium"
                style={{ background: accent, color: '#fff' }}>
                Importieren & anwenden
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, unit = '', accent, onChange }: {
  label: string; value: number; min: number; max: number; unit?: string; accent: string; onChange: (v: number) => void
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
        <span className="text-xs font-mono px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.08)', color: accent }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: accent, background: `linear-gradient(to right, ${accent} ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 0%)` }}
      />
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ label, value, accent, onChange }: { label: string; value: boolean; accent: string; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        className="w-9 h-5 rounded-full transition-all relative flex-shrink-0"
        style={{ background: value ? accent : 'rgba(255,255,255,0.12)' }}>
        <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all"
          style={{ left: value ? '18px' : '2px' }} />
      </button>
    </div>
  )
}

// ─── Color swatch picker ──────────────────────────────────────────────────────

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center justify-between mb-4">
      <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{value}</span>
        <button
          onClick={() => ref.current?.click()}
          className="w-7 h-7 rounded-lg border-2 border-white/20 transition-transform hover:scale-110 flex-shrink-0"
          style={{ background: value }} />
        <input ref={ref} type="color" value={value} onChange={e => onChange(e.target.value)} className="sr-only" />
      </div>
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest mb-3 mt-5 first:mt-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
      {children}
    </p>
  )
}

// ─── Full-fidelity profile preview ───────────────────────────────────────────

function PreviewPane({ accent, glass, banner, background, bgBlur, avatarSrc, displayName, username, statusText, biography, badges }: {
  accent: string; glass: GlassConfig; banner: string | null; background: string | null
  bgBlur: number; avatarSrc: string; displayName: string; username: string
  statusText: string; biography: string; badges: { id: string; name: string; icon_url: string }[]
}) {
  const r = parseInt(accent.slice(1, 3), 16)
  const g = parseInt(accent.slice(3, 5), 16)
  const b = parseInt(accent.slice(5, 7), 16)
  const rgb = `${r},${g},${b}`
  const card = glassToCSS(glass, accent)

  const STUFEN = ['Neuling','Mitglied','Treues Mitglied','Vertrauter','Goat','OG']
  const stufeIndex = 2
  const levelProgress = { level: 14, current: 1240, needed: 1500, percent: 83 }

  return (
    <div className="relative w-full overflow-y-auto overflow-x-hidden" style={{ background: '#080810', height: '100%' }}>

      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {background && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: `blur(${bgBlur + 22}px)`, transform: 'scale(1.15)', opacity: 0.28 }} />
        )}
        <div style={{ position: 'absolute', top: '-15%', left: '10%', width: '80%', height: '70%', background: `radial-gradient(circle, rgba(${rgb},0.18) 0%, transparent 65%)`, filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,16,0.30)' }} />
      </div>

      {/* Banner */}
      <div style={{ position: 'relative', zIndex: 1, height: '140px', background: banner ? `url(${banner}) center/cover` : `linear-gradient(135deg, rgba(${rgb},0.6), rgba(${rgb},0.12))` }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, #080810 100%)' }} />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px', margin: '0 auto', padding: '0 24px 48px', marginTop: '-48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '24px' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0, width: '88px', height: '88px' }}>
            <div style={{ position: 'absolute', inset: '-3px', borderRadius: '24px', background: accent, boxShadow: `0 0 16px rgba(${rgb},0.6)`, padding: '2.5px' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '21px', background: '#080810' }} />
            </div>
            <div style={{ position: 'absolute', inset: '2px', borderRadius: '20px', overflow: 'hidden' }}>
              <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '18px', height: '18px', borderRadius: '50%', background: '#22c55e', border: '3px solid #080810', boxShadow: '0 0 10px #22c55e88' }} />
          </div>

          {/* Name */}
          <div style={{ flex: 1, marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>{displayName || username}</span>
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 600, background: 'rgba(147,51,234,0.2)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.2)' }}>Mitglied</span>
            </div>
            {displayName && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.32)', marginBottom: '2px' }}>@{username}</p>}
            {statusText && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ color: accent }}>●</span>{statusText}</p>}
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>Gerade online</p>
          </div>
        </div>

        {/* Bio + Badges */}
        {(biography || badges.length > 0) && (
          <div style={{ ...card, marginBottom: '12px', padding: '16px' }}>
            {biography && (
              <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.65)', marginBottom: badges.length > 0 ? '12px' : '0' }}>
                {biography}
              </p>
            )}
            {badges.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {badges.slice(0, 8).map(badge => (
                  <div key={badge.id} style={{ width: '30px', height: '30px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {(badge.icon_url.startsWith('http') || badge.icon_url.startsWith('/'))
                      ? <img src={badge.icon_url} alt={badge.name} style={{ width: '20px', height: '20px', objectFit: 'contain', borderRadius: '4px' }} />
                      : <span style={{ fontSize: '14px' }}>{badge.icon_url}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stufe Zeitstrahl */}
        <div style={{ ...card, marginBottom: '12px', padding: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: '12px', letterSpacing: '0.05em' }}>CLAN-WEG</p>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'absolute', top: '16px', left: '16px', height: '1px', width: `${(stufeIndex / (STUFEN.length - 1)) * 100}%`, background: `linear-gradient(to right, ${accent}, rgba(${rgb},0.3))` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              {STUFEN.map((s, i) => (
                <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '15%' }}>
                  <div style={{ filter: i <= stufeIndex ? 'none' : 'grayscale(1) opacity(0.25)', zIndex: 1 }}>
                    <img src={`/api/uploads/badge-icons/stufe${i}.png`} alt={s} style={{ width: '32px', height: '32px', objectFit: 'contain', filter: i === stufeIndex ? `drop-shadow(0 0 6px rgba(${rgb},0.9))` : undefined }} />
                  </div>
                  <span style={{ fontSize: '9px', textAlign: 'center', color: i === stufeIndex ? '#fff' : i < stufeIndex ? `rgba(${rgb},0.7)` : 'rgba(255,255,255,0.18)', fontWeight: i === stufeIndex ? 700 : 400 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Level + Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={{ ...card, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.05em' }}>CLAN LEVEL</p>
              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: `rgba(${rgb},0.15)`, color: accent }}>{levelProgress.current}/{levelProgress.needed} XP</span>
            </div>
            <p style={{ fontSize: '40px', fontWeight: 900, color: accent, lineHeight: 1, marginBottom: '10px', textShadow: `0 0 30px rgba(${rgb},0.5)` }}>{levelProgress.level}</p>
            <div style={{ height: '6px', borderRadius: '99px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', borderRadius: '99px', width: `${levelProgress.percent}%`, background: `linear-gradient(to right, rgba(${rgb},0.7), ${accent})` }} />
            </div>
          </div>
          <div style={{ ...card, padding: '16px' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>SMP-STATS</p>
            {[
              { label: '⏱ Spielzeit', val: '247 h',  rank: '#3',  top: true },
              { label: '⚔️ Kills',    val: '1.2k',   rank: '#7',  top: false },
              { label: '💀 Deaths',   val: '83',      rank: '#11', top: false },
              { label: '⛏ Gebaut',   val: '48.3k',   rank: '#2',  top: true },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', width: '70px', flexShrink: 0 }}>{s.label}</span>
                <div style={{ flex: 1, height: '4px', borderRadius: '99px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ height: '100%', borderRadius: '99px', width: s.top ? '85%' : '45%', background: s.top ? accent : `rgba(${rgb},0.4)` }} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: s.top ? accent : 'rgba(255,255,255,0.3)' }}>{s.rank}{s.top ? ' 🔥' : ''}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
  const r = parseInt(accent.slice(1, 3), 16)
  const g = parseInt(accent.slice(3, 5), 16)
  const b = parseInt(accent.slice(5, 7), 16)
  const rgb = `${r},${g},${b}`
  const card = glassToCSS(glass, accent)

  // Simulated data
  const STUFEN = ['Neuling','Mitglied','Treues Mitglied','Vertrauter','Goat','OG']
  const stufeIndex = 2
  const stufePercent = 72
  const levelProgress = { level: 14, current: 1240, needed: 1500, percent: 83 }

  return (
    <div className="relative w-full overflow-y-auto overflow-x-hidden"
      style={{ background: '#080810', height: '100%' }}>

      {/* ── Ambient background ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        {background && (
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${background})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: `blur(${bgBlur + 22}px)`,
            transform: 'scale(1.15)', opacity: 0.28,
          }} />
        )}
        <div style={{
          position: 'absolute', top: '-15%', left: '10%',
          width: '80%', height: '70%',
          background: `radial-gradient(circle, rgba(${rgb},0.18) 0%, transparent 65%)`,
          filter: 'blur(50px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '5%', right: '-5%',
          width: '50%', height: '50%',
          background: `radial-gradient(circle, rgba(${rgb},0.09) 0%, transparent 65%)`,
          filter: 'blur(70px)',
        }} />
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,16,0.30)' }} />
      </div>

      {/* ── Banner ── */}
      <div style={{ position: 'relative', zIndex: 1, height: '140px', flexShrink: 0,
        background: banner ? `url(${banner}) center/cover` : `linear-gradient(135deg, rgba(${rgb},0.6) 0%, rgba(${rgb},0.12) 100%)` }}>
        <div style={{ position: 'absolute', inset: '0 0 0 0', height: '100%',
          background: 'linear-gradient(to bottom, transparent 40%, #080810 100%)' }} />
      </div>

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '680px', margin: '0 auto', padding: '0 24px 48px', marginTop: '-48px' }}>

        {/* ── Header row ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '24px' }}>

          {/* Avatar with animated halo */}
          <div style={{ position: 'relative', flexShrink: 0, width: '88px', height: '88px' }}>
            {/* Rotating ring */}
            <div style={{
              position: 'absolute', inset: '-3px',
              borderRadius: '24px',
              background: `conic-gradient(from 0deg, rgba(${rgb},1), rgba(${rgb},0.1), rgba(${rgb},1))`,
              animation: 'spin 4s linear infinite',
            }} />
            <div style={{ position: 'absolute', inset: '-6px', borderRadius: '26px', opacity: 0.35,
              background: `radial-gradient(circle, rgba(${rgb},0.7) 0%, transparent 70%)`, filter: 'blur(8px)' }} />
            <div style={{ position: 'absolute', inset: '2px', borderRadius: '20px', overflow: 'hidden' }}>
              <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {/* Online dot */}
            <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '18px', height: '18px',
              borderRadius: '50%', background: '#22c55e', border: '3px solid #080810',
              boxShadow: '0 0 10px #22c55e88' }} />
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>

          {/* Name block */}
          <div style={{ flex: 1, marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {displayName || username}
              </span>
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', fontWeight: 600,
                background: 'rgba(147,51,234,0.2)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.2)' }}>
                Mitglied
              </span>
            </div>
            {displayName && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.32)', marginBottom: '2px' }}>@{username}</p>
            )}
            {statusText && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: accent }}>●</span>{statusText}
              </p>
            )}
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>Gerade online</p>
          </div>

          {/* Edit button */}
          <div style={{ flexShrink: 0, marginBottom: '4px' }}>
            <div style={{ fontSize: '12px', padding: '7px 14px', borderRadius: '12px', fontWeight: 500, color: '#fff',
              background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.12)' }}>
              ✏️ Bearbeiten
            </div>
          </div>
        </div>

        {/* ── Bio + Badges card ── */}
        <div style={{ ...card, marginBottom: '12px', padding: '16px' }}>
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'rgba(255,255,255,0.65)', marginBottom: '12px' }}>
            Willkommen auf meinem Profil! Hier kannst du alles über mich erfahren.
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['⚔️','🏆','🌟','🎯','🔥','💎','🎮','👑'].map((emoji, i) => (
              <div key={i} style={{ width: '30px', height: '30px', borderRadius: '10px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {emoji}
              </div>
            ))}
          </div>
        </div>

        {/* ── Stufe Zeitstrahl ── */}
        <div style={{ ...card, marginBottom: '12px', padding: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: '12px', letterSpacing: '0.05em' }}>CLAN-WEG</p>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '11px', left: '12px', right: '12px', height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'absolute', top: '11px', left: '12px', height: '1px',
              width: `${(stufeIndex / (STUFEN.length - 1)) * 100}%`,
              background: `linear-gradient(to right, ${accent}, rgba(${rgb},0.3))` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              {STUFEN.map((s, i) => (
                <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '15%' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                    background: i === stufeIndex ? accent : i < stufeIndex ? `rgba(${rgb},0.35)` : 'rgba(255,255,255,0.05)',
                    border: i === stufeIndex ? `2px solid rgba(255,255,255,0.3)` : `1px solid rgba(${rgb},${i < stufeIndex ? '0.5' : '0.1'})`,
                    boxShadow: i === stufeIndex ? `0 0 12px rgba(${rgb},0.8)` : 'none' }}>
                    {i <= stufeIndex && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: i === stufeIndex ? '#fff' : `rgba(${rgb},0.9)` }} />}
                  </div>
                  <span style={{ fontSize: '9px', textAlign: 'center', lineHeight: 1.3, color: i === stufeIndex ? '#fff' : i < stufeIndex ? `rgba(${rgb},0.7)` : 'rgba(255,255,255,0.18)', fontWeight: i === stufeIndex ? 700 : 400 }}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '10px' }}>180 Tage dabei · noch 185 bis Vertrauter</p>
        </div>

        {/* ── Level + SMP Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          {/* Level */}
          <div style={{ ...card, padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.05em' }}>CLAN LEVEL</p>
              <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: `rgba(${rgb},0.15)`, color: accent }}>
                {levelProgress.current}/{levelProgress.needed} XP
              </span>
            </div>
            <p style={{ fontSize: '40px', fontWeight: 900, color: accent, lineHeight: 1, marginBottom: '10px',
              textShadow: `0 0 30px rgba(${rgb},0.5)` }}>
              {levelProgress.level}
            </p>
            <div style={{ height: '6px', borderRadius: '99px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', borderRadius: '99px', width: `${levelProgress.percent}%`,
                background: `linear-gradient(to right, rgba(${rgb},0.7), ${accent})` }} />
            </div>
          </div>

          {/* SMP Stats */}
          <div style={{ ...card, padding: '16px' }}>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '10px' }}>SMP-STATS</p>
            {[
              { label: '⏱ Spielzeit', val: '247 h',  rank: '#3',  top: true },
              { label: '⚔️ Kills',     val: '1.2k',  rank: '#7',  top: false },
              { label: '💀 Deaths',    val: '83',     rank: '#11', top: false },
              { label: '⛏ Gebaut',    val: '48.3k',  rank: '#2',  top: true },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', width: '70px', flexShrink: 0 }}>{s.label}</span>
                <div style={{ flex: 1, height: '4px', borderRadius: '99px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ height: '100%', borderRadius: '99px', width: s.top ? '85%' : '45%',
                    background: s.top ? accent : `rgba(${rgb},0.4)` }} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, flexShrink: 0, color: s.top ? accent : 'rgba(255,255,255,0.3)' }}>
                  {s.rank}{s.top ? ' 🔥' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Spotify mock ── */}
        <div style={{ ...card, padding: '14px 16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `rgba(${rgb},0.25)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🎵</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>Hört gerade</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '1px' }}>Never Gonna Give You Up</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Rick Astley</p>
            </div>
            <svg style={{ width: '18px', height: '18px', flexShrink: 0 }} viewBox="0 0 24 24" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          </div>
          <div style={{ marginTop: '10px', height: '3px', borderRadius: '99px', overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
            <div style={{ height: '100%', width: '38%', background: '#1DB954', borderRadius: '99px' }} />
          </div>
        </div>

        {/* ── Freunde ── */}
        <div style={{ ...card, padding: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', marginBottom: '12px' }}>
            FREUNDE <span style={{ color: 'rgba(255,255,255,0.2)' }}>(6)</span>
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {['Steve','Alex','Notch','Herobrine','Dream','TechNo'].map(name => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.2)` }} />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProfilBearbeitenPage() {
  const { user, loading } = useAuth()

  // Existing fields
  const [theme, setTheme]             = useState<PresetId>('default')
  const [accent, setAccent]           = useState('#7C3AED')
  const [profilePic, setProfilePic]   = useState<string | null>(null)
  const [banner, setBanner]           = useState<string | null>(null)
  const [background, setBackground]   = useState<string | null>(null)
  const [bgBlur, setBgBlur]           = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [statusText, setStatusText]   = useState('')
  const [biography, setBiography]     = useState('')
  const [badges, setBadges]           = useState<{ id: string; name: string; icon_url: string }[]>([])

  // Steam
  const [steamId, setSteamId]                 = useState<string | null>(null)
  const [steamUsername, setSteamUsername]       = useState<string | null>(null)
  const [steamAvatar, setSteamAvatar]           = useState<string | null>(null)
  const [favoriteGames, setFavoriteGames]       = useState<SteamGame[]>([])
  const [gameSearch, setGameSearch]             = useState('')
  const [searchResults, setSearchResults]       = useState<SteamGame[]>([])
  const [searching, setSearching]               = useState(false)
  const [savingGames, setSavingGames]           = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Glass config (new!)
  const [glass, setGlass] = useState<GlassConfig>(DEFAULT_GLASS)
  const updateGlass = useCallback(<K extends keyof GlassConfig>(key: K, val: GlassConfig[K]) => {
    setGlass(prev => ({ ...prev, [key]: val }))
  }, [])

  // UI
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [uploading, setUploading]   = useState<string | null>(null)
  const [showCSS, setShowCSS]       = useState(false)
  const [activeTab, setActiveTab]   = useState<'profile' | 'glass' | 'media' | 'social' | 'presets'>('glass')
  const [cropFile, setCropFile]     = useState<{ file: File; kind: 'avatar' | 'banner' | 'background' } | null>(null)
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([])

  const picInput    = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  const bgInput     = useRef<HTMLInputElement>(null)

  // Load user data
  useEffect(() => {
    if (!user) return
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      const u = d.user
      if (!u) return
      setTheme((u.profile_theme as PresetId) || 'default')
      setAccent(u.accent_color || '#7C3AED')
      setProfilePic(u.profile_picture_url || null)
      setBanner(u.banner_url || null)
      setBackground(u.background_url || null)
      setBgBlur(u.background_blur ?? 0)
      setDisplayName(u.display_name || '')
      setStatusText(u.status_text || '')
      setBiography(u.biography || '')
      // Load badges via profile API
      fetch(`/api/profile/${u.username}`)
        .then(r => r.json())
        .then(d => { if (d.badges) setBadges(d.badges) })
      setSteamId(u.steam_id || null)
      setSteamUsername(u.steam_username || null)
      setSteamAvatar(u.steam_avatar || null)
      setFavoriteGames(u.favorite_games || [])
      // Load glass config if saved, else use defaults but sync opacity to card_opacity
      if (u.glass_config) {
        try { setGlass(JSON.parse(u.glass_config)) } catch {}
      } else if (u.card_opacity != null) {
        setGlass(prev => ({ ...prev, opacity: Math.round((u.card_opacity ?? 0.09) * 100) }))
      }
    })
  }, [user])

  // Load saved presets from localStorage
  useEffect(() => { setSavedPresets(loadPresets()) }, [])

  const saveCurrentAsPreset = () => {
    const name = `Mein Design ${new Date().toLocaleDateString('de-DE')}`
    savePreset({ name, glass, accent, fromUser: user?.username })
    setSavedPresets(loadPresets())
    setSuccess('Design gespeichert!')
  }

  const applyPreset = (p: SavedPreset) => {
    setGlass(p.glass)
    if (p.accent) setAccent(p.accent)
    setActiveTab('glass')
  }

  const removePreset = (id: string) => {
    deletePreset(id)
    setSavedPresets(loadPresets())
  }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'steam_connected') {
      setSuccess('Steam erfolgreich verknüpft! ✨')
      window.history.replaceState({}, '', '/profil-bearbeiten')
      fetch('/api/auth/me').then(r => r.json()).then(async d => {
        const u = d.user; if (!u) return
        setSteamId(u.steam_id || null); setSteamUsername(u.steam_username || null)
        setSteamAvatar(u.steam_avatar || null); setFavoriteGames(u.favorite_games || [])
      })
    }
    if (params.get('error')) {
      setError('Steam-Verknüpfung fehlgeschlagen.')
      window.history.replaceState({}, '', '/profil-bearbeiten')
    }
  }, [])

  // Game search debounce
  useEffect(() => {
    if (!gameSearch || gameSearch.length < 2) { setSearchResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/steam/search?q=${encodeURIComponent(gameSearch)}`)
      const data = await res.json()
      setSearchResults(data.games || []); setSearching(false)
    }, 400)
  }, [gameSearch])

  const addGame = (game: SteamGame) => {
    if (favoriteGames.length >= 5 || favoriteGames.find(g => g.appid === game.appid)) return
    setFavoriteGames([...favoriteGames, game])
    setGameSearch(''); setSearchResults([])
  }
  const removeGame = (appid: number) => setFavoriteGames(favoriteGames.filter(g => g.appid !== appid))

  const saveGames = async () => {
    setSavingGames(true)
    const res = await fetch('/api/profile/favorite-games', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games: favoriteGames }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Fehler') } else { setSuccess('Lieblingsspiele gespeichert!') }
    setSavingGames(false)
  }

  // Datei ausgewählt → Crop-Editor öffnen (außer bei MP4)
  const openCrop = (file: File, kind: 'avatar' | 'banner' | 'background') => {
    setCropFile({ file, kind })
  }

  // Nach Bestätigung im Crop-Editor → komprimieren und hochladen
  const handleCropConfirm = async (croppedFile: File) => {
    const kind = cropFile!.kind
    setCropFile(null)
    await upload(croppedFile, kind)
  }

  const pickPreset = (p: typeof PRESETS[number]) => { setTheme(p.id); setAccent(p.accent) }

  const upload = async (file: File, kind: 'avatar' | 'banner' | 'background') => {
    setUploading(kind); setError(''); setSuccess('')
    try {
      const compressed = await compressImageFile(file, kind)
      const fd = new FormData(); fd.append('file', compressed); fd.append('kind', kind)
      const res = await fetch('/api/profile/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Upload fehlgeschlagen'); setUploading(null); return }

      const url = json.url
      if (kind === 'avatar') setProfilePic(url)
      if (kind === 'banner') setBanner(url)
      if (kind === 'background') setBackground(url)

      // Sofort in DB speichern — nicht auf "Profil speichern" warten
      const fieldMap: Record<string, string> = {
        avatar: 'profile_picture_url',
        banner: 'banner_url',
        background: 'background_url',
      }
      const saveRes = await fetch('/api/profile/customize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldMap[kind]]: url }),
      })
      if (!saveRes.ok) {
        const saveJson = await saveRes.json()
        setError(saveJson.error || 'Bild gespeichert, aber URL nicht in DB')
      }
    } catch { setError('Upload fehlgeschlagen') }
    setUploading(null)
  }

  const save = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/profile/customize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_theme: theme,
          accent_color: accent,
          card_opacity: glass.opacity / 100,
          background_blur: bgBlur,
          display_name: displayName,
          status_text: statusText,
          glass_config: JSON.stringify(glass),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Fehler') } else { setSuccess('Profil gespeichert!') }
    } catch { setError('Ein Fehler ist aufgetreten') }
    setSaving(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-white border-white/20 animate-spin" />
    </div>
  )

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080810' }}>
      <div className="text-center">
        <p className="mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Du musst eingeloggt sein.</p>
        <Link href="/login" className="btn-gradient text-white px-6 py-3 rounded-xl">Einloggen</Link>
      </div>
    </div>
  )

  const avatarSrc = profilePic || `/api/player-heads/${user.username}/80`
  const inputCls = "w-full rounded-xl px-3 py-2 text-sm outline-none text-white"
  const inputStyle = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }

  const tabs = [
    { id: 'glass'   as const, label: '🪟 Glas'   },
    { id: 'profile' as const, label: '👤 Profil' },
    { id: 'media'   as const, label: '🖼 Bilder'  },
    { id: 'social'  as const, label: '🎮 Steam'  },
  ]

  return (
    <div className="min-h-screen flex" style={{ background: '#080810' }}>

      {/* ── Left panel: Settings ── */}
      <div className="w-80 flex-shrink-0 flex flex-col h-screen sticky top-0"
        style={{ background: 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Header */}
        <div className="px-5 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Link href={`/profile/${user.username}`}
            className="text-xs flex items-center gap-1 mb-3 hover:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            ← Profil
          </Link>
          <h1 className="font-bold text-white text-lg">Profil anpassen</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Änderungen werden live angezeigt</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={activeTab === t.id
                ? { background: accent, color: '#fff' }
                : { background: 'transparent', color: 'rgba(255,255,255,0.4)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable settings */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── GLASS TAB ── */}
          {activeTab === 'glass' && (
            <>
              <SectionHead>Glas-Farbe</SectionHead>
              <ColorPicker label="Glasfarbe" value={glass.color} onChange={v => updateGlass('color', v)} />

              <SectionHead>Transparenz & Blur</SectionHead>
              <Slider label="Opacity" value={glass.opacity} min={0} max={60} unit="%" accent={accent}
                onChange={v => updateGlass('opacity', v)} />
              <Slider label="Blur" value={glass.blur} min={0} max={40} unit="px" accent={accent}
                onChange={v => updateGlass('blur', v)} />

              <SectionHead>Form</SectionHead>
              <Slider label="Radius" value={glass.radius} min={4} max={48} unit="px" accent={accent}
                onChange={v => updateGlass('radius', v)} />

              <SectionHead>Rand</SectionHead>
              <Toggle label="Rand aktivieren" value={glass.borderEnabled} accent={accent}
                onChange={v => updateGlass('borderEnabled', v)} />
              {glass.borderEnabled && (
                <>
                  <Slider label="Breite" value={glass.borderWidth} min={1} max={4} unit="px" accent={accent}
                    onChange={v => updateGlass('borderWidth', v)} />
                  <Slider label="Rand-Opacity" value={glass.borderOpacity} min={0} max={100} unit="%" accent={accent}
                    onChange={v => updateGlass('borderOpacity', v)} />
                </>
              )}

              <SectionHead>Schatten</SectionHead>
              <ColorPicker label="Schattenfarbe" value={glass.shadowColor} onChange={v => updateGlass('shadowColor', v)} />
              <Slider label="Blur" value={glass.shadowBlur} min={0} max={60} unit="px" accent={accent}
                onChange={v => updateGlass('shadowBlur', v)} />
              <Slider label="Spread" value={glass.shadowSpread} min={0} max={20} unit="px" accent={accent}
                onChange={v => updateGlass('shadowSpread', v)} />
              <Slider label="Opacity" value={glass.shadowOpacity} min={0} max={100} unit="%" accent={accent}
                onChange={v => updateGlass('shadowOpacity', v)} />

              {/* Reset */}
              <button onClick={() => setGlass(DEFAULT_GLASS)}
                className="w-full mt-2 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-70"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                Zurücksetzen
              </button>

              {/* Als Preset speichern */}
              <button onClick={saveCurrentAsPreset}
                className="w-full mt-2 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                Als Preset speichern ⭐
              </button>

              {/* CSS Export/Import */}
              <button onClick={() => setShowCSS(true)}
                className="w-full mt-2 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: `rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)},0.15)`, color: accent }}>
                CSS exportieren / importieren →
              </button>

              {/* ── Gespeicherte Designs ── */}
              {savedPresets.length > 0 && (
                <>
                  <SectionHead>Gespeicherte Designs</SectionHead>
                  <div className="space-y-2">
                    {savedPresets.map(p => (
                      <div key={p.id} className="p-3 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{p.name}</p>
                            {p.fromUser && (
                              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>von @{p.fromUser}</p>
                            )}
                            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                              {new Date(p.savedAt).toLocaleDateString('de-DE')}
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1.5">
                            <div className="w-8 h-8 rounded-lg flex-shrink-0"
                              style={{ ...glassToCSS(p.glass, p.accent || '#7C3AED'), borderRadius: `${Math.min(p.glass.radius, 12)}px` }} />
                            {p.accent && <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: p.accent }} />}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => applyPreset(p)}
                            className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                            style={{ background: accent, color: '#fff' }}>
                            Anwenden
                          </button>
                          <button onClick={() => removePreset(p.id)}
                            className="px-3 py-1.5 rounded-lg text-xs hover:opacity-70"
                            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── PROFILE TAB ── */}
          {activeTab === 'profile' && (
            <>
              <SectionHead>Spitzname</SectionHead>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder={user.username} maxLength={32}
                className={inputCls} style={{ ...inputStyle, marginBottom: '16px' }} />

              <SectionHead>Status</SectionHead>
              <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Kurzer Text auf deinem Profil, z.B. „🎮 Mining diamonds"</p>
              <div className="relative mb-4">
                <input type="text" value={statusText} onChange={e => setStatusText(e.target.value)}
                  placeholder="Dein Status..." maxLength={60}
                  className={inputCls} style={inputStyle} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: 'rgba(255,255,255,0.2)' }}>{statusText.length}/60</span>
              </div>

              <SectionHead>Akzentfarbe</SectionHead>
              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => pickPreset(p)}
                    className="rounded-xl overflow-hidden transition-all hover:scale-105"
                    style={{ border: accent === p.accent ? `2px solid ${p.accent}` : '2px solid transparent' }}>
                    <div className="h-8 w-full" style={{ background: p.swatch }} />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 mb-4">
                <input type="color" value={accent} onChange={e => { setAccent(e.target.value); setTheme('custom') }}
                  className="w-10 h-10 rounded-xl cursor-pointer flex-shrink-0"
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', padding: '2px' }} />
                <input type="text" value={accent}
                  onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) { setAccent(v); setTheme('custom') } }}
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none font-mono" style={inputStyle} maxLength={7} />
              </div>
            </>
          )}

          {/* ── MEDIA TAB ── */}
          {activeTab === 'media' && (
            <>
              <SectionHead>Profilbild</SectionHead>
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <img src={avatarSrc} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white mb-1">Profilbild</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>PNG, JPG, WEBP, GIF · max 8 MB</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {profilePic && (
                    <button onClick={() => {
                      setProfilePic(null)
                      fetch('/api/profile/customize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_picture_url: null }) })
                    }}
                      className="text-xs px-2 py-1.5 rounded-lg"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>✕</button>
                  )}
                  <button onClick={() => picInput.current?.click()} disabled={uploading === 'avatar'}
                    className="text-xs px-3 py-1.5 rounded-lg text-white transition-all disabled:opacity-50"
                    style={{ background: accent }}>
                    {uploading === 'avatar' ? '…' : profilePic ? 'Ändern' : 'Upload'}
                  </button>
                </div>
                <input ref={picInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) openCrop(f, 'avatar'); e.target.value = '' }} />
              </div>

              <SectionHead>Banner</SectionHead>
              <div className="relative h-20 rounded-xl overflow-hidden mb-3 cursor-pointer group"
                onClick={() => bannerInput.current?.click()}
                style={{ background: banner ? `url(${banner}) center/cover` : `linear-gradient(135deg, rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)},0.3), transparent)` }}>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <span className="text-white text-xs">{uploading === 'banner' ? 'Lädt…' : 'Banner ändern'}</span>
                </div>
                {banner && (
                  <button onClick={e => {
                    e.stopPropagation(); setBanner(null)
                    fetch('/api/profile/customize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ banner_url: null }) })
                  }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>✕</button>
                )}
              </div>
              <input ref={bannerInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) openCrop(f, 'banner'); e.target.value = '' }} />

              <SectionHead>Hintergrundbild</SectionHead>
              <div className="relative h-20 rounded-xl overflow-hidden mb-3 cursor-pointer group"
                onClick={() => bgInput.current?.click()}
                style={{ background: background ? `url(${background}) center/cover` : 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)' }}>
                <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: background ? 0 : 1 }}>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Hintergrund hochladen</span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.4)' }}>
                  <span className="text-white text-xs">{uploading === 'background' ? 'Lädt…' : 'Hintergrund ändern'}</span>
                </div>
                {background && (
                  <button onClick={e => {
                    e.stopPropagation(); setBackground(null)
                    fetch('/api/profile/customize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ background_url: null }) })
                  }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>✕</button>
                )}
              </div>
              <input ref={bgInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) openCrop(f, 'background'); e.target.value = '' }} />

              {background && (
                <>
                  <SectionHead>Hintergrund-Blur</SectionHead>
                  <Slider label="Blur" value={bgBlur} min={0} max={40} unit="px" accent={accent}
                    onChange={setBgBlur} />
                </>
              )}
            </>
          )}

          {/* ── SOCIAL TAB ── */}
          {activeTab === 'social' && (
            <>
              <SectionHead>Steam</SectionHead>
              {steamId ? (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {steamAvatar && <img src={steamAvatar} alt="" className="w-9 h-9 rounded-lg" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{steamUsername || 'Verknüpft'}</p>
                    <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{steamId}</p>
                  </div>
                  <a href="/api/auth/steam" className="text-xs px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
                    Neu
                  </a>
                </div>
              ) : (
                <a href="/api/auth/steam"
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium text-white mb-4 transition-all hover:opacity-90"
                  style={{ background: '#1b2838' }}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                    <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z"/>
                  </svg>
                  <span className="text-sm">Mit Steam verknüpfen</span>
                </a>
              )}

              <SectionHead>Lieblingsspiele ({favoriteGames.length}/5)</SectionHead>
              {favoriteGames.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {favoriteGames.map(game => (
                    <div key={game.appid} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <img src={game.icon} alt={game.name} className="w-10 h-6 rounded object-cover flex-shrink-0" />
                      <span className="text-xs flex-1 truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>{game.name}</span>
                      <button onClick={() => removeGame(game.appid)}
                        className="text-xs hover:opacity-70 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {favoriteGames.length < 5 && (
                <div className="relative mb-3">
                  <input type="text" value={gameSearch} onChange={e => setGameSearch(e.target.value)}
                    placeholder="Spiel suchen..." className={inputCls} style={inputStyle} />
                  {searching && <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Suche...</p>}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 rounded-xl overflow-hidden"
                      style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {searchResults.map(game => (
                        <button key={game.appid} onClick={() => addGame(game)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 hover:opacity-80 transition-all text-left"
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <img src={game.icon} alt={game.name} className="w-10 h-7 rounded object-cover flex-shrink-0" />
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>{game.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {favoriteGames.length > 0 && (
                <button onClick={saveGames} disabled={savingGames}
                  className="w-full py-2 rounded-xl text-xs font-medium text-white transition-all disabled:opacity-50"
                  style={{ background: accent }}>
                  {savingGames ? 'Speichern...' : 'Spiele speichern'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Save footer */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {error && <p className="text-red-400 text-xs mb-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
          {success && <p className="text-green-400 text-xs mb-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)' }}>{success}</p>}
          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)`, boxShadow: `0 4px 20px rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)},0.35)` }}>
            {saving ? 'Speichern...' : 'Profil speichern'}
          </button>
        </div>
      </div>

      {/* ── Right panel: Live preview (full height) ── */}
      <div className="flex-1 relative overflow-hidden" style={{ background: '#060608' }}>
        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-6 py-3 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(6,6,8,0.9) 0%, transparent 100%)' }}>
          <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Live-Vorschau
          </p>
          {/* Glass stats pill */}
          <div className="flex gap-3 pointer-events-auto px-4 py-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              { label: 'Opacity', val: `${glass.opacity}%` },
              { label: 'Blur',    val: `${glass.blur}px`   },
              { label: 'Radius',  val: `${glass.radius}px` },
            ].map((s, i) => (
              <div key={s.label} className="flex items-center gap-1.5">
                {i > 0 && <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)' }} />}
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</span>
                <span className="text-xs font-mono font-semibold" style={{ color: accent }}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable preview fills the entire right pane */}
        <div className="absolute inset-0 overflow-y-auto">
          <PreviewPane
            accent={accent}
            glass={glass}
            banner={banner}
            background={background}
            bgBlur={bgBlur}
            avatarSrc={avatarSrc}
            displayName={displayName}
            username={user.username}
            statusText={statusText}
            biography={biography}
            badges={badges}
          />
        </div>
      </div>

      {/* CSS Modal */}
      {showCSS && (
        <CSSModal
          css={glassToCSSString(glass)}
          accent={accent}
          onClose={() => setShowCSS(false)}
          onImport={partial => {
            setGlass(prev => ({ ...prev, ...partial }))
            setShowCSS(false)
            setSuccess('CSS importiert!')
          }}
        />
      )}

      {/* Crop Modal */}
      {cropFile && (
        <ImageCropModal
          file={cropFile.file}
          kind={cropFile.kind}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}
    </div>
  )
}