'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Rang } from './rechte-def'

// Angemeldete Person. Rechte prüfen mit darf(user, 'recht') aus app/lib/rechte-def.ts – nie über den Rang-Namen.
type User = {
  id: string
  username: string
  /** Anzeigename: Spitzname (nach der Minecraft-Verknüpfung gesetzt) > Minecraft-Name > Username */
  name: string
  minecraft_uuid?: string | null
  minecraft_username?: string | null
  display_name?: string | null
  rang: Rang
  rechte: string[]
} | null

type AuthContextType = {
  user: User
  loading: boolean
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user || null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    window.location.href = '/'
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}