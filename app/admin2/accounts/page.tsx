'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { hasWriteAccess } from '../layout'
import { usePathname } from 'next/navigation'

type Account = {
  id: string
  username: string
  display_name: string | null
  clan_role: string
  is_banned: boolean
  last_login_at: string | null
}

type AccountDetail = Account & {
  banned_reason: string | null
  is_deactivated: boolean
  created_at: string
  perm_updates_ideas: boolean
  perm_accounts: boolean
  perm_file_upload: boolean
  perm_chatlogs: boolean
}

type LoginEntry = { logged_in_at: string, ip_address: string | null }

const ROLE_STYLE: Record<string, { label: string, color: string }> = {
  gast: { label: 'Gast', color: '#6B7280' },
  clanmitglied: { label: 'Clanmitglied', color: '#6B7280' },
  clanmoderator: { label: 'Clanmoderator', color: '#22C55E' },
  teammitglied: { label: 'Teammitglied', color: '#3B82F6' },
  vip: { label: 'VIP', color: '#F59E0B' },
  administrator: { label: 'Administrator', color: '#3B82F6' },
  owner: { label: 'Leonie', color: '#A855F7' },
}
const ROLE_ORDER = ['gast', 'clanmitglied', 'clanmoderator', 'teammitglied', 'vip', 'administrator', 'owner'] as const
const TEAM_ROLES = ['teammitglied', 'administrator', 'owner']

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'gestern'
  if (days < 30) return `vor ${days} Tagen`
  return new Date(iso).toLocaleDateString('de-DE')
}

export default function SeekAccountsPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const canWrite = hasWriteAccess(user?.clan_role, pathname)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'alle' | 'team' | 'mitglieder' | 'gebannt'>('alle')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadAccounts = () => {
    setLoading(true)
    fetch('/api/admin2/accounts')
      .then(r => r.json())
      .then(data => setAccounts(data.accounts || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAccounts() }, [])

  const filtered = accounts.filter(a => {
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!a.username.toLowerCase().includes(q) && !(a.display_name || '').toLowerCase().includes(q)) return false
    }
    if (filter === 'team' && !TEAM_ROLES.includes(a.clan_role)) return false
    if (filter === 'mitglieder' && TEAM_ROLES.includes(a.clan_role)) return false
    if (filter === 'gebannt' && !a.is_banned) return false
    return true
  })

  const teamCount = accounts.filter(a => TEAM_ROLES.includes(a.clan_role)).length
  const bannedCount = accounts.filter(a => a.is_banned).length

  return (
    <div className="flex gap-6 max-w-7xl">
      <div className="flex-1 min-w-0">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Seek Accounts</h1>
        <p className="mb-1" style={{ color: 'var(--muted)' }}>Alle registrierten Accounts, Login-Historie, Bans & Rollen.</p>
        {!canWrite && (
          <p className="text-xs mb-5" style={{ color: '#EAB308' }}>🔒 Nur Lesezugriff — Änderungen sind für deine Rolle nicht möglich.</p>
        )}
        {canWrite && <div className="mb-6" />}

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Suchen: Name oder MC-Name ..."
            className="rounded-xl px-4 py-2.5 text-sm outline-none flex-1 min-w-[220px]"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          {(['alle', 'team', 'mitglieder', 'gebannt'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium capitalize transition-all"
              style={filter === f
                ? { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }
                : { color: 'var(--muted)' }}>
              {f === 'alle' ? 'Alle' : f === 'team' ? 'Team' : f === 'mitglieder' ? 'Mitglieder' : 'Gebannt'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>Laden...</p>
        ) : (
          <div className="card rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--card-border)' }}>
              <span>Account</span>
              <span>Rolle</span>
              <span>Letzter Login</span>
              <span>Status</span>
            </div>
            {filtered.map(a => {
              const role = ROLE_STYLE[a.clan_role] || ROLE_STYLE.clanmitglied
              return (
                <button key={a.id} onClick={() => setSelectedId(a.id)}
                  className="w-full grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-center text-left hover:opacity-90 transition-all"
                  style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={`/api/player-heads/${a.username}/36`} alt=""
                      className="w-9 h-9 rounded-xl flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate" style={{ color: 'var(--foreground)' }}>{a.display_name || a.username}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{a.username}</p>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full w-fit" style={{ background: `${role.color}22`, color: role.color }}>{role.label}</span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{timeAgo(a.last_login_at)}</span>
                  <span className="text-xs px-3 py-1 rounded-full w-fit" style={a.is_banned
                    ? { background: '#EF444422', color: '#EF4444' }
                    : { background: '#22C55E22', color: '#22C55E' }}>
                    {a.is_banned ? 'Gebannt' : 'Aktiv'}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>
          {accounts.length} Accounts · {teamCount} im Team · {bannedCount} gebannt · Klick auf einen Account öffnet Berechtigungen & Login-Historie.
        </p>
      </div>

      {selectedId && (
        <AccountDetailPanel accountId={selectedId} onClose={() => setSelectedId(null)} onChanged={loadAccounts} canWrite={canWrite} />
      )}
    </div>
  )
}

function AccountDetailPanel({ accountId, onClose, onChanged, canWrite }: { accountId: string, onClose: () => void, onChanged: () => void, canWrite: boolean }) {
  const [account, setAccount] = useState<AccountDetail | null>(null)
  const [logins, setLogins] = useState<LoginEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [banReason, setBanReason] = useState('')
  const [showBanForm, setShowBanForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`/api/admin2/accounts/${accountId}`)
      .then(r => r.json())
      .then(data => { setAccount(data.account || null); setLogins(data.logins || []) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [accountId])

  const changeRole = async (role: string) => {
    await fetch(`/api/admin2/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clan_role: role }),
    })
    load()
    onChanged()
  }

  const toggleBan = async () => {
    if (!account) return
    if (account.is_banned) {
      await fetch(`/api/admin2/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_banned: false }),
      })
      load()
      onChanged()
    } else {
      setShowBanForm(true)
    }
  }

  const confirmBan = async () => {
    await fetch(`/api/admin2/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_banned: true, banned_reason: banReason }),
    })
    setShowBanForm(false)
    setBanReason('')
    load()
    onChanged()
  }

  const toggleDeactivate = async () => {
    if (!account) return
    await fetch(`/api/admin2/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_deactivated: !account.is_deactivated }),
    })
    load()
    onChanged()
  }

  const deleteAccount = async () => {
    const res = await fetch(`/api/admin2/accounts/${accountId}`, { method: 'DELETE' })
    if (res.ok) {
      onClose()
      onChanged()
    }
  }

  const setPassword = async () => {
    if (newPassword.length < 8) {
      setPasswordError('Mindestens 8 Zeichen erforderlich.')
      return
    }
    const res = await fetch(`/api/admin2/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: newPassword }),
    })
    if (res.ok) {
      setShowPasswordForm(false)
      setNewPassword('')
      setPasswordError('')
    } else {
      const data = await res.json().catch(() => ({}))
      setPasswordError(data.error || 'Fehler beim Setzen des Passworts')
    }
  }

  if (loading || !account) {
    return (
      <div className="w-[380px] flex-shrink-0 card rounded-2xl p-5">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
      </div>
    )
  }

  const role = ROLE_STYLE[account.clan_role] || ROLE_STYLE.clanmitglied
  const isOwner = account.clan_role === 'owner'

  return (
    <div className="w-[380px] flex-shrink-0 card rounded-2xl p-5 h-fit sticky top-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <img src={`/api/player-heads/${account.username}/40`} alt=""
            className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div>
            <p className="font-bold" style={{ color: 'var(--foreground)' }}>{account.display_name || account.username}</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{account.username} · dabei seit {new Date(account.created_at).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-sm flex-shrink-0" style={{ color: 'var(--muted)' }}>✕</button>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Rolle</p>
      {isOwner || !canWrite ? (
        <div className="mb-1">
          <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: `${role.color}22`, color: role.color }}>{role.label}</span>
        </div>
      ) : (
        <select value={account.clan_role} onChange={e => changeRole(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-1"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
          {ROLE_ORDER.filter(r => r !== 'owner').map(r => (
            <option key={r} value={r}>{ROLE_STYLE[r].label}</option>
          ))}
        </select>
      )}
      <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
        {isOwner ? 'Dieser Account hat immer alle Berechtigungen und kann nicht gebannt werden.' : 'Ab Administrator sind alle Team-Berechtigungen automatisch aktiv.'}
      </p>

      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Berechtigungen</p>
      <div className="space-y-2 mb-5">
        {[
          { key: 'perm_updates_ideas', label: 'Updates, Ideen & Konzepte' },
          { key: 'perm_accounts', label: 'Accounts verwalten' },
          { key: 'perm_file_upload', label: 'Datei-Upload' },
          { key: 'perm_chatlogs', label: 'Chatlogs einsehen' },
        ].map(perm => (
          <div key={perm.key} className="flex items-center justify-between px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--muted-bg)' }}>
            <span style={{ color: 'var(--foreground)' }}>{perm.label}</span>
            <span className="w-2 h-2 rounded-full" style={{ background: (account as any)[perm.key] ? '#22C55E' : '#6B7280' }} />
          </div>
        ))}
      </div>

      {!isOwner && canWrite && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Status</p>
          {showBanForm ? (
            <div className="mb-3">
              <input value={banReason} onChange={e => setBanReason(e.target.value)}
                placeholder="Grund für die Sperre"
                className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-2"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
              <div className="flex gap-2">
                <button onClick={confirmBan} className="flex-1 py-2 rounded-xl text-xs font-medium" style={{ background: '#EF444422', color: '#EF4444' }}>Sperren</button>
                <button onClick={() => setShowBanForm(false)} className="px-4 py-2 rounded-xl text-xs" style={{ color: 'var(--muted)' }}>Abbrechen</button>
              </div>
            </div>
          ) : (
            <button onClick={toggleBan}
              className="w-full py-2.5 rounded-xl text-sm font-medium mb-3"
              style={account.is_banned ? { background: '#22C55E22', color: '#22C55E' } : { background: '#EF444422', color: '#EF4444' }}>
              {account.is_banned ? 'Entsperren' : 'Account sperren'}
            </button>
          )}

          <button onClick={toggleDeactivate}
            className="w-full py-2.5 rounded-xl text-sm font-medium mb-3"
            style={account.is_deactivated
              ? { background: '#22C55E22', color: '#22C55E' }
              : { background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
            {account.is_deactivated ? 'Reaktivieren' : 'Account deaktivieren'}
          </button>

          {showDeleteConfirm ? (
            <div className="mb-5 p-3 rounded-xl" style={{ background: '#EF444411', border: '1px solid #EF444455' }}>
              <p className="text-xs mb-3" style={{ color: 'var(--foreground)' }}>
                Diesen Account wirklich unwiderruflich löschen? Alle Daten gehen dabei verloren.
              </p>
              <div className="flex gap-2">
                <button onClick={deleteAccount} className="flex-1 py-2 rounded-xl text-xs font-medium" style={{ background: '#EF4444', color: 'white' }}>
                  Endgültig löschen
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 rounded-xl text-xs" style={{ color: 'var(--muted)' }}>
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 rounded-xl text-sm font-medium mb-5"
              style={{ color: '#EF4444' }}>
              Account löschen
            </button>
          )}
        </>
      )}

      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Letzte Logins</p>
      <div className="space-y-1.5 mb-5">
        {logins.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Noch keine Logins erfasst.</p>
        ) : logins.map((l, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span style={canWrite ? { color: 'var(--foreground)' } : { color: 'var(--muted)', filter: 'blur(3px)', userSelect: 'none' }}>
              {canWrite ? (l.ip_address || 'Unbekannte IP') : '•••.•••.•••.•••'}
            </span>
            <span style={{ color: 'var(--muted)' }}>{timeAgo(l.logged_in_at)}</span>
          </div>
        ))}
      </div>

      {canWrite && (
        showPasswordForm ? (
          <div>
            {passwordError && <p className="text-xs mb-2" style={{ color: '#EF4444' }}>{passwordError}</p>}
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="Neues Passwort (min. 8 Zeichen)"
              className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-2"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
            <div className="flex gap-2">
              <button onClick={setPassword} className="btn-gradient text-white flex-1 py-2 rounded-xl text-xs font-medium">Setzen</button>
              <button onClick={() => { setShowPasswordForm(false); setNewPassword(''); setPasswordError('') }} className="px-4 py-2 rounded-xl text-xs" style={{ color: 'var(--muted)' }}>Abbrechen</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowPasswordForm(true)}
            className="w-full py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--muted-bg)', color: 'var(--foreground)', border: '1px solid var(--card-border)' }}>
            Passwort setzen
          </button>
        )
      )}
    </div>
  )
}