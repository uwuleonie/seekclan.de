'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

type Tab = 'login' | 'register' | 'recovery'

export default function LoginPage() {
  const { refresh } = useAuth()
  const [tab, setTab] = useState<Tab>('login')

  // Login
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Register
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPassword2, setRegPassword2] = useState('')
  const [securityCodes, setSecurityCodes] = useState<string[]>([])

  // Recovery
  const [recUsername, setRecUsername] = useState('')
  const [recCode, setRecCode] = useState('')
  const [recPassword, setRecPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login fehlgeschlagen')
      } else {
        await refresh()
        window.location.href = '/'
      }
    } catch {
      setError('Ein Fehler ist aufgetreten')
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    setLoading(true)
    setError('')
    if (regPassword !== regPassword2) {
      setError('Passwörter stimmen nicht überein')
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: regUsername, password: regPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registrierung fehlgeschlagen')
      } else {
        setSecurityCodes(data.security_codes)
        await refresh()
      }
    } catch {
      setError('Ein Fehler ist aufgetreten')
    }
    setLoading(false)
  }

  const handleRecovery = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: recUsername, security_code: recCode, new_password: recPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Recovery fehlgeschlagen')
      } else {
        setSuccess('Passwort erfolgreich zurückgesetzt!')
        await refresh()
        setTimeout(() => window.location.href = '/', 2000)
      }
    } catch {
      setError('Ein Fehler ist aufgetreten')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen relative flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 via-pink-50 to-white -z-10" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-30 -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-200 rounded-full blur-3xl opacity-20 -z-10" />

      <div className="flex-1 flex flex-col px-8 pt-6">
        <Link href="/" className="text-gray-500 text-sm flex items-center gap-1 mb-10 hover:text-gray-700">← Zurück</Link>

        <div className="max-w-md mx-auto w-full bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg shadow-purple-100 p-8 border border-purple-50">
          {/* Tabs */}
          <div className="flex gap-1 mb-8 bg-gray-100 rounded-2xl p-1">
            {(['login', 'register', 'recovery'] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                {t === 'login' ? '→ Login' : t === 'register' ? '👤 Registrieren' : '🔑 Recovery'}
              </button>
            ))}
          </div>

          {error && <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}
          {success && <p className="text-green-600 text-sm mb-4 bg-green-50 px-4 py-2 rounded-xl">{success}</p>}

          {/* Login */}
          {tab === 'login' && (
            <div>
              <h2 className="text-2xl font-bold mb-1">Einloggen</h2>
              <p className="text-gray-400 text-sm mb-6">Mit deinem Clan-Username einloggen.</p>
              <label className="text-sm font-medium text-gray-700 block mb-1">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all text-gray-900"
                placeholder="uwuleonie" />
              <label className="text-sm font-medium text-gray-700 block mb-1">Passwort</label>
              <input value={password} onChange={e => setPassword(e.target.value)}
                type="password" onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-6 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all text-gray-900" />
              <button onClick={handleLogin} disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-2xl font-medium disabled:opacity-50 transition-all shadow-md shadow-purple-200">
                {loading ? 'Laden...' : 'Login'}
              </button>
            </div>
          )}

          {/* Registrieren */}
          {tab === 'register' && !securityCodes.length && (
            <div>
              <h2 className="text-2xl font-bold mb-1">Registrieren</h2>
              <p className="text-gray-400 text-sm mb-6">Erstelle deinen Clan-Account.</p>
              <label className="text-sm font-medium text-gray-700 block mb-1">Username</label>
              <input value={regUsername} onChange={e => setRegUsername(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                placeholder="dein_username" />
              <label className="text-sm font-medium text-gray-700 block mb-1">Passwort</label>
              <input value={regPassword} onChange={e => setRegPassword(e.target.value)}
                type="password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all" />
              <label className="text-sm font-medium text-gray-700 block mb-1">Passwort wiederholen</label>
              <input value={regPassword2} onChange={e => setRegPassword2(e.target.value)}
                type="password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-6 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all" />
              <button onClick={handleRegister} disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-2xl font-medium disabled:opacity-50 transition-all shadow-md shadow-purple-200">
                {loading ? 'Laden...' : 'Account erstellen'}
              </button>
            </div>
          )}

          {/* Security Codes nach Registrierung */}
          {tab === 'register' && securityCodes.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-1">🎉 Account erstellt!</h2>
              <p className="text-gray-400 text-sm mb-4">Speichere diese Security Codes sicher ab – du brauchst sie um dein Passwort zurückzusetzen!</p>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {securityCodes.map((code, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-mono text-center text-gray-900">
                    {code}
                  </div>
                ))}
              </div>
              <button onClick={() => window.location.href = '/'}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-2xl font-medium transition-all">
                Zur Startseite →
              </button>
            </div>
          )}

          {/* Recovery */}
          {tab === 'recovery' && (
            <div>
              <h2 className="text-2xl font-bold mb-1">Recovery</h2>
              <p className="text-gray-400 text-sm mb-6">Passwort mit Security Code zurücksetzen.</p>
              <label className="text-sm font-medium text-gray-700 block mb-1">Username</label>
              <input value={recUsername} onChange={e => setRecUsername(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                placeholder="dein_username" />
              <label className="text-sm font-medium text-gray-700 block mb-1">Security Code</label>
              <input value={recCode} onChange={e => setRecCode(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-4 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all font-mono"
                placeholder="XXXXXXXX" />
              <label className="text-sm font-medium text-gray-700 block mb-1">Neues Passwort</label>
              <input value={recPassword} onChange={e => setRecPassword(e.target.value)}
                type="password"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 mb-6 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all text-gray-900" />
              <button onClick={handleRecovery} disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-2xl font-medium disabled:opacity-50 transition-all shadow-md shadow-purple-200">
                {loading ? 'Laden...' : 'Passwort zurücksetzen'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-gray-400 text-sm mt-5">
          Beim WM-Tippspiel kannst du auch ohne Account als Gast mitmachen.
        </p>
      </div>
    </div>
  )
}