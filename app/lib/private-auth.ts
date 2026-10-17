import { NextRequest } from 'next/server'
import { mitRecht } from '@/app/lib/rechte'

export interface PrivateUser {
  id: string // users.id ist eine UUID
  username: string
}

/**
 * Zugang zum privaten Bereich (/private): Recht „privat.zugang“ (Rang-System, app/lib/rechte-def.ts),
 * gleiche Regel wie in app/private/_components/PrivateShell.tsx.
 * Quick-Share-Dateien sind zusätzlich pro Account getrennt (user_id) —
 * jeder sieht nur seine eigenen Dateien.
 */
export async function getPrivateUser(req: NextRequest): Promise<PrivateUser | null> {
  const n = await mitRecht(req, 'privat.zugang')
  return n ? { id: n.id, username: n.username } : null
}
