'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth-context'
import { compressImageFile } from '../lib/image-compress'

type RoleMember = { user_id: string, username: string }
type Role = {
  id: string
  name: string
  color: string | null
  permissions: Record<string, boolean>
  is_owner_role: boolean
  members: RoleMember[]
}

type Friend = { id: string, username: string }

type Props = {
  conversationId: string
  groupName: string
  avatarUrl: string | null
  onClose: () => void
  onUpdated: () => void
}

const PERMISSION_LABELS: Record<string, string> = {
  invite_members: 'Mitglieder einladen',
  manage_roles: 'Rollen verwalten',
  pin_messages: 'Nachrichten anpinnen',
  request_delete: 'Löschanträge stellen',
  edit_group_info: 'Name/Bild ändern',
  kick_members: 'Mitglieder entfernen',
}

const ROLE_COLORS = ['#7C3AED', '#C026D3', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#94A3B8']

// Verwaltungs-Panel für eine freie Gruppe: Mitglieder hinzufügen/entfernen,
// Rollen erstellen und zuweisen, Gruppenname/-bild ändern. Alle Aktionen
// werden serverseitig per Rechte-Check abgesichert (siehe
// app/lib/group-permissions.ts) - das UI blendet Aktionen, die der Nutzer
// laut seiner Rolle nicht darf, nur aus Komfortgründen aus, verlässt sich
// aber NICHT darauf als einzige Absicherung.
export default function GroupManagementPanel({ conversationId, groupName, avatarUrl, onClose, onUpdated }: Props) {
  const { user } = useAuth()
  const [tab, setTab] = useState<'members' | 'roles' | 'settings'>('members')

  const [roles, setRoles] = useState<Role[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [members, setMembers] = useState<RoleMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleColor, setNewRoleColor] = useState(ROLE_COLORS[0])
  const [newRolePermissions, setNewRolePermissions] = useState<Record<string, boolean>>({})
  const [creatingRole, setCreatingRole] = useState(false)

  const [nameInput, setNameInput] = useState(groupName)
  const [avatarInput, setAvatarInput] = useState(avatarUrl || '')
  const [savingSettings, setSavingSettings] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false)

  const [friendSearch, setFriendSearch] = useState('')

  const myRole = roles.find(r => r.members.some(m => m.user_id === user?.id))
  const myPermissions = myRole?.is_owner_role
    ? Object.keys(PERMISSION_LABELS).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<string, boolean>)
    : myRole?.permissions || {}

  const loadAll = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/conversations/${conversationId}/roles`).then(r => r.json()),
      fetch('/api/friends').then(r => r.json()),
      fetch('/api/conversations').then(r => r.json()),
    ]).then(([rolesData, friendsData, conversationsData]) => {
      const loadedRoles: Role[] = rolesData.roles || []
      setRoles(loadedRoles)

      // WICHTIG: members muss aus den ECHTEN Konversationsmitgliedern kommen
      // (conversation_members), nicht nur aus den Mitgliedern, die bereits
      // einer Rolle zugeordnet sind - sonst verschwinden Mitglieder ohne
      // Rolle komplett aus der UI und können nie eine Rolle zugewiesen
      // bekommen (genau dieser Bug trat auf, als ein drittes Mitglied ohne
      // Rolle unsichtbar blieb).
      const thisConversation = (conversationsData.conversations || []).find((c: any) => c.id === conversationId)
      const realMembers: RoleMember[] = (thisConversation?.members || []).map((m: any) => ({
        user_id: m.id,
        username: m.username,
      }))
      setMembers(realMembers)

      const acceptedFriends = (friendsData.friends || [])
        .filter((f: any) => f.status === 'accepted')
        .map((f: any) => (f.sender.id === user?.id ? f.receiver : f.sender))
      setFriends(acceptedFriends)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  const addMember = async (friendId: string) => {
    setError('')
    const res = await fetch(`/api/conversations/${conversationId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: friendId }),
    })
    const data = await res.json()
    if (res.ok) {
      loadAll()
    } else {
      setError(data.error || 'Fehler beim Hinzufügen')
    }
  }

  const removeMember = async (memberId: string) => {
    setError('')
    const res = await fetch(`/api/conversations/${conversationId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: memberId }),
    })
    const data = await res.json()
    if (res.ok) {
      loadAll()
    } else {
      setError(data.error || 'Fehler beim Entfernen')
    }
  }

  const createRole = async () => {
    if (!newRoleName.trim()) {
      setError('Gib der Rolle einen Namen.')
      return
    }
    setCreatingRole(true)
    setError('')
    const res = await fetch(`/api/conversations/${conversationId}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName.trim(), color: newRoleColor, permissions: newRolePermissions }),
    })
    const data = await res.json()
    if (res.ok) {
      setNewRoleName('')
      setNewRolePermissions({})
      loadAll()
    } else {
      setError(data.error || 'Fehler beim Erstellen der Rolle')
    }
    setCreatingRole(false)
  }

  const assignRole = async (memberId: string, roleId: string) => {
    setError('')
    const res = await fetch(`/api/conversations/${conversationId}/roles`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: memberId, role_id: roleId }),
    })
    const data = await res.json()
    if (res.ok) {
      loadAll()
    } else {
      setError(data.error || 'Fehler beim Zuweisen')
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    setError('')
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput, avatar_url: avatarInput || null }),
    })
    const data = await res.json()
    if (res.ok) {
      onUpdated()
    } else {
      setError(data.error || 'Fehler beim Speichern')
    }
    setSavingSettings(false)
  }

  const uploadAvatar = async (file: File) => {
    setError('')
    setUploadingAvatar(true)
    try {
      const compressed = await compressImageFile(file)
      const formData = new FormData()
      formData.append('file', compressed)
      formData.append('conversation_id', conversationId)
      const res = await fetch('/api/messages/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setAvatarInput(data.url)
      } else {
        setError(data.error || 'Fehler beim Hochladen des Bildes')
      }
    } catch {
      setError('Fehler beim Hochladen des Bildes')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleAvatarDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDraggingAvatar(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadAvatar(file)
  }

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadAvatar(file)
  }

  const availableFriendsToAdd = friends
    .filter(f => !members.some(m => m.user_id === f.id))
    .filter(f => f.username.toLowerCase().includes(friendSearch.toLowerCase()))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="card rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <p className="font-bold" style={{ color: 'var(--foreground)' }}>{groupName} verwalten</p>
          <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>✕</button>
        </div>

        <div className="flex gap-1 px-5 pt-3">
          {(['members', 'roles', 'settings'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 mb-3 rounded-xl text-sm font-medium transition-all"
              style={tab === t
                ? { background: 'var(--muted-bg)', color: 'var(--foreground)' }
                : { color: 'var(--muted)' }}
            >
              {t === 'members' ? 'Mitglieder' : t === 'roles' ? 'Rollen' : 'Einstellungen'}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm px-5 pb-2">{error}</p>}

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>Laden...</p>
          ) : tab === 'members' ? (
            <div>
              <div className="space-y-2 mb-4">
                {members.map(m => {
                  const role = roles.find(r => r.members.some(rm => rm.user_id === m.user_id))
                  const canKick = myPermissions.kick_members && !role?.is_owner_role
                  return (
                    <div key={m.user_id} className="flex items-center gap-3 py-2">
                      <img src={`https://api.creepernation.net/avatar/${m.username}/32`} alt=""
                        className="w-8 h-8 rounded-xl flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{m.username}</p>
                        {role && (
                          <p className="text-xs" style={{ color: role.color || 'var(--muted)' }}>{role.name}</p>
                        )}
                      </div>
                      {canKick && (
                        <button onClick={() => removeMember(m.user_id)} className="text-xs hover:opacity-70" style={{ color: '#EF4444' }}>
                          Entfernen
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              {myPermissions.invite_members && friends.length > members.length && (
                <div>
                  <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>Freund hinzufügen</p>
                  <input
                    type="text"
                    value={friendSearch}
                    onChange={e => setFriendSearch(e.target.value)}
                    placeholder="Freund suchen..."
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-2"
                    style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  />
                  <div className="space-y-1">
                    {availableFriendsToAdd.length === 0 ? (
                      <p className="text-xs py-2" style={{ color: 'var(--muted)' }}>Kein Freund mit diesem Namen gefunden.</p>
                    ) : availableFriendsToAdd.map(f => (
                      <button key={f.id} onClick={() => addMember(f.id)}
                        className="w-full flex items-center gap-3 py-2 text-left hover:opacity-70 transition-all">
                        <img src={`https://api.creepernation.net/avatar/${f.username}/28`} alt=""
                          className="w-7 h-7 rounded-lg flex-shrink-0" />
                        <p className="text-sm flex-1" style={{ color: 'var(--foreground)' }}>{f.username}</p>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>+ Hinzufügen</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'roles' ? (
            <div>
              <div className="space-y-3 mb-5">
                {roles.map(role => (
                  <div key={role.id} className="rounded-xl p-3" style={{ background: 'var(--muted-bg)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: role.color || '#94A3B8' }} />
                      <p className="text-sm font-bold flex-1" style={{ color: 'var(--foreground)' }}>
                        {role.name}{role.is_owner_role && ' (Owner)'}
                      </p>
                    </div>
                    {!role.is_owner_role && (
                      <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                        {Object.entries(role.permissions).filter(([, v]) => v).map(([k]) => PERMISSION_LABELS[k]).join(', ') || 'Keine besonderen Rechte'}
                      </p>
                    )}
                    {myPermissions.manage_roles && !role.is_owner_role && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {members.filter(m => !role.members.some(rm => rm.user_id === m.user_id)).map(m => (
                          <button key={m.user_id} onClick={() => assignRole(m.user_id, role.id)}
                            className="text-xs px-2 py-1 rounded-lg hover:opacity-70 transition-all"
                            style={{ background: 'var(--card)', color: 'var(--foreground)' }}>
                            + {m.username}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {myPermissions.manage_roles && (
                <div className="rounded-xl p-3" style={{ border: '1px dashed var(--card-border)' }}>
                  <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>Neue Rolle erstellen</p>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    placeholder="Rollenname"
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-2"
                    style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  />
                  <div className="flex gap-1.5 mb-3">
                    {ROLE_COLORS.map(c => (
                      <button key={c} onClick={() => setNewRoleColor(c)}
                        className="w-6 h-6 rounded-full flex-shrink-0"
                        style={{ background: c, outline: newRoleColor === c ? '2px solid var(--foreground)' : 'none', outlineOffset: '2px' }} />
                    ))}
                  </div>
                  <div className="space-y-1 mb-3">
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-xs" style={{ color: 'var(--foreground)' }}>
                        <input
                          type="checkbox"
                          checked={newRolePermissions[key] === true}
                          onChange={e => setNewRolePermissions(prev => ({ ...prev, [key]: e.target.checked }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <button onClick={createRole} disabled={creatingRole}
                    className="w-full text-white py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #7C3AED, #C026D3)' }}>
                    {creatingRole ? 'Wird erstellt...' : 'Rolle erstellen'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {myPermissions.edit_group_info ? (
                <>
                  <p className="text-xs font-bold mb-1" style={{ color: 'var(--muted)' }}>Gruppenname</p>
                  <input
                    type="text"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none mb-3"
                    style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  />
                  <p className="text-xs font-bold mb-1" style={{ color: 'var(--muted)' }}>Gruppenbild</p>
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDraggingAvatar(true) }}
                    onDragLeave={() => setIsDraggingAvatar(false)}
                    onDrop={handleAvatarDrop}
                    className="rounded-xl mb-3 flex items-center gap-3 p-3 transition-all"
                    style={{
                      border: isDraggingAvatar ? '2px dashed #C026D3' : '1px dashed var(--card-border)',
                      background: isDraggingAvatar ? 'rgba(192,38,211,0.08)' : 'var(--muted-bg)',
                    }}
                  >
                    {avatarInput ? (
                      <img src={avatarInput} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl flex-shrink-0"
                        style={{ background: 'var(--card)' }}>
                        👥
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {uploadingAvatar ? 'Wird hochgeladen...' : 'Bild hierher ziehen oder auswählen'}
                      </p>
                      <label className="text-xs font-medium cursor-pointer hover:opacity-70 transition-all" style={{ color: '#C026D3' }}>
                        Datei auswählen
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleAvatarFileSelect} disabled={uploadingAvatar}
                          className="hidden" />
                      </label>
                    </div>
                    {avatarInput && (
                      <button onClick={() => setAvatarInput('')} className="text-xs flex-shrink-0 hover:opacity-70" style={{ color: '#EF4444' }}>
                        Entfernen
                      </button>
                    )}
                  </div>
                  <button onClick={saveSettings} disabled={savingSettings}
                    className="w-full text-white py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #7C3AED, #C026D3)' }}>
                    {savingSettings ? 'Wird gespeichert...' : 'Speichern'}
                  </button>
                </>
              ) : (
                <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
                  Du hast keine Berechtigung, diese Gruppe zu bearbeiten.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}