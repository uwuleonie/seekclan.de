'use client'

import { useState, useEffect } from 'react'

type ActivityEntry = {
  event_type: string
  detail: string | null
  player_uuid: string
  player_name: string
  total_count: string
}

type PlaytimeEntry = {
  player_uuid: string
  player_name: string
  total_seconds: string
}

type Props = {
  claimId?: number
  groupId?: number
  onClose: () => void
  // Wenn true, wird die Komponente als normales Element im Seitenfluss
  // gerendert (kein Vollbild-Backdrop) - für die Einbindung als Tab auf
  // /smp/claims. Standardmäßig false = Modal-Verhalten, wie es das
  // Leaderboard nutzt.
  inline?: boolean
}

const EVENT_LABELS: Record<string, string> = {
  block_break: 'Blöcke abgebaut',
  block_place: 'Blöcke platziert',
  mob_kill: 'Mobs getötet',
  player_death: 'Tode',
}

function formatDuration(totalSecondsStr: string): string {
  const totalSeconds = parseInt(totalSecondsStr, 10) || 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

export default function ClaimActivityDetailModal({ claimId, groupId, onClose, inline = false }: Props) {
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<any>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [playtime, setPlaytime] = useState<PlaytimeEntry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = claimId ? `claim_id=${claimId}` : `group_id=${groupId}`
    fetch(`/api/smp/claims/activity-details?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setMeta(data.meta)
          setActivity(data.activity || [])
          setPlaytime(data.playtime || [])
          setError('')
        }
        setLoading(false)
      })
  }, [claimId, groupId])

  const groupedByType = activity.reduce((acc, entry) => {
    if (!acc[entry.event_type]) acc[entry.event_type] = []
    acc[entry.event_type].push(entry)
    return acc
  }, {} as Record<string, ActivityEntry[]>)

  const content = (
    <>
      {!inline && (
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold text-lg" style={{ color: 'var(--foreground)' }}>
            {meta?.name || (claimId ? `Chunk ${meta?.chunk_x},${meta?.chunk_z}` : `Gruppe #${groupId}`)}
          </p>
          <button onClick={onClose} className="text-sm" style={{ color: 'var(--muted)' }}>✕</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Laden...</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <>
          <div className="mb-5">
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>SPIELZEIT</p>
            {playtime.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Noch keine Daten.</p>
            ) : (
              <div className="space-y-1">
                {playtime.map(p => (
                  <div key={p.player_uuid} className="flex items-center gap-2">
                    <img src={`/api/player-heads/${p.player_name}/20`} alt="" className="w-5 h-5 rounded" />
                    <span className="text-sm flex-1" style={{ color: 'var(--foreground)' }}>{p.player_name}</span>
                    <span className="text-sm font-medium" style={{ color: '#16A34A' }}>{formatDuration(p.total_seconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {Object.entries(groupedByType).map(([eventType, entries]) => (
            <div key={eventType} className="mb-5">
              <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>
                {(EVENT_LABELS[eventType] || eventType).toUpperCase()}
              </p>
              <div className="space-y-1">
                {entries.slice(0, 10).map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate" style={{ color: 'var(--foreground)' }}>
                      {entry.detail ? `${entry.detail} ` : ''}
                      <span style={{ color: 'var(--muted)' }}>({entry.player_name})</span>
                    </span>
                    <span className="font-medium flex-shrink-0" style={{ color: '#16A34A' }}>
                      {parseInt(entry.total_count, 10).toLocaleString('de-DE')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {activity.length === 0 && playtime.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--muted)' }}>
              Noch keine Aktivität aufgezeichnet.
            </p>
          )}
        </>
      )}
    </>
  )

  if (inline) {
    return (
      <div className="card rounded-2xl p-6">
        {content}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )
}