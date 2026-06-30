'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'
import { compressImageFile } from '../lib/image-compress'

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

type SteamGame = { appid: number, name: string, icon: string }

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

  // Steam
  const [steamId, setSteamId] = useState<string | null>(null)
  const [steamUsername, setSteamUsername] = useState<string | null>(null)
  const [steamAvatar, setSteamAvatar] = useState<string | null>(null)
  const [favoriteGames, setFavoriteGames] = useState<SteamGame[]>([])
  const [gameSearch, setGameSearch] = useState('')
  const [searchResults, setSearchResults] = useState<SteamGame[]>([])
  const [searching, setSearching] = useState(false)
  const [savingGames, setSavingGames] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      setSteamId(u.steam_id || null)
      setSteamUsername(u.steam_username || null)
      setSteamAvatar(u.steam_avatar || null)
      setFavoriteGames(u.favorite_games || [])
    })
  }, [user])

  // URL-Params prüfen (Steam Callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'steam_connected') {
      setSuccess('Steam erfolgreich verknüpft! ✨')
      window.history.replaceState({}, '', '/profil-bearbeiten')
      fetch('/api/auth/me').then(r => r.json()).then(async d => {
        const u = d.user
        if (!u) return
        const id = u.steam_id || null
        setSteamId(id)
        setSteamUsername(u.steam_username || null)
        setSteamAvatar(u.steam_avatar || null)
        setFavoriteGames(u.favorite_games || [])
        if (id && !u.steam_username) {
          const profileRes = await fetch(`/api/steam/profile?steamId=${id}`)
          const profileData = await profileRes.json()
          if (profileData.username) {
            setSteamUsername(profileData.username)
            setSteamAvatar(profileData.avatar)
          }
        }
      })
    }
    if (params.get('error')) {
      setError('Steam-Verknüpfung fehlgeschlagen. Bitte versuche es erneut.')
      window.history.replaceState({}, '', '/profil-bearbeiten')
    }
  }, [])

  // Spielesuche mit Debounce
  useEffect(() => {
    if (!gameSearch || gameSearch.length < 2) { setSearchResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/steam/search?q=${encodeURIComponent(gameSearch)}`)
      const data = await res.json()
      setSearchResults(data.games || [])
      setSearching(false)
    }, 400)
  }, [gameSearch])

  const addGame = (game: SteamGame) => {
    if (favoriteGames.length >= 5) return
    if (favoriteGames.find(g => g.appid === game.appid)) return
    setFavoriteGames([...favoriteGames, game])
    setGameSearch('')
    setSearchResults([])
  }

  const removeGame = (appid: number) => {
    setFavoriteGames(favoriteGames.filter(g => g.appid !== appid))
  }

  const saveGames = async () => {
    setSavingGames(true)
    const res = await fetch('/api/profile/favorite-games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games: favoriteGames }),
    })
    const json = await res.json()
    if (!res.ok) setError(json.error || 'Fehler beim Speichern')
    else setSuccess('Lieblingsspiele gespeichert! 🎮')
    setSavingGames(false)
  }

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
      const compressed = await compressImageFile(file)
      const fd = new FormData()
      fd.append('file', compressed)
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
          <div className="absolute inset-0" style={{
            background: background ? `url(${background}) center/cover` : 'var(--muted-bg)',
            filter: background ? `blur(${bgBlur}px)` : undefined,
            transform: background ? 'scale(1.1)' : undefined,
          }} />
          <div className="relative">
            <div className="h-24 w-full" style={{ background: banner ? `url(${banner}) center/cover` : `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 50%, #000))` }} />
            <div className="px-5 pb-5">
              <img src={avatarSrc} alt="" className="w-16 h-16 rounded-2xl border-4 -mt-8 mb-2 object-cover" style={{ borderColor: 'var(--card)' }} />
              <div className="rounded-2xl p-4" style={previewCardStyle}>
                <p className="font-bold mb-1" style={{ color: 'var(--foreground)' }}>{displayName || user.username}</p>
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>So sieht eine Karte auf deinem Profil aus.</p>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                  <div className="h-full rounded-full" style={{ width: '60%', background: accent }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Spitzname */}
        <SectionTitle>Spitzname</SectionTitle>
        <Hint>Wird statt deinem Benutzernamen auf deinem Profil angezeigt.</Hint>
        <div className="flex items-center gap-3 mb-6">
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder={user.username} maxLength={32}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
          {displayName && (
            <button onClick={() => setDisplayName('')}
              className="text-sm px-3 py-2.5 rounded-xl"
              style={{ background: 'var(--muted-bg)', color: 'var(--muted)', border: '1px solid var(--card-border)' }}>
              Entfernen
            </button>
          )}
        </div>

        {/* Bilder */}
        <div className="card rounded-2xl p-6 mb-6">
          <SectionTitle>Bilder</SectionTitle>
          <Hint>PNG, JPG, WEBP oder GIF — max. 8 MB.</Hint>
          <UploadRow label="Profilbild" kind="avatar" hint="Ersetzt den Minecraft-Kopf."
            value={profilePic} onClear={() => setProfilePic(null)} inputRef={picInput}
            preview={<img src={avatarSrc} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />} />
          <UploadRow label="Banner" kind="banner" hint="Breites Bild oben am Profil."
            value={banner} onClear={() => setBanner(null)} inputRef={bannerInput}
            preview={<div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ background: banner ? `url(${banner}) center/cover` : 'var(--muted-bg)', border: '1px solid var(--card-border)' }} />} />
          <UploadRow label="Hintergrundbild" kind="background" hint="Hinter dem gesamten Profil."
            value={background} onClear={() => setBackground(null)} inputRef={bgInput}
            preview={<div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ background: background ? `url(${background}) center/cover` : 'var(--muted-bg)', border: '1px solid var(--card-border)' }} />} />
          {background && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Hintergrund-Unschärfe</label>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{bgBlur}px</span>
              </div>
              <input type="range" min={0} max={40} value={bgBlur} onChange={e => setBgBlur(Number(e.target.value))}
                className="w-full" style={{ accentColor: accent }} />
            </div>
          )}
        </div>

        {/* Farbthema */}
        <div className="card rounded-2xl p-6 mb-6">
          <SectionTitle>Farbthema</SectionTitle>
          <Hint>Wähle ein Preset oder eine eigene Akzentfarbe.</Hint>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => pickPreset(p)} className="rounded-xl p-1 transition-all"
                style={{ border: theme === p.id ? `2px solid ${accent}` : '2px solid transparent' }}>
                <div className="h-10 rounded-lg mb-1" style={{ background: p.swatch }} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{p.label}</span>
              </button>
            ))}
            <button onClick={() => setTheme('custom')} className="rounded-xl p-1 transition-all"
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

        {/* Transparenz */}
        <div className="card rounded-2xl p-6 mb-6">
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

        {/* Steam */}
        <div className="card rounded-2xl p-6 mb-6">
          <SectionTitle>Steam</SectionTitle>
          <Hint>Verknüpfe deinen Steam-Account und wähle bis zu 5 Lieblingsspiele für dein Profil.</Hint>

          {steamId ? (
            <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              {steamAvatar && <img src={steamAvatar} alt="" className="w-10 h-10 rounded-xl" />}
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{steamUsername || 'Steam verknüpft'}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Steam ID: {steamId}</p>
              </div>
              <a href="/api/auth/steam" className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>
                Neu verknüpfen
              </a>
            </div>
          ) : (
            <a href="/api/auth/steam"
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium text-white mb-5 transition-all hover:opacity-90"
              style={{ background: '#1b2838' }}>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white">
                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.503 1.009 2.459-.397.957-1.497 1.41-2.455 1.008zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
              </svg>
              Mit Steam verknüpfen
            </a>
          )}

          {/* Lieblingsspiele */}
          <p className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
            Lieblingsspiele ({favoriteGames.length}/5)
          </p>

          {favoriteGames.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {favoriteGames.map(game => (
                <div key={game.appid} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                  <img src={game.icon} alt={game.name} className="w-8 h-6 rounded object-cover" />
                  <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{game.name}</span>
                  <button onClick={() => removeGame(game.appid)} className="text-xs hover:opacity-70 ml-1" style={{ color: 'var(--muted)' }}>✕</button>
                </div>
              ))}
            </div>
          )}

          {favoriteGames.length < 5 && (
            <div className="relative">
              <input type="text" value={gameSearch} onChange={e => setGameSearch(e.target.value)}
                placeholder="Spiel suchen..."
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
              {searching && (
                <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Suche...</p>
              )}
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 rounded-xl overflow-hidden shadow-lg"
                  style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                  {searchResults.map(game => (
                    <button key={game.appid} onClick={() => addGame(game)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 hover:opacity-80 transition-all text-left"
                      style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <img src={game.icon} alt={game.name} className="w-10 h-7 rounded object-cover flex-shrink-0" />
                      <span className="text-sm" style={{ color: 'var(--foreground)' }}>{game.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {favoriteGames.length > 0 && (
            <button onClick={saveGames} disabled={savingGames}
              className="mt-4 text-sm px-4 py-2 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: accent }}>
              {savingGames ? 'Speichern...' : 'Spiele speichern'}
            </button>
          )}
        </div>

        <button onClick={save} disabled={saving}
          className="btn-gradient text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50 w-full">
          {saving ? 'Speichern...' : 'Profil speichern'}
        </button>
      </div>
    </div>
  )
}