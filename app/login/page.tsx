'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'

type Tab = 'login' | 'register' | 'recovery'

function Input({ label, value, onChange, type = 'text', placeholder, onKeyDown }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; onKeyDown?: (e: React.KeyboardEvent) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(180,210,255,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        type={type} placeholder={placeholder} onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${focused ? 'rgba(201,168,76,0.45)' : 'rgba(255,255,255,0.09)'}`, borderRadius: 10, padding: '11px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
      />
    </div>
  )
}

export default function LoginPage() {
  const { refresh } = useAuth()
  const [tab, setTab] = useState<Tab>('login')
  const [username, setUsername]     = useState('')
  const [password, setPassword]     = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPassword2, setRegPassword2] = useState('')
  const [securityCodes, setSecurityCodes] = useState<string[]>([])
  const [recUsername, setRecUsername] = useState('')
  const [recCode, setRecCode]       = useState('')
  const [recPassword, setRecPassword] = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [success, setSuccess]       = useState('')

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
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
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: regUsername, password: regPassword }) })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Registrierung fehlgeschlagen')
      else { setSecurityCodes(data.security_codes); await refresh() }
    } catch { setError('Ein Fehler ist aufgetreten') }
    setLoading(false)
  }

  const handleRecovery = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: recUsername, security_code: recCode, new_password: recPassword }) })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Recovery fehlgeschlagen')
      else { setSuccess('Passwort zurückgesetzt!'); await refresh(); setTimeout(() => window.location.href = '/', 2000) }
    } catch { setError('Ein Fehler ist aufgetreten') }
    setLoading(false)
  }

  const btnStyle = (disabled: boolean) => ({
    width: '100%', marginTop: 8, padding: '12px', borderRadius: 12, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14,
    background: 'linear-gradient(135deg, #7c3aed, #3d5afe)', color: '#fff',
    opacity: disabled ? 0.6 : 1, boxShadow: '0 4px 20px rgba(61,90,254,0.25)',
    transition: 'opacity 0.2s',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#07090f', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Blobs */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-15%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(61,90,254,0.14) 0%, transparent 65%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 65%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/server-icon-hd.png" alt="seekclan" style={{ width: 56, height: 56, borderRadius: 12, display: 'block', margin: '0 auto 12px', boxShadow: '0 0 32px rgba(124,58,237,0.3)' }} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' }}>seekclan.de</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(180,210,255,0.45)' }}>Willkommen zurück</p>
          </div>

          {/* Card */}
          <div style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, marginBottom: 28, background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: 3 }}>
              {(['login','register','recovery'] as Tab[]).map(t => (
                <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent', color: tab === t ? '#fff' : 'rgba(180,210,255,0.45)', transition: 'all 0.15s' }}>
                  {{ login: 'Login', register: 'Registrieren', recovery: 'Recovery' }[t]}
                </button>
              ))}
            </div>

            {error && <div style={{ background: 'rgba(239,83,80,0.1)', border: '1px solid rgba(239,83,80,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ef5350', marginBottom: 20 }}>{error}</div>}
            {success && <div style={{ background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#4caf50', marginBottom: 20 }}>{success}</div>}

            {/* Login */}
            {tab === 'login' && (
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#fff' }}>Einloggen</h2>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(180,210,255,0.45)' }}>Mit deinem Account einloggen.</p>
                <Input label="Username" value={username} onChange={setUsername} placeholder="dein_username" />
                <Input label="Passwort" value={password} onChange={setPassword} type="password" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                <button onClick={handleLogin} disabled={loading} style={btnStyle(loading)}>{loading ? 'Laden…' : 'Einloggen →'}</button>
              </div>
            )}

            {/* Registrieren */}
            {tab === 'register' && !securityCodes.length && (
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#fff' }}>Account erstellen</h2>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(180,210,255,0.45)' }}>Erstelle deinen kostenlosen Account.</p>
                <Input label="Username" value={regUsername} onChange={setRegUsername} placeholder="dein_username" />
                <Input label="Passwort" value={regPassword} onChange={setRegPassword} type="password" />
                <Input label="Passwort wiederholen" value={regPassword2} onChange={setRegPassword2} type="password" onKeyDown={e => e.key === 'Enter' && handleRegister()} />
                <button onClick={handleRegister} disabled={loading} style={btnStyle(loading)}>{loading ? 'Laden…' : 'Account erstellen →'}</button>
              </div>
            )}

            {/* Security Codes */}
            {tab === 'register' && securityCodes.length > 0 && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#fff' }}>Account erstellt!</h2>
                  <p style={{ margin: 0, fontSize: 13, color: 'rgba(180,210,255,0.45)' }}>Speichere diese Security Codes sicher ab.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                  {securityCodes.map((code, i) => (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', color: '#fff' }}>{code}</div>
                  ))}
                </div>
                <a href="/verify-account" style={{ display: 'block', padding: '11px', borderRadius: 12, background: 'linear-gradient(135deg, #7c3aed, #3d5afe)', color: '#fff', textAlign: 'center', fontWeight: 700, fontSize: 13, textDecoration: 'none', marginBottom: 10 }}>🔗 Minecraft-Account verbinden</a>
                <button onClick={() => window.location.href = '/'} style={{ width: '100%', padding: '11px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.09)', background: 'none', cursor: 'pointer', color: 'rgba(180,210,255,0.45)', fontSize: 13, fontWeight: 600 }}>Später, zur Startseite →</button>
              </div>
            )}

            {/* Recovery */}
            {tab === 'recovery' && (
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: '#fff' }}>Passwort zurücksetzen</h2>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(180,210,255,0.45)' }}>Mit Security Code zurücksetzen.</p>
                <Input label="Username" value={recUsername} onChange={setRecUsername} placeholder="dein_username" />
                <Input label="Security Code" value={recCode} onChange={setRecCode} placeholder="XXXXXXXX" />
                <Input label="Neues Passwort" value={recPassword} onChange={setRecPassword} type="password" onKeyDown={e => e.key === 'Enter' && handleRecovery()} />
                <button onClick={handleRecovery} disabled={loading} style={btnStyle(loading)}>{loading ? 'Laden…' : 'Zurücksetzen →'}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}