'use client'

import { useAuth } from '../../lib/auth-context'
import ClaimMap from '../../components/ClaimMap'

export default function LivemapPage() {
  const { user } = useAuth()
  return <ClaimMap currentUuid={(user as any)?.minecraft_uuid || null} />
}
