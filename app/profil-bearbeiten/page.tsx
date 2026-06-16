'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'

type PresetId = 'default' | 'sunset' | 'ocean' | 'forest' | 'rose' | 'gold' | 'mono' | 'custom'

const PRESETS: { id: PresetId, label: string, accent: string, swatch: string }[] = [
  { id: 'default', label: 'Standard', accent: '#7C3AED', swatch: 'linear-gradient(135deg,#4F46E5,#7C3AED,#C026D3)' },
  { id: 'sunset',  label: 'Sonnenuntergang', accent: '#F97316', swatch: 'linear-gradient(135deg,#F97316,#EF4444,#EC4899)' },
  { id: 'ocean',   label: 'Ozean', accent: '#0EA5E9', swatch: 'linear-gradient(135deg,#06B6D4,#0EA5E9,#3B82F6)' },
  { id: 'forest',  label: 'Wald', accent: '#16A34A', swatch: 'linear-gradient(135deg,#16A34A,#22C55E,#84CC16)' },
  { id: 'rose',    label: 'Rosé', accent: '#EC4899', swatch: 'linear-gradient(135deg,#EC4899,#F472B6,#FB7185)' },
  { id: 'gold',    label: 'Gold', accent: '#D97706', swatch: 'linear-gradient(135deg,#D97706,#F59E0B,#FCD34D)' },
  { id: 'mono',    label: 'Mono', accent: '#52525B', swatch: 'linear-gradient(135deg,#3F3F46,#52525B,#71717A)' },
]

export default function ProfilBearbeitenPage() {
  const { user, loading } = useAuth()

  const [theme, setTheme] = useState<PresetId>('default')
  const [accent, setAccent] = useState('#7C3AED')
  const [cardOpacity, setCardOpacity] = useState(1)
  const [profilePic, setProfilePic] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [background, setBackground] = useState<string | null>(null)
  const [bgBlur, setBgBlur] = useState(0)
  const [displayName, setDisplayName] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)

  const picInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)
  const bgInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      const u = d.user
      if (!u) return
      setTheme((u.profile_theme as PresetId) || 'default')
      setAccent(u.accent_color || '#7C3AED')
      setCardOpacity(u.card_opacity ?? 1)
      setProfilePic(u.profile_picture_url || null)
      setBanner(u.banner_url || null)
      setBackground(u.background_url || null)
      setBgBlur(u.background_blur ?? 0)
      setDisplayName(u.display_name || '')
    })
  }, [user])

  const pickPreset = (p: typeof PRESETS[number]) => {
    setTheme(p.id)
    setAccent(p.accent)
  }

  const onCustomColor = (hex: string) => {
    setAccent(hex)
    setTheme('custom')
  }

  const upload = async (file: File, kind: 'avatar' | 'banner' | 'background') => {
    setUploading(kind); setError(''); setSuccess('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('kind', kind)
      const res = await fetch('/api/profile/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Upload fehlgeschlagen'); setUploading(null); return }
      if (kind === 'avatar') setProfilePic(json.url)
      if (kind === 'banner') setBanner(json.url)
      if (kind === 'background') setBackground(json.url)
    } catch { setError('Upload fehlgeschlagen') }
    setUploading(null)
  }

  const save = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/profile/customize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_theme: theme,
          accent_color: accent,
          card_opacity: cardOpacity,
          profile_picture_url: profilePic,
          banner_url: banner,
          background_url: background,
          background_blur: bgBlur,
          display_name: displayName,
        }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Fehler')
      else setSuccess('Profil gespeichert! ✨')
    } catch { setError('Ein Fehler ist aufgetreten') }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Laden...</div>

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="text-center">
        <p className="mb-4" style={{ color: 'var(--muted)' }}>Du musst eingeloggt sein.</p>
        <Link href="/login" className="btn-gradient text-white px-6 py-3 rounded-xl">Einloggen</Link>
      </div>
    </div>
  )

  const inputStyle = { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
  const avatarSrc = profilePic || `https://mc-heads.net/avatar/${user.username}/80`

  // Vorschau-Kartenstil (so wie Besucher es sehen werden)
  const previewCardStyle = {
    background: `color-mix(in srgb, var(--card) ${Math.round(cardOpacity * 100)}%, transparent)`,
    border: '1px solid var(--card-border)',
    backdropFilter: cardOpacity < 1 ? 'blur(8px)' : undefined,
  }

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--foreground)' }}>{children}</h2>
  )

  const Hint = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{children}</p>
  )

  const UploadRow = ({ label, value, onClear, inputRef, kind, hint, preview }: {
    label: string, value: string | null, onClear: () => void,
    inputRef: React.RefObject<HTMLInputElement | null>, kind: 'avatar' | 'banner' | 'background',
    hint: string, preview: React.ReactNode,
  }) => (
    <div className="flex items-center gap-4 mb-4">
      {preview}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>{hint}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {value && (
          <button onClick={onClear}
            className="text-sm px-3 py-2 rounded-xl font-medium"
            style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
            Entfernen
          </button>
        )}
        <button onClick={() => inputRef.current?.click()} disabled={uploading === kind}
          className="text-sm px-4 py-2 rounded-xl font-medium text-white disabled:opacity-50"
          style={{ background: accent }}>
          {uploading === kind ? 'Lädt...' : value ? 'Ändern' : 'Hochladen'}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, kind); e.target.value = '' }} />
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-2xl mx-auto px-8 py-10">
        <Link href={`/${user.username}`} className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück zum Profil</Link>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Profil anpassen</h1>
        <p className="mb-6" style={{ color: 'var(--muted)' }}>Besucher sehen dein Profil genau so, wie du es hier gestaltest.</p>

        {error && <p className="text-red-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
        {success && <p className="text-green-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>{success}</p>}

        {/* Live-Vorschau */}
        <div className="rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid var(--card-border)', position: 'relative' }}>
          {/* Hintergrund */}
          <div className="absolute inset-0" style={{
            background: background ? `url(${background}) center/cover` : 'var(--muted-bg)',
            filter: background ? `blur(${bgBlur}px)` : undefined,
            transform: background ? 'scale(1.1)' : undefined,
          }} />
          <div className="relative">
            {/* Banner */}
            <div className="h-24 w-full" style={{ background: banner ? `url(${banner}) center/cover` : `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 50%, #000))` }} />
            <div className="px-5 pb-5">
              <img src={avatarSrc} alt="" className="w-16 h-16 rounded-2xl border-4 -mt-8 mb-2 object-cover" style={{ borderColor: 'var(--card)' }} />
              <div className="rounded-2xl p-4" style={previewCardStyle}>
                <p className="font-bold mb-1" style={{ color: 'var(--foreground)' }}>{user.username}</p>
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>So sieht eine Karte auf deinem Profil aus.</p>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                  <div className="h-full rounded-full" style={{ width: '60%', background: accent }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <SectionTitle>Spitzname</SectionTitle>
          <Hint>Nur du siehst deinen Spitznamen auf deinem eigenen Profil. Andere sehen weiterhin deinen Benutzernamen.</Hint>
          <div className="flex items-center gap-3 mb-6">
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder={user.username}
              maxLength={32}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
            {displayName && (
              <button onClick={() => setDisplayName('')}
                className="text-sm px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
                Entfernen
              </button>
            )}
          </div>
        <div className="card rounded-2xl p-6 mb-6">
          {/* Bilder */}
          <SectionTitle>Bilder</SectionTitle>
          <Hint>PNG, JPG, WEBP oder GIF — max. 8 MB.</Hint>

          <UploadRow
            label="Profilbild" kind="avatar" hint="Ersetzt den Minecraft-Kopf."
            value={profilePic} onClear={() => setProfilePic(null)} inputRef={picInput}
            preview={<img src={avatarSrc} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />} />

          <UploadRow
            label="Banner" kind="banner" hint="Breites Bild oben am Profil."
            value={banner} onClear={() => setBanner(null)} inputRef={bannerInput}
            preview={<div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ background: banner ? `url(${banner}) center/cover` : 'var(--muted-bg)', border: '1px solid var(--card-border)' }} />} />

          <UploadRow
            label="Hintergrundbild" kind="background" hint="Hinter dem gesamten Profil."
            value={background} onClear={() => setBackground(null)} inputRef={bgInput}
            preview={<div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ background: background ? `url(${background}) center/cover` : 'var(--muted-bg)', border: '1px solid var(--card-border)' }} />} />

          {background && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Hintergrund-Unschärfe</label>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{bgBlur}px</span>
              </div>
              <input type="range" min={0} max={40} value={bgBlur}
                onChange={e => setBgBlur(Number(e.target.value))}
                className="w-full" style={{ accentColor: accent }} />
            </div>
          )}
        </div>

        <div className="card rounded-2xl p-6 mb-6">
          {/* Farbthema */}
          <SectionTitle>Farbthema</SectionTitle>
          <Hint>Wähle ein Preset oder eine eigene Akzentfarbe.</Hint>

          <div className="grid grid-cols-4 gap-2 mb-5">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => pickPreset(p)}
                className="rounded-xl p-1 transition-all"
                style={{ border: theme === p.id ? `2px solid ${accent}` : '2px solid transparent' }}>
                <div className="h-10 rounded-lg mb-1" style={{ background: p.swatch }} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{p.label}</span>
              </button>
            ))}
            {/* Custom */}
            <button onClick={() => setTheme('custom')}
              className="rounded-xl p-1 transition-all"
              style={{ border: theme === 'custom' ? `2px solid ${accent}` : '2px solid transparent' }}>
              <div className="h-10 rounded-lg mb-1 flex items-center justify-center text-lg" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>🎨</div>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Eigene</span>
            </button>
          </div>

          <label className="text-sm font-medium block mb-2" style={{ color: 'var(--foreground)' }}>Akzentfarbe</label>
          <div className="flex items-center gap-3">
            <input type="color" value={accent} onChange={e => onCustomColor(e.target.value)}
              className="w-12 h-12 rounded-xl cursor-pointer bg-transparent" style={{ border: '1px solid var(--card-border)' }} />
            <input type="text" value={accent}
              onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onCustomColor(v) }}
              className="rounded-xl px-4 py-2.5 text-sm outline-none font-mono w-32" style={inputStyle} maxLength={7} />
          </div>
        </div>

        <div className="card rounded-2xl p-6 mb-6">
          {/* Glassmorphism */}
          <SectionTitle>Karten-Transparenz</SectionTitle>
          <Hint>Macht Karten durchsichtig — der Hintergrund schimmert durch (Glaseffekt).</Hint>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Deckkraft</label>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{Math.round(cardOpacity * 100)}%</span>
          </div>
          <input type="range" min={30} max={100} value={Math.round(cardOpacity * 100)}
            onChange={e => setCardOpacity(Number(e.target.value) / 100)}
            className="w-full" style={{ accentColor: accent }} />
        </div>

        <button onClick={save} disabled={saving}
          className="btn-gradient text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50 w-full">
          {saving ? 'Speichern...' : 'Profil speichern'}
        </button>
      </div>
    </div>
  )
}