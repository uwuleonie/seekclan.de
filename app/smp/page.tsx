'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../lib/auth-context'

export default function SmpIndexPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) {
      const mcName = (user as any).minecraft_username || user.username
      router.replace(`/smp/${mcName}`)
    } else {
      router.replace('/smp/livemap')
    }
  }, [user, loading, router])

  return <p style={{ color: 'var(--muted)' }}>Weiterleiten...</p>
}
