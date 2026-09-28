'use client'

// Neuigkeiten-Glocke: zeigt alles Neue an einem Ort
// (Quick-Share-Dateien, Reminder, Wecker, Termine, Klausuren, später News & Sport)
// + Schalter für Push-Benachrichtigungen auf diesem Gerät.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Icon from './Icon'
import { disablePush, enablePush, getPushState, type PushState } from '../_lib/push'
import { formatWhen } from '../_lib/files'

export interface PNotification {
  id: number
  kind: string
  title: string
  body: string | null
  url: string | null
  created_at: string
  read_at: string | null
}

const KIND_ICON: Record<string, string> = {
  file: 'share', reminder: 'check', alarm: 'clock', timer: 'clock', event: 'calendar',
  exam: 'book', homework: 'book', news: 'globe', sport: 'flag', system: 'info',
}

export function BellButton({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button className="pv-icon-btn pv-bell" aria-label={`Neuigkeiten${unread ? ` (${unread} neu)` : ''}`} onClick={onClick}>
      <Icon name="bell" size={19} />
      {unread > 0 && <span className="pv-bell-dot">{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
}

export function BellPanel({
  items, unread, onClose, onReadAll, onRead, onClear, toast,
}: {
  items: PNotification[]
  unread: number
  onClose: () => void
  onReadAll: () => void
  onRead: (id: number) => void
  onClear: () => void
  toast: (t: string) => void
}) {
  const router = useRouter()
  const [push, setPush] = useState<{ state: PushState; publicKey: string | null } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { getPushState().then(setPush).catch(() => setPush({ state: 'unsupported', publicKey: null })) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function togglePush() {
    if (!push) return
    setBusy(true)
    try {
      if (push.state === 'on') {
        setPush({ ...push, state: await disablePush() })
        toast('Push auf diesem Gerät ausgeschaltet')
      } else if (push.publicKey) {
        const state = await enablePush(push.publicKey)
        setPush({ ...push, state })
        if (state === 'on') {
          toast('Push ist an – Test wird gesendet')
          fetch('/api/private/push/test', { method: 'POST' }).catch(() => {})
        } else if (state === 'denied') {
          toast('Benachrichtigungen sind im Browser blockiert')
        }
      }
    } catch (err) {
      toast(`Push: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const pushText: Record<PushState, string> = {
    on: 'Push ist auf diesem Gerät an',
    off: 'Push für dieses Gerät einschalten',
    denied: 'Im Browser blockiert – in den Website-Einstellungen erlauben',
    'not-configured': 'Push ist auf dem Server noch nicht eingerichtet (VAPID-Schlüssel fehlen)',
    'ios-install': 'iPhone: erst "Teilen → Zum Home-Bildschirm", dann dort öffnen',
    unsupported: 'Dieser Browser kann keine Push-Nachrichten',
  }

  return (
    <div className="pv-overlay sheet pv-bell-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pv-modal pv-bell-panel" role="dialog" aria-label="Neuigkeiten">
        <div className="pv-grip" />
        <div className="pv-row">
          <div className="pv-h2 pv-grow">Neuigkeiten</div>
          {unread > 0 && <button className="pv-btn sm" onClick={onReadAll}><Icon name="check" size={15} /> Alle gelesen</button>}
          <button className="pv-icon-btn ghost" aria-label="Schließen" onClick={onClose}><Icon name="x" /></button>
        </div>

        {push && (
          <button
            className={`pv-push-row ${push.state === 'on' ? 'on' : ''}`}
            disabled={busy || !['on', 'off'].includes(push.state)}
            onClick={togglePush}
          >
            <Icon name="bell" size={17} />
            <span className="pv-grow" style={{ textAlign: 'left' }}>{pushText[push.state]}</span>
            {['on', 'off'].includes(push.state) && <span className={`pv-switch ${push.state === 'on' ? 'on' : ''}`} />}
          </button>
        )}

        <div className="pv-bell-list">
          {items.length === 0 && <div className="pv-empty">Nichts Neues. Hier erscheinen Dateien, Reminder, Wecker und Termine.</div>}
          {items.map(n => (
            <button
              key={n.id}
              className={`pv-bell-item ${n.read_at ? '' : 'unread'}`}
              onClick={() => {
                if (!n.read_at) onRead(n.id)
                if (n.url) { router.push(n.url); onClose() }
              }}
            >
              <span className="pv-tile-icon" style={{ width: 36, height: 36, borderRadius: 11 }}>
                <Icon name={KIND_ICON[n.kind] ?? 'info'} size={17} />
              </span>
              <span className="pv-grow" style={{ minWidth: 0, textAlign: 'left' }}>
                <b className="pv-ellipsis" style={{ display: 'block', fontSize: 14 }}>{n.title}</b>
                {n.body && <span className="pv-muted pv-bell-body">{n.body}</span>}
                <span className="pv-muted" style={{ fontSize: 11 }}>{formatWhen(n.created_at)}</span>
              </span>
              {!n.read_at && <span className="pv-bell-unread" />}
            </button>
          ))}
        </div>

        {items.some(n => n.read_at) && (
          <button className="pv-btn ghost sm" style={{ alignSelf: 'center' }} onClick={onClear}>Gelesene entfernen</button>
        )}
      </div>
    </div>
  )
}