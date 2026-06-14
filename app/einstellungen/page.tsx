'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'

export default function EinstellungenPage() {
  const { user, loading, logout } = useAuth()
  const [minecraftUsername, setMinecraftUsername] = useState<string | null>(null)
  const [discordUsername, setDiscordUsername] = useState<string | null>(null)
  const [language, setLanguage] = useState('de')
  const [darkmode, setDarkmode] = useState(false)
  const [biography, setBiography] = useState('')

  // Passwort
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')

  // Link Code
  const [linkCode, setLinkCode] = useState('')

  // Delete
  const [deletePassword, setDeletePassword] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  const [loading2, setLoading2] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (user) {
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
          setMinecraftUsername(d.user?.minecraft_username || null)
          setDiscordUsername(d.user?.discord_username || null)
          setLanguage(d.user?.language || 'de')
          setDarkmode(d.user?.darkmode || false)
          setBiography(d.user?.biography || '')
        })
    }
  }, [user])

  const update = async (type: string, data: object) => {
    setLoading2(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...data }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Fehler')
      else setSuccess(json.message || 'Gespeichert!')
    } catch {
      setError('Ein Fehler ist aufgetreten')
    }
    setLoading2(false)
  }

  const handleLink = async () => {
    await update('link', { code: linkCode })
    setLinkCode('')
  }

  const handlePassword = async () => {
    if (newPassword !== newPassword2) { setError('Passwörter stimmen nicht überein'); return }
    await update('password', { current_password: currentPassword, new_password: newPassword })
    setCurrentPassword(''); setNewPassword(''); setNewPassword2('')
  }

  const handleDelete = async () => {
    setLoading2(true)
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
    setLoading2(false)
  }

  const handleDeactivate = async () => {
    await update('deactivate', {})
    logout()
    window.location.href = '/'
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-900">Laden...</div>

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">Du musst eingeloggt sein.</p>
        <Link href="/login" className="bg-purple-600 text-white px-6 py-3 rounded-xl">Einloggen</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <Link href="/" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück</Link>
        <h1 className="text-3xl font-bold mb-8 text-gray-900">Einstellungen</h1>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 px-4 py-2 rounded-xl">{success}</p>}

        {/* Profil */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-lg mb-4 text-gray-900">Profil</h2>
          <div className="flex items-center gap-4 mb-4">
            <img src={`https://mc-heads.net/avatar/${user.username}/64`} alt={user.username} className="w-16 h-16 rounded-xl" />
            <div>
              <p className="font-bold text-xl text-gray-900">{user.username}</p>
              <p className="text-gray-500 text-sm">Seek Clan Account</p>
            </div>
          </div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Biografie</label>
          <textarea value={biography} onChange={e => setBiography(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400 resize-none"
            rows={3} placeholder="Schreibe etwas über dich..." maxLength={300} />
          <button onClick={() => update('biography', { biography })} disabled={loading2}
            className="mt-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
            Speichern
          </button>
        </div>

        {/* Minecraft */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-lg mb-2 text-gray-900">Minecraft Verknüpfung</h2>
          {minecraftUsername ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <img src={`https://mc-heads.net/avatar/${minecraftUsername}/32`} alt={minecraftUsername} className="w-8 h-8 rounded" />
              <div>
                <p className="font-medium text-green-800">{minecraftUsername}</p>
                <p className="text-green-600 text-sm">Verknüpft ✅</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 text-sm mb-4">Tippe <code className="bg-gray-100 px-2 py-1 rounded text-gray-900">/link</code> auf dem Server.</p>
              <div className="flex gap-2">
                <input value={linkCode} onChange={e => setLinkCode(e.target.value.toUpperCase())}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400 font-mono"
                  placeholder="XXXXXXXX" maxLength={8} />
                <button onClick={handleLink} disabled={loading2 || linkCode.length < 6}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                  Verknüpfen
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Discord */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-lg mb-2 text-gray-900">Discord Verknüpfung</h2>
          {discordUsername ? (
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
              <span className="text-2xl">🎮</span>
              <div>
                <p className="font-medium text-indigo-800">{discordUsername}</p>
                <p className="text-indigo-600 text-sm">Verknüpft ✅</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 text-sm mb-4">Verknüpfe deinen Discord Account.</p>
              <button onClick={() => window.location.href = '/api/discord/login'}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
                🎮 Mit Discord verbinden
              </button>
            </div>
          )}
        </div>

        {/* Passwort */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-lg mb-4 text-gray-900">Passwort ändern</h2>
          <label className="text-sm font-medium text-gray-700 block mb-1">Aktuelles Passwort</label>
          <input value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} type="password"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-gray-900 outline-none focus:border-purple-400" />
          <label className="text-sm font-medium text-gray-700 block mb-1">Neues Passwort</label>
          <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-gray-900 outline-none focus:border-purple-400" />
          <label className="text-sm font-medium text-gray-700 block mb-1">Neues Passwort wiederholen</label>
          <input value={newPassword2} onChange={e => setNewPassword2(e.target.value)} type="password"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-gray-900 outline-none focus:border-purple-400" />
          <button onClick={handlePassword} disabled={loading2}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
            Passwort ändern
          </button>
        </div>

        {/* Security Codes */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-lg mb-2 text-gray-900">Security Codes</h2>
          <p className="text-gray-600 text-sm mb-4">Nutze diese Codes um dein Passwort zurückzusetzen.</p>
          <Link href="/einstellungen/security-codes"
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium inline-block">
            Security Codes verwalten →
          </Link>
        </div>

        {/* Sprache */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <h2 className="font-bold text-lg mb-4 text-gray-900">Sprache</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { code: 'de', label: '🇩🇪 Deutsch' },
              { code: 'en', label: '🇬🇧 Englisch' },
              { code: 'es', label: '🇪🇸 Spanisch' },
              { code: 'fr', label: '🇫🇷 Französisch' },
            ].map(lang => (
              <button key={lang.code} onClick={() => { setLanguage(lang.code); update('language', { language: lang.code }); localStorage.setItem('language', lang.code) }}
                className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${language === lang.code ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Darkmode */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg text-gray-900">Darkmode</h2>
              <p className="text-gray-500 text-sm">Dunkles Design aktivieren</p>
            </div>
            <button onClick={() => { setDarkmode(!darkmode); update('darkmode', { darkmode: !darkmode }) }}
              className={`w-12 h-6 rounded-full transition-all ${darkmode ? 'bg-purple-600' : 'bg-gray-200'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-all mx-0.5 ${darkmode ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-red-100">
          <h2 className="font-bold text-lg mb-4 text-red-600">Gefahrenzone</h2>
          <div className="flex gap-3">
            <button onClick={handleDeactivate} disabled={loading2}
              className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
              Account deaktivieren
            </button>
            <button onClick={() => setShowDelete(!showDelete)}
              className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-xl text-sm font-medium">
              Account löschen
            </button>
          </div>

          {showDelete && (
            <div className="mt-4 border border-red-200 rounded-xl p-4 bg-red-50">
              <p className="text-red-700 text-sm mb-3 font-medium">⚠️ Diese Aktion kann nicht rückgängig gemacht werden!</p>
              <label className="text-sm font-medium text-gray-700 block mb-1">Passwort zur Bestätigung</label>
              <input value={deletePassword} onChange={e => setDeletePassword(e.target.value)} type="password"
                className="w-full border border-red-200 rounded-xl px-4 py-2.5 mb-3 text-sm text-gray-900 outline-none" />
              <button onClick={handleDelete} disabled={loading2 || !deletePassword}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                Account endgültig löschen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}