'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'
import { useTheme, THEMES } from '../lib/theme-context'
import Link from 'next/link'

type Tab = 'profil' | 'sicherheit' | 'verknuepfungen' | 'erscheinung' | 'privatsphaere' | 'erweitert' | 'accounts'

export default function EinstellungenPage() {
  const { user, loading, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('profil')
  const [userData, setUserData] = useState<any>(null)

  const [biography, setBiography] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [linkCode, setLinkCode] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (user) {
      fetch('/api/auth/me').then(r => r.json()).then(d => {
        const u = d.user
        setUserData(u)
        setBiography(u?.biography || '')
      })
    }
  }, [user])

  const update = async (type: string, data: object) => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...data }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Fehler')
      else setSuccess(json.message || 'Gespeichert!')
    } catch { setError('Ein Fehler ist aufgetreten') }
    setSaving(false)
  }

  const handlePassword = async () => {
    if (newPassword !== newPassword2) { setError('Passwörter stimmen nicht überein'); return }
    await update('password', { current_password: currentPassword, new_password: newPassword })
    setCurrentPassword(''); setNewPassword(''); setNewPassword2('')
  }

  const handleLink = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/minecraft/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: linkCode }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Fehler')
      else {
        setSuccess(`Erfolgreich mit ${json.minecraft_username} verknüpft! 🎉`)
        setUserData({ ...userData, minecraft_username: json.minecraft_username })
        setLinkCode('')
      }
    } catch { setError('Fehler') }
    setSaving(false)
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'delete', password: deletePassword }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Fehler')
      else { logout(); window.location.href = '/' }
    } catch { setError('Fehler') }
    setSaving(false)
  }

  const inputStyle = {
    background: 'var(--muted-bg)',
    border: '1px solid var(--card-border)',
    color: 'var(--foreground)',
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>Laden...</div>

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
      <div className="text-center">
        <p className="mb-4" style={{ color: 'var(--muted)' }}>Du musst eingeloggt sein.</p>
        <Link href="/login" className="bg-purple-600 text-white px-6 py-3 rounded-xl">Einloggen</Link>
      </div>
    </div>
  )

  const tabs: { id: Tab, label: string }[] = [
    { id: 'profil', label: '👤 Profil' },
    { id: 'sicherheit', label: '🔒 Sicherheit' },
    { id: 'verknuepfungen', label: '🔗 Verknüpfungen' },
    { id: 'erscheinung', label: '🎨 Erscheinung' },
    { id: 'privatsphaere', label: '🛡️ Privatsphäre' },
    { id: 'erweitert', label: '⚙️ Erweitert' },
    { id: 'accounts', label: '👤 Accounts' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-2xl mx-auto px-8 py-10">
        <Link href="/" className="text-sm flex items-center gap-1 mb-8 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück</Link>
        <h1 className="text-3xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>Einstellungen</h1>

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap mb-6 rounded-2xl p-1.5" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(''); setSuccess('') }}
              className="flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
              style={tab === t.id
                ? { background: '#7C3AED', color: 'white' }
                : { color: 'var(--muted)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
        {success && <p className="text-green-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>{success}</p>}

        <div className="card rounded-2xl p-6">

          {/* Profil */}
          {tab === 'profil' && (
            <div>
              <div className="flex items-center gap-4 mb-6">
                <img src={`/api/player-heads/${user.username}/64`} alt={user.username} className="w-16 h-16 rounded-xl" />
                <div>
                  <p className="font-bold text-xl" style={{ color: 'var(--foreground)' }}>{user.username}</p>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Seek Clan Account</p>
                </div>
              </div>
              <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Biografie</label>
              <textarea value={biography} onChange={e => setBiography(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none mb-3"
                style={inputStyle} rows={4} placeholder="Schreibe etwas über dich..." maxLength={300} />
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{biography.length}/300</p>
              <button onClick={() => update('biography', { biography })} disabled={saving}
                className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          )}

          {/* Sicherheit */}
          {tab === 'sicherheit' && (
            <div>
              <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Passwort ändern</h2>
              {['Aktuelles Passwort', 'Neues Passwort', 'Neues Passwort wiederholen'].map((label, i) => (
                <div key={i}>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
                  <input type="password"
                    value={[currentPassword, newPassword, newPassword2][i]}
                    onChange={e => [setCurrentPassword, setNewPassword, setNewPassword2][i](e.target.value)}
                    className="w-full rounded-xl px-4 py-2.5 mb-4 text-sm outline-none"
                    style={inputStyle} />
                </div>
              ))}
              <button onClick={handlePassword} disabled={saving}
                className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 mb-8">
                {saving ? 'Speichern...' : 'Passwort ändern'}
              </button>
              <hr style={{ borderColor: 'var(--card-border)' }} className="mb-6" />
              <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--foreground)' }}>Security Codes</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Nutze diese Codes um dein Passwort zurückzusetzen.</p>
              <Link href="/einstellungen/security-codes"
                className="text-sm font-medium px-4 py-2 rounded-xl inline-block"
                style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>
                Security Codes verwalten →
              </Link>
            </div>
          )}

          {/* Verknüpfungen */}
          {tab === 'verknuepfungen' && (
            <div>
              <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Minecraft</h2>
              {userData?.minecraft_username ? (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <img src={`/api/player-heads/${userData.minecraft_username}/32`} alt={userData.minecraft_username} className="w-8 h-8 rounded" />
                  <div>
                    <p className="font-medium text-green-600">{userData.minecraft_username}</p>
                    <p className="text-green-500 text-sm">Verknüpft ✅</p>
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>Tippe <code className="px-2 py-1 rounded" style={{ background: 'var(--muted-bg)', color: 'var(--foreground)' }}>/link</code> auf dem Server.</p>
                  <div className="flex gap-2">
                    <input value={linkCode} onChange={e => setLinkCode(e.target.value.toUpperCase())}
                      className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
                      style={inputStyle} placeholder="XXXXXXXX" maxLength={8} />
                    <button onClick={handleLink} disabled={saving || linkCode.length < 6}
                      className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                      Verknüpfen
                    </button>
                  </div>
                  <a href="/verify-account" className="text-xs mt-2 inline-block underline" style={{ color: 'var(--muted)' }}>
                    Ausführliche Schritt-für-Schritt-Anleitung ansehen →
                  </a>
                </div>
              )}
              <hr style={{ borderColor: 'var(--card-border)' }} className="mb-6" />
              <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Discord</h2>
              {userData?.discord_username ? (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <span className="text-2xl">🎮</span>
                  <div>
                    <p className="font-medium text-indigo-500">{userData.discord_username}</p>
                    <p className="text-indigo-400 text-sm">Verknüpft ✅</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>Verknüpfe deinen Discord Account.</p>
                  <button onClick={() => window.location.href = '/api/discord/login'}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium">
                    🎮 Mit Discord verbinden
                    <h2 className="font-bold text-lg mb-2 mt-6" style={{ color: 'var(--foreground)' }}>Discord-ID</h2>
              <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
                Deine numerische Discord-ID (17–19 Stellen) — damit wird dein Profilname verlinkt.{' '}
                <a href="https://support.discord.com/hc/de/articles/206346498" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:opacity-70">Wie finde ich meine ID?</a>
              </p>
              <input type="text" placeholder="z.B. 123456789012345678"
                value={userData?.discord_id || ''}
                onChange={e => setUserData({ ...userData, discord_id: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 mb-3 text-sm outline-none"
                style={inputStyle} maxLength={19} />
              <button onClick={() => update('discord_id', { discord_id: userData?.discord_id })} disabled={saving}
                className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Speichern...' : 'Discord-ID speichern'}
              </button>
                  </button>
                </div>
                
              )}
            </div>
          )}

          {/* Erscheinung */}
          {tab === 'erscheinung' && (
            <div>
              <h2 className="font-bold text-lg mb-6" style={{ color: 'var(--foreground)' }}>Theme</h2>
              <div className="grid grid-cols-2 gap-3 mb-8">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => setTheme(t.id)}
                    className="flex items-center gap-3 p-4 rounded-xl transition-all"
                    style={{
                      background: theme === t.id ? 'rgba(124,58,237,0.15)' : 'var(--muted-bg)',
                      border: theme === t.id ? '2px solid #7C3AED' : '2px solid transparent',
                      color: 'var(--foreground)',
                    }}>
                    <span className="text-2xl">{t.icon}</span>
                    <span className="font-medium">{t.label}</span>
                    {theme === t.id && <span className="ml-auto text-purple-500">✓</span>}
                  </button>
                ))}
              </div>
              <hr style={{ borderColor: 'var(--card-border)' }} className="mb-6" />
              <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Sprache</h2>
              <div className="text-center py-8">
                <p className="text-4xl mb-3">🌍</p>
                <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                  Weitere Sprachen befinden sich noch im Aufbau und sind bald verfügbar.
                </p>
                <span
                  className="inline-block text-xs font-medium px-3 py-1.5 rounded-full text-white"
                  style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}
                >
                  🚧 In Entwicklung
                </span>
              </div>
            </div>
          )}

          {/* Privatsphäre */}
          {tab === 'privatsphaere' && (
            <div className="text-center py-10">
              <p className="text-5xl mb-4">🛡️</p>
              <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--foreground)' }}>Privatsphäre-Einstellungen</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                Dieser Bereich befindet sich noch im Aufbau und ist bald verfügbar.
              </p>
              <span
                className="inline-block text-xs font-medium px-3 py-1.5 rounded-full text-white"
                style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED, #C026D3)' }}
              >
                🚧 In Entwicklung
              </span>
            </div>
          )}

          {/* Accounts */}
          {tab === 'accounts' && (
            <AccountsTab />
          )}
          {/* Erweitert */}
          {tab === 'erweitert' && (
            <div>
              <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--foreground)' }}>Account verwalten</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Diese Aktionen können nicht rückgängig gemacht werden.</p>
              <div className="flex gap-3 mb-6">
                <button onClick={() => update('deactivate', {})} disabled={saving}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                  style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
                  Account deaktivieren
                </button>
                <button onClick={() => setShowDelete(!showDelete)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                  Account löschen
                </button>
              </div>
              {showDelete && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <p className="text-red-500 text-sm mb-3 font-medium">⚠️ Diese Aktion kann nicht rückgängig gemacht werden!</p>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--muted)' }}>Passwort zur Bestätigung</label>
                  <input value={deletePassword} onChange={e => setDeletePassword(e.target.value)} type="password"
                    className="w-full rounded-xl px-4 py-2.5 mb-3 text-sm outline-none"
                    style={{ ...inputStyle, borderColor: 'rgba(239,68,68,0.3)' }} />
                  <button onClick={handleDelete} disabled={saving || !deletePassword}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                    Account endgültig löschen
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
  function AccountsTab() {
  const [accounts, setAccounts] = useState<{ id: string, users: { username: string } }[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchAccounts = async () => {
    const res = await fetch('/api/accounts')
    const data = await res.json()
    setAccounts(data.accounts || [])
  }

  useEffect(() => { fetchAccounts() }, [])

  const handleAdd = async () => {
    if (!username || !password) { setError('Username und Passwort erforderlich'); return }
    setSaving(true); setError(''); setSuccess('')
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (res.ok) {
  setSuccess(`${username} hinzugefügt!`)
  setUsername(''); setPassword('')
  fetchAccounts()
  window.dispatchEvent(new Event('accounts-updated'))
}
    else setError(data.error || 'Fehler')
    setSaving(false)
  }

  const handleRemove = async (id: string) => {
    await fetch('/api/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchAccounts()
  }

  const inputStyle = {
    background: 'var(--muted-bg)',
    border: '1px solid var(--card-border)',
    color: 'var(--foreground)',
  }

  return (
    <div>
      <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--foreground)' }}>Verknüpfte Accounts</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Füge bis zu 5 Accounts hinzu um schnell zwischen ihnen zu wechseln.</p>

      {error && <p className="text-red-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>{error}</p>}
      {success && <p className="text-green-500 text-sm mb-4 px-4 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.1)' }}>{success}</p>}

      {/* Bestehende Accounts */}
      {accounts.length > 0 && (
        <div className="mb-6 space-y-2">
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              <img src={`/api/player-heads/${acc.users.username}/32`} alt={acc.users.username} className="w-8 h-8 rounded-lg" />
              <span className="flex-1 font-medium text-sm" style={{ color: 'var(--foreground)' }}>{acc.users.username}</span>
              <button onClick={() => handleRemove(acc.id)}
                className="text-xs px-3 py-1.5 rounded-xl"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                Entfernen
              </button>
            </div>
          ))}
        </div>
      )}

      {accounts.length < 5 && (
        <div>
          <h3 className="font-medium text-sm mb-3" style={{ color: 'var(--foreground)' }}>Account hinzufügen</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm block mb-1" style={{ color: 'var(--muted)' }}>Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} placeholder="Minecraft Username" />
            </div>
            <div>
              <label className="text-sm block mb-1" style={{ color: 'var(--muted)' }}>Passwort</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={inputStyle} />
            </div>
            <button onClick={handleAdd} disabled={saving}
              className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
              {saving ? 'Hinzufügen...' : '+ Account hinzufügen'}
            </button>
          </div>
        </div>
      )}

      {accounts.length >= 5 && (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Maximum von 5 Accounts erreicht.</p>
      )}
    </div>
  )
}
}