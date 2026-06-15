'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

type Tab = 'login' | 'register' | 'recovery'

export default function LoginPage() {
  const { refresh } = useAuth()
  const [tab, setTab] = useState<Tab>('login')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPassword2, setRegPassword2] = useState('')
  const [securityCodes, setSecurityCodes] = useState<string[]>([])

  const [recUsername, setRecUsername] = useState('')
  const [recCode, setRecCode] = useState('')
  const [recPassword, setRecPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Login fehlgeschlagen')
      else { await refresh(); window.location.href = '/' }
    } catch { setError('Ein Fehler ist aufgetreten') }
    setLoading(false)
  }

  const handleRegister = async () => {
    setLoading(true); setError('')
    if (regPassword !== regPassword2) { setError('Passwörter stimmen nicht überein'); setLoading(false); return }
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: regUsername, password: regPassword }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Registrierung fehlgeschlagen')
      else { setSecurityCodes(data.security_codes); await refresh() }
    } catch { setError('Ein Fehler ist aufgetreten') }
    setLoading(false)
  }

  const handleRecovery = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: recUsername, security_code: recCode, new_password: recPassword }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Recovery fehlgeschlagen')
      else { setSuccess('Passwort erfolgreich zurückgesetzt!'); await refresh(); setTimeout(() => window.location.href = '/', 2000) }
    } catch { setError('Ein Fehler ist aufgetreten') }
    setLoading(false)
  }

  const inputStyle = {
    background: 'var(--muted-bg)',
    border: '1px solid var(--card-border)',
    color: 'var(--foreground)',
  }

  const labelStyle = { color: 'var(--muted)' }

  return (
    <div className="min-h-screen relative flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Hintergrund Blobs */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #7C3AED, transparent)' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-10"
          style={{ background: 'radial-gradient(circle, #C026D3, transparent)' }} />
      </div>

      <div className="flex-1 flex flex-col px-8 pt-6">
        <Link href="/" className="text-sm flex items-center gap-1 mb-10 hover:opacity-70" style={{ color: 'var(--muted)' }}>← Zurück</Link>

        <div className="max-w-md mx-auto w-full rounded-3xl shadow-lg p-8" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          {/* Tabs */}
          <div className="flex gap-1 mb-8 rounded-2xl p-1" style={{ background: 'var(--muted-bg)' }}>
            {(['login', 'register', 'recovery'] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={tab === t
                  ? { background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                  : { color: 'var(--muted)' }}>
                {t === 'login' ? '→ Login' : t === 'register' ? '👤 Registrieren' : '🔑 Recovery'}
              </button>
            ))}
          </div>

          {error && <p className="text-red-500 text-sm mb-4 bg-red-50 dark:bg-red-900/20 wine:bg-red-900/20 navy:bg-red-900/20 px-4 py-2 rounded-xl">{error}</p>}
          {success && <p className="text-green-600 text-sm mb-4 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-xl">{success}</p>}

          {/* Login */}
          {tab === 'login' && (
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Einloggen</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Mit deinem Clan-Username einloggen.</p>
              <label className="text-sm font-medium block mb-1" style={labelStyle}>Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 mb-4 text-sm outline-none transition-all"
                style={inputStyle} placeholder="Dein Minecraft Name" />
              <label className="text-sm font-medium block mb-1" style={labelStyle}>Passwort</label>
              <input value={password} onChange={e => setPassword(e.target.value)}
                type="password" onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full rounded-xl px-4 py-2.5 mb-6 text-sm outline-none transition-all"
                style={inputStyle} />
              <button onClick={handleLogin} disabled={loading}
                className="w-full btn-gradient text-white py-3 rounded-2xl font-medium disabled:opacity-50 transition-all">
                {loading ? 'Laden...' : 'Login'}
              </button>
            </div>
          )}

          {/* Registrieren */}
          {tab === 'register' && !securityCodes.length && (
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Registrieren</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Erstelle deinen Clan-Account.</p>
              <label className="text-sm font-medium block mb-1" style={labelStyle}>Username</label>
              <input value={regUsername} onChange={e => setRegUsername(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 mb-4 text-sm outline-none transition-all"
                style={inputStyle} placeholder="Dein Minecraft Name" />
              <label className="text-sm font-medium block mb-1" style={labelStyle}>Passwort</label>
              <input value={regPassword} onChange={e => setRegPassword(e.target.value)}
                type="password"
                className="w-full rounded-xl px-4 py-2.5 mb-4 text-sm outline-none transition-all"
                style={inputStyle} />
              <label className="text-sm font-medium block mb-1" style={labelStyle}>Passwort wiederholen</label>
              <input value={regPassword2} onChange={e => setRegPassword2(e.target.value)}
                type="password"
                className="w-full rounded-xl px-4 py-2.5 mb-6 text-sm outline-none transition-all"
                style={inputStyle} />
              <button onClick={handleRegister} disabled={loading}
                className="w-full btn-gradient text-white py-3 rounded-2xl font-medium disabled:opacity-50 transition-all">
                {loading ? 'Laden...' : 'Account erstellen'}
              </button>
            </div>
          )}

          {/* Security Codes */}
          {tab === 'register' && securityCodes.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>🎉 Account erstellt!</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Speichere diese Security Codes sicher ab!</p>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {securityCodes.map((code, i) => (
                  <div key={i} className="rounded-xl px-4 py-2 text-sm font-mono text-center"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
                    {code}
                  </div>
                ))}
              </div>
              <button onClick={() => window.location.href = '/'}
                className="w-full btn-gradient text-white py-3 rounded-2xl font-medium transition-all">
                Zur Startseite →
              </button>
            </div>
          )}

          {/* Recovery */}
          {tab === 'recovery' && (
            <div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Recovery</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>Passwort mit Security Code zurücksetzen.</p>
              <label className="text-sm font-medium block mb-1" style={labelStyle}>Username</label>
              <input value={recUsername} onChange={e => setRecUsername(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 mb-4 text-sm outline-none transition-all"
                style={inputStyle} placeholder="dein_username" />
              <label className="text-sm font-medium block mb-1" style={labelStyle}>Security Code</label>
              <input value={recCode} onChange={e => setRecCode(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 mb-4 text-sm outline-none font-mono transition-all"
                style={inputStyle} placeholder="XXXXXXXX" />
              <label className="text-sm font-medium block mb-1" style={labelStyle}>Neues Passwort</label>
              <input value={recPassword} onChange={e => setRecPassword(e.target.value)}
                type="password"
                className="w-full rounded-xl px-4 py-2.5 mb-6 text-sm outline-none transition-all"
                style={inputStyle} />
              <button onClick={handleRecovery} disabled={loading}
                className="w-full btn-gradient text-white py-3 rounded-2xl font-medium disabled:opacity-50 transition-all">
                {loading ? 'Laden...' : 'Passwort zurücksetzen'}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--muted)' }}>
          Beim WM-Tippspiel kannst du auch ohne Account als Gast mitmachen.
        </p>
      </div>
    </div>
  )
}