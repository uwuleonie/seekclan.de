'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'
import Link from 'next/link'

type Tab = 'profil' | 'sicherheit' | 'verknuepfungen' | 'erscheinung' | 'privatsphaere' | 'erweitert'

const PRIVACY_OPTIONS = [
  { value: 'alle', label: 'Alle' },
  { value: 'freund', label: 'Freunde' },
  { value: 'clan', label: 'Clan' },
  { value: 'niemand', label: 'Niemand' },
]

export default function EinstellungenPage() {
  const { user, loading, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('profil')
  const [userData, setUserData] = useState<any>(null)

  // Profil
  const [biography, setBiography] = useState('')

  // Sicherheit
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')

  // Verknüpfungen
  const [linkCode, setLinkCode] = useState('')

  // Erscheinung
  const [darkmode, setDarkmode] = useState(false)
  const [language, setLanguage] = useState('de')

  // Privatsphäre
  const [privacyFriendRequests, setPrivacyFriendRequests] = useState('alle')
  const [privacyProfile, setPrivacyProfile] = useState('alle')
  const [privacyLastActive, setPrivacyLastActive] = useState('alle')
  const [privacyStats, setPrivacyStats] = useState('alle')
  const [privacyLeaderboard, setPrivacyLeaderboard] = useState(true)

  // Delete
  const [deletePassword, setDeletePassword] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (user) {
      fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
          const u = d.user
          setUserData(u)
          setBiography(u?.biography || '')
          setDarkmode(u?.darkmode || false)
          setLanguage(u?.language || 'de')
          setPrivacyFriendRequests(u?.privacy_friend_requests || 'alle')
          setPrivacyProfile(u?.privacy_profile || 'alle')
          setPrivacyLastActive(u?.privacy_last_active || 'alle')
          setPrivacyStats(u?.privacy_stats || 'alle')
          setPrivacyLeaderboard(u?.privacy_leaderboard ?? true)
        })
    }
  }, [user])

  const update = async (type: string, data: object) => {
    setSaving(true)
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
    setSaving(false)
  }

  const handlePassword = async () => {
    if (newPassword !== newPassword2) { setError('Passwörter stimmen nicht überein'); return }
    await update('password', { current_password: currentPassword, new_password: newPassword })
    setCurrentPassword(''); setNewPassword(''); setNewPassword2('')
  }

  const handleLink = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
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

  const PrivacySelector = ({ label, field, value, onChange }: { label: string, field: string, value: string, onChange: (v: string) => void }) => (
    <div className="mb-6">
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex gap-2">
        {PRIVACY_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => { onChange(opt.value); update('privacy', { field, value: opt.value }) }}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${value === opt.value ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-900">Laden...</div>

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">Du musst eingeloggt sein.</p>
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
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <Link href="/" className="text-gray-500 text-sm flex items-center gap-1 mb-8 hover:text-gray-700">← Zurück</Link>
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Einstellungen</h1>

        {/* Tabs */}
        <div className="flex gap-1 flex-wrap mb-6 bg-white rounded-2xl p-1.5 shadow-sm">
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(''); setSuccess('') }}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap
                ${tab === t.id ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
        {success && <p className="text-green-600 text-sm mb-4 bg-green-50 px-4 py-2 rounded-xl">{success}</p>}

        <div className="bg-white rounded-2xl p-6 shadow-sm">

          {/* Profil */}
          {tab === 'profil' && (
            <div>
              <div className="flex items-center gap-4 mb-6">
                <img src={`https://mc-heads.net/avatar/${user.username}/64`} alt={user.username} className="w-16 h-16 rounded-xl" />
                <div>
                  <p className="font-bold text-xl text-gray-900">{user.username}</p>
                  <p className="text-gray-500 text-sm">Seek Clan Account</p>
                </div>
              </div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Biografie</label>
              <textarea value={biography} onChange={e => setBiography(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400 resize-none mb-3"
                rows={4} placeholder="Schreibe etwas über dich..." maxLength={300} />
              <p className="text-gray-400 text-xs mb-3">{biography.length}/300</p>
              <button onClick={() => update('biography', { biography })} disabled={saving}
                className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          )}

          {/* Sicherheit */}
          {tab === 'sicherheit' && (
            <div>
              <h2 className="font-bold text-lg mb-4 text-gray-900">Passwort ändern</h2>
              <label className="text-sm font-medium text-gray-700 block mb-1">Aktuelles Passwort</label>
              <input value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} type="password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-gray-900 outline-none focus:border-purple-400" />
              <label className="text-sm font-medium text-gray-700 block mb-1">Neues Passwort</label>
              <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-gray-900 outline-none focus:border-purple-400" />
              <label className="text-sm font-medium text-gray-700 block mb-1">Neues Passwort wiederholen</label>
              <input value={newPassword2} onChange={e => setNewPassword2(e.target.value)} type="password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-6 text-sm text-gray-900 outline-none focus:border-purple-400" />
              <button onClick={handlePassword} disabled={saving}
                className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 mb-8">
                {saving ? 'Speichern...' : 'Passwort ändern'}
              </button>

              <hr className="mb-6" />

              <h2 className="font-bold text-lg mb-2 text-gray-900">Security Codes</h2>
              <p className="text-gray-500 text-sm mb-4">Nutze diese Codes um dein Passwort zurückzusetzen.</p>
              <Link href="/einstellungen/security-codes"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium inline-block">
                Security Codes verwalten →
              </Link>
            </div>
          )}

          {/* Verknüpfungen */}
          {tab === 'verknuepfungen' && (
            <div>
              <h2 className="font-bold text-lg mb-4 text-gray-900">Minecraft</h2>
              {userData?.minecraft_username ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
                  <img src={`https://mc-heads.net/avatar/${userData.minecraft_username}/32`} alt={userData.minecraft_username} className="w-8 h-8 rounded" />
                  <div>
                    <p className="font-medium text-green-800">{userData.minecraft_username}</p>
                    <p className="text-green-600 text-sm">Verknüpft ✅</p>
                  </div>
                </div>
              ) : (
                <div className="mb-6">
                  <p className="text-gray-600 text-sm mb-3">Tippe <code className="bg-gray-100 px-2 py-1 rounded text-gray-900">/link</code> auf dem Server.</p>
                  <div className="flex gap-2">
                    <input value={linkCode} onChange={e => setLinkCode(e.target.value.toUpperCase())}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400 font-mono"
                      placeholder="XXXXXXXX" maxLength={8} />
                    <button onClick={handleLink} disabled={saving || linkCode.length < 6}
                      className="btn-gradient text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                      Verknüpfen
                    </button>
                  </div>
                </div>
              )}

              <hr className="mb-6" />

              <h2 className="font-bold text-lg mb-4 text-gray-900">Discord</h2>
              {userData?.discord_username ? (
                <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                  <span className="text-2xl">🎮</span>
                  <div>
                    <p className="font-medium text-indigo-800">{userData.discord_username}</p>
                    <p className="text-indigo-600 text-sm">Verknüpft ✅</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 text-sm mb-3">Verknüpfe deinen Discord Account.</p>
                  <button onClick={() => window.location.href = '/api/discord/login'}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium">
                    🎮 Mit Discord verbinden
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Erscheinung */}
          {tab === 'erscheinung' && (
            <div>
              <h2 className="font-bold text-lg mb-6 text-gray-900">Darkmode</h2>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="font-medium text-gray-900">Dunkles Design</p>
                  <p className="text-gray-500 text-sm">Aktiviere den Darkmode</p>
                </div>
                <button onClick={() => { setDarkmode(!darkmode); update('darkmode', { darkmode: !darkmode }) }}
                  className={`w-12 h-6 rounded-full transition-all relative ${darkmode ? 'bg-purple-600' : 'bg-gray-200'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${darkmode ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>

              <hr className="mb-6" />

              <h2 className="font-bold text-lg mb-4 text-gray-900">Sprache</h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { code: 'de', label: '🇩🇪 Deutsch' },
                  { code: 'en', label: '🇬🇧 Englisch' },
                  { code: 'es', label: '🇪🇸 Spanisch' },
                  { code: 'fr', label: '🇫🇷 Französisch' },
                ].map(lang => (
                  <button key={lang.code} onClick={() => { setLanguage(lang.code); update('language', { language: lang.code }) }}
                    className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${language === lang.code ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Privatsphäre */}
          {tab === 'privatsphaere' && (
            <div>
              <h2 className="font-bold text-lg mb-6 text-gray-900">Privatsphäre</h2>
              <PrivacySelector label="Wer kann dir eine Freundschaftsanfrage senden?" field="privacy_friend_requests" value={privacyFriendRequests} onChange={setPrivacyFriendRequests} />
              <PrivacySelector label="Wer kann dein Profil sehen?" field="privacy_profile" value={privacyProfile} onChange={setPrivacyProfile} />
              <PrivacySelector label="Wer kann deine letzte Aktivität sehen?" field="privacy_last_active" value={privacyLastActive} onChange={setPrivacyLastActive} />
              <PrivacySelector label="Wer kann deine Statistiken sehen?" field="privacy_stats" value={privacyStats} onChange={setPrivacyStats} />

              <div className="flex items-center justify-between mt-2">
                <div>
                  <p className="font-medium text-gray-900">Im Leaderboard sichtbar</p>
                  <p className="text-gray-500 text-sm">Zeige dich im WM-Tippspiel Leaderboard</p>
                </div>
                <button onClick={() => { setPrivacyLeaderboard(!privacyLeaderboard); update('privacy', { field: 'privacy_leaderboard', value: !privacyLeaderboard }) }}
                  className={`w-12 h-6 rounded-full transition-all relative ${privacyLeaderboard ? 'bg-purple-600' : 'bg-gray-200'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${privacyLeaderboard ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          )}

          {/* Erweitert */}
          {tab === 'erweitert' && (
            <div>
              <h2 className="font-bold text-lg mb-4 text-gray-900">Account verwalten</h2>
              <p className="text-gray-500 text-sm mb-6">Diese Aktionen können nicht rückgängig gemacht werden.</p>

              <div className="flex gap-3 mb-6">
                <button onClick={() => update('deactivate', {})} disabled={saving}
                  className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">
                  Account deaktivieren
                </button>
                <button onClick={() => setShowDelete(!showDelete)}
                  className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-medium">
                  Account löschen
                </button>
              </div>

              {showDelete && (
                <div className="border border-red-200 rounded-xl p-4 bg-red-50">
                  <p className="text-red-700 text-sm mb-3 font-medium">⚠️ Diese Aktion kann nicht rückgängig gemacht werden!</p>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Passwort zur Bestätigung</label>
                  <input value={deletePassword} onChange={e => setDeletePassword(e.target.value)} type="password"
                    className="w-full border border-red-200 rounded-xl px-4 py-2.5 mb-3 text-sm text-gray-900 outline-none" />
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
}