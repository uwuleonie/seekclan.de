'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/auth-context'
import Icon from './Icon'
import UploadDock from './UploadDock'
import { BellButton, BellPanel, type PNotification } from './Bell'
import RingOverlay, { type RingInfo } from './RingOverlay'
import Bookmarks from './Bookmarks'
import Portal from './Portal'
import SelectionMenu from './SelectionMenu'
import { registerServiceWorker } from '../_lib/push'
import { getDeviceId } from '../_lib/device'
import { useUploader } from '../_lib/useUploader'

/* ─────────────────────────────────────────────────────────────────────────
   Gemeinsamer Kontext für alle Unterseiten
   - toast():   kurze Hinweise unten einblenden
   - stamp:     ändert sich, sobald sich in der Quick-Share-Ablage etwas ändert
                (z.B. Handy hat ein Foto hochgeladen) → Seiten laden dann neu
   - unseen:    Anzahl neuer Dateien von anderen Geräten (Badge in der Navigation)
   ───────────────────────────────────────────────────────────────────────── */

type Toast = { id: number; text: string; actionLabel?: string; action?: () => void }

type PrivateCtx = {
  toast: (text: string, opts?: { actionLabel?: string; action?: () => void; ms?: number }) => void
  stamp: string
  unseen: number
  refreshStamp: () => void
  displayName: string
  isLeonie: boolean
  /** Dateien hochladen (läuft im Hintergrund weiter, auch beim Bereichswechsel) */
  upload: (files: FileList | File[]) => void
  /** Zielordner für neue Uploads (setzt die Quick-Share-Seite, null = ohne Ordner) */
  uploadFolder: number | null
  setUploadFolder: (id: number | null) => void
  /** Wecker/Timer in der Seite klingeln lassen (z.B. lokaler Timer ist abgelaufen) */
  ring: (r: RingInfo) => void
  /** Glocke neu laden (z.B. nach Anlegen eines Reminders) */
  refreshNotifications: () => void
}

const Ctx = createContext<PrivateCtx>({
  toast: () => {},
  stamp: '',
  unseen: 0,
  refreshStamp: () => {},
  displayName: '',
  isLeonie: false,
  upload: () => {},
  uploadFolder: null,
  setUploadFolder: () => {},
  ring: () => {},
  refreshNotifications: () => {},
})

export function usePrivate() {
  return useContext(Ctx)
}

const NAV = [
  { href: '/private', label: 'Übersicht', short: 'Start', icon: 'home', key: '1' },
  { href: '/private/dateien', label: 'Quick Share', short: 'Teilen', icon: 'share', key: '2' },
  { href: '/private/planer', label: 'Planer', short: 'Planer', icon: 'calendar', key: '3' },
  { href: '/private/leonie', label: 'Notizen', short: 'Notizen', icon: 'notes', key: '4', leonieOnly: true },
  { href: '/private/aktuell', label: 'Aktuell', short: 'Aktuell', icon: 'flag', key: '5' },
  { href: '/private/geoguessr', label: 'GeoGuessr', short: 'Geo', icon: 'globe', key: '6' },
  { href: '/private/tools', label: 'Werkzeuge', short: 'Tools', icon: 'tools', key: '7' },
]

const SECTION_TITLES: [string, string][] = [
  ['/private/dateien', 'Quick Share'],
  ['/private/planer', 'Planer'],
  ['/private/leonie', 'Notizen'],
  ['/private/geoguessr', 'GeoGuessr'],
  ['/private/tools', 'Werkzeuge'],
  ['/private/aktuell', 'Aktuell'],
  ['/private/mikey', 'Mikey'],
  ['/private', 'Übersicht'],
]

export function displayNameFor(username?: string | null) {
  if (!username) return ''
  if (username === 'uwuleonie') return 'Leonie'
  return username
}

export default function PrivateShell({ children, fontClass }: { children: React.ReactNode; fontClass: string }) {
  const { user, loading } = useAuth()
  const pathname = usePathname() || '/private'
  const router = useRouter()

  const [toasts, setToasts] = useState<Toast[]>([])
  const [stamp, setStamp] = useState('')
  const [unseen, setUnseen] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [uploadFolder, setUploadFolder] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [notifs, setNotifs] = useState<PNotification[]>([])
  const [notifUnread, setNotifUnread] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)
  const [ringing, setRinging] = useState<RingInfo | null>(null)
  const toastId = useRef(0)
  const dragDepth = useRef(0)
  const knownNotifIds = useRef<Set<number> | null>(null)
  const rungKeys = useRef<Map<string, number>>(new Map())

  // Geteilte Notiz-Ansicht ist öffentlich (Token-Link) → ohne Login und ohne Menü
  const isPublicView = pathname.startsWith('/private/leonie/view')
  const canEnter = !!user && !!user.clan_role && ['administrator', 'owner'].includes(user.clan_role)
  const isLeonie = user?.username === 'uwuleonie'
  const displayName = displayNameFor(user?.username)

  /* Seite hinter dem Bereich nicht mitscrollen lassen (wichtig auf dem Handy) */
  useEffect(() => {
    const html = document.documentElement
    const prevHtml = html.style.overflow
    const prevBody = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [])

  const toast = useCallback<PrivateCtx['toast']>((text, opts) => {
    const id = ++toastId.current
    setToasts(t => [...t.slice(-2), { id, text, actionLabel: opts?.actionLabel, action: opts?.action }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), opts?.ms ?? 3200)
  }, [])

  /* Änderungen der Ablage abfragen (leichtgewichtig, nur wenn Tab sichtbar) */
  const refreshStamp = useCallback(async () => {
    try {
      const res = await fetch(`/api/private/files/stamp?device=${encodeURIComponent(getDeviceId())}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setStamp(data.stamp)
      setUnseen(data.unseen)
    } catch {
      /* offline — nächster Versuch beim nächsten Intervall */
    }
  }, [])

  const uploader = useUploader(() => { refreshStamp() })
  const addUpload = uploader.add
  const uploadFolderRef = useRef(uploadFolder)
  useEffect(() => { uploadFolderRef.current = uploadFolder }, [uploadFolder])
  const upload = useCallback((files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    addUpload(list, uploadFolderRef.current)
  }, [addUpload])

  /* Dateien überall im Bereich per Drag & Drop oder Strg+V (Screenshot) hochladen */
  useEffect(() => {
    if (!canEnter || isPublicView) return
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth.current++; setDragOver(true) }
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault() }
    const onLeave = (e: DragEvent) => { if (!hasFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragOver(false) }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setDragOver(false)
      if (e.dataTransfer?.files.length) upload(e.dataTransfer.files)
    }
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const files = Array.from(e.clipboardData?.files ?? [])
      if (!files.length) return
      e.preventDefault()
      // Screenshots aus der Zwischenablage heißen immer "image.png" → sinnvoller Name
      const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
      upload(files.map((f, i) => (f.name === 'image.png' ? new File([f], `Einfügen_${stamp}${i ? `_${i}` : ''}.png`, { type: f.type }) : f)))
      toast(`${files.length === 1 ? 'Datei' : `${files.length} Dateien`} aus der Zwischenablage wird gesendet`)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [canEnter, isPublicView, upload, toast])

  useEffect(() => {
    if (!canEnter || isPublicView) return
    refreshStamp()
    const tick = () => { if (document.visibilityState === 'visible') refreshStamp() }
    const iv = setInterval(tick, 5000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [canEnter, isPublicView, refreshStamp])

  /* ── Klingeln (Wecker/Timer) ── */
  const ring = useCallback((r: RingInfo) => {
    const last = rungKeys.current.get(r.key)
    if (last && Date.now() - last < 5 * 60_000) return // gleicher Wecker schon geklingelt
    rungKeys.current.set(r.key, Date.now())
    setRinging(r)
  }, [])

  /* ── Neuigkeiten-Glocke ── */
  const refreshNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/private/notifications?device=${encodeURIComponent(getDeviceId())}`, { cache: 'no-store' })
      if (!res.ok) return
      const data: { items: PNotification[]; unread: number } = await res.json()
      const known = knownNotifIds.current
      if (known) {
        for (const n of data.items) {
          if (known.has(n.id) || n.read_at) continue
          const fresh = Date.now() - new Date(n.created_at).getTime() < 3 * 60_000
          if (!fresh) continue
          const alarmId = /ring=(\d+)/.exec(n.url || '')?.[1]
          if ((n.kind === 'alarm' || n.kind === 'timer') && document.visibilityState === 'visible') {
            ring({
              key: alarmId ? `alarm:${alarmId}` : `n:${n.id}`,
              title: n.title,
              body: n.body ?? undefined,
              alarmId: alarmId ? Number(alarmId) : undefined,
              canSnooze: n.kind === 'alarm',
            })
          } else if (!(n.kind === 'file' && window.location.pathname.startsWith('/private/dateien'))) {
            toast(n.title, n.url ? { actionLabel: 'Öffnen', action: () => router.push(n.url!), ms: 5000 } : { ms: 5000 })
          }
        }
      }
      knownNotifIds.current = new Set(data.items.map(n => n.id))
      setNotifs(data.items)
      setNotifUnread(data.unread)
    } catch {
      /* Tabelle fehlt noch oder offline */
    }
  }, [ring, toast, router])

  useEffect(() => {
    if (!canEnter || isPublicView) return
    registerServiceWorker()
    refreshNotifications()
    const tick = () => { if (document.visibilityState === 'visible') refreshNotifications() }
    const iv = setInterval(tick, 10_000)
    document.addEventListener('visibilitychange', tick)
    // Push kam an, während die Seite offen ist → sofort aktualisieren
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'pv-push') refreshNotifications() }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', tick)
      navigator.serviceWorker?.removeEventListener('message', onMsg)
    }
  }, [canEnter, isPublicView, refreshNotifications])

  async function markRead(ids?: number[]) {
    setNotifs(prev => prev.map(n => (!ids || ids.includes(n.id) ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)))
    setNotifUnread(u => (ids ? Math.max(0, u - ids.length) : 0))
    await fetch('/api/private/notifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', ids }),
    }).catch(() => {})
  }

  async function snooze(minutes: number) {
    const at = new Date(Date.now() + minutes * 60_000)
    const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
    const label = ringing?.title ? `Schlummern: ${ringing.title}` : 'Schlummern'
    setRinging(null)
    const res = await fetch('/api/private/planer/alarms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'alarm', label: label.slice(0, 120), time_of_day: time, days: [] }),
    })
    toast(res.ok ? `Klingelt wieder um ${time}` : 'Schlummern fehlgeschlagen')
  }

  /* Tastenkürzel am PC: Alt + 1–7 wechselt den Bereich */
  useEffect(() => {
    if (!canEnter || isPublicView) return
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const item = NAV.find(n => n.key === e.key && (!n.leonieOnly || isLeonie))
      if (item) {
        e.preventDefault()
        router.push(item.href)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEnter, isPublicView, isLeonie, router])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const ctxValue: PrivateCtx = {
    toast, stamp, unseen, refreshStamp, displayName, isLeonie, upload, uploadFolder, setUploadFolder,
    ring, refreshNotifications,
  }

  const toastLayer = (
    <div className="pv-toasts" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="pv-toast">
          <span>{t.text}</span>
          {t.action && (
            <button onClick={() => { t.action?.(); setToasts(x => x.filter(y => y.id !== t.id)) }}>
              {t.actionLabel ?? 'Öffnen'}
            </button>
          )}
        </div>
      ))}
    </div>
  )

  /* ── Öffentliche Ansicht (geteilte Notizen) ── */
  if (isPublicView) {
    return (
      <div className={`pv-root ${fontClass}`} style={{ flexDirection: 'column' }}>
        <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>
      </div>
    )
  }

  /* ── Laden / kein Zugriff ── */
  if (loading || !canEnter) {
    return (
      <div className={`pv-root ${fontClass}`}>
        <div className="pv-orb a" />
        <div className="pv-orb b" />
        <div className="pv-center" style={{ position: 'relative', zIndex: 1 }}>
          {loading ? (
            <div className="pv-spinner" />
          ) : (
            <div className="pv-glass pv-card" style={{ padding: '36px 44px', textAlign: 'center' }}>
              <p className="pv-title" style={{ fontSize: 26, marginBottom: 6 }}>Kein Zugriff</p>
              <p className="pv-subtitle" style={{ marginBottom: 18 }}>Dieser Bereich ist privat.</p>
              <Link href="/" className="pv-btn">
                <Icon name="back" size={16} /> Zur Website
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  const navItems = NAV.filter(n => !n.leonieOnly || isLeonie)
  // Handy: höchstens 5 Bereiche unten, der Rest unter "Mehr"
  const tabItems = navItems.length > 6 ? navItems.slice(0, 5) : navItems
  const moreItems = navItems.length > 6 ? navItems.slice(5) : []
  const isActive = (href: string) =>
    href === '/private' ? pathname === '/private' : pathname === href || pathname.startsWith(href + '/')
  const sectionTitle = SECTION_TITLES.find(([p]) => pathname === p || pathname.startsWith(p + '/'))?.[1] ?? 'Privat'
  const fillMain = pathname === '/private/leonie'

  const profileSwitch = (
    <div className="pv-profile">
      <p className="pv-eyebrow">Profil</p>
      <div className="pv-seg" style={{ width: '100%' }}>
        <Link href="/private/leonie" className={pathname.startsWith('/private/leonie') ? 'active' : ''}>Leonie</Link>
        <Link href="/private/mikey" className={pathname.startsWith('/private/mikey') ? 'active' : ''}>Mikey</Link>
      </div>
    </div>
  )

  return (
    <div className={`pv-root ${fontClass}`}>
      <div className="pv-orb a" />
      <div className="pv-orb b" />

      {/* Seitenleiste (PC / Tablet quer) */}
      <aside className="pv-side">
        <div className="pv-row" style={{ alignItems: 'flex-start' }}>
          <Link href="/private" className="pv-brand pv-grow">
            <span className="pv-brand-mark">P</span>
            <span>
              <div className="pv-brand-name">Privat</div>
              <div className="pv-brand-sub">{displayName}</div>
            </span>
          </Link>
          <BellButton unread={notifUnread} onClick={() => setBellOpen(true)} />
        </div>

        <nav className="pv-nav" aria-label="Bereiche">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className={`pv-nav-item ${isActive(item.href) ? 'active' : ''}`}>
              <Icon name={item.icon} size={19} />
              {item.label}
              {item.href === '/private/dateien' && unseen > 0 ? (
                <span className="pv-dot">{unseen > 99 ? '99+' : unseen}</span>
              ) : (
                <span className="pv-kbd" title={`Alt + ${item.key}`}>Alt {item.key}</span>
              )}
            </Link>
          ))}
        </nav>

        <Bookmarks variant="side" toast={t => toast(t)} />

        <div className="pv-side-foot">
          {profileSwitch}
          <div className="pv-side-links">
            <Link href="/">Website</Link>
            <Link href="/admin2">Admin2</Link>
          </div>
        </div>
      </aside>

      <div className="pv-body">
        {/* Kopfzeile (Handy) */}
        <header className="pv-topbar">
          <Link href="/private" className="pv-brand-mark" style={{ textDecoration: 'none' }}>P</Link>
          <div className="pv-topbar-title pv-ellipsis">{sectionTitle}</div>
          <BellButton unread={notifUnread} onClick={() => setBellOpen(true)} />
          <button className="pv-icon-btn" aria-label="Lesezeichen" onClick={() => setBookmarksOpen(true)}>
            <Icon name="bookmark" size={19} />
          </button>
          <button className="pv-icon-btn" aria-label="Menü" onClick={() => setMenuOpen(true)}>
            <Icon name="user" size={19} />
          </button>
        </header>

        <main className={`pv-main ${fillMain ? 'fill' : ''}`}>
          <div key={pathname} className="pv-fade">
            <Ctx.Provider value={ctxValue}>{children}</Ctx.Provider>
          </div>
        </main>

        <UploadDock
          items={uploader.items}
          totals={uploader.totals}
          onCancel={uploader.cancel}
          onRetry={uploader.retry}
          onClear={uploader.clearFinished}
        />

        {/* Tab-Leiste (Handy) */}
        <nav className="pv-tabbar" aria-label="Bereiche">
          {tabItems.map(item => (
            <Link key={item.href} href={item.href} className={`pv-tab ${isActive(item.href) ? 'active' : ''}`}>
              <Icon name={item.icon} size={21} />
              {item.short}
              {item.href === '/private/dateien' && unseen > 0 && (
                <span className="pv-dot">{unseen > 9 ? '9+' : unseen}</span>
              )}
            </Link>
          ))}
          {moreItems.length > 0 && (
            <button className={`pv-tab ${moreItems.some(i => isActive(i.href)) ? 'active' : ''}`} onClick={() => setMenuOpen(true)}>
              <Icon name="grid" size={21} />
              Mehr
            </button>
          )}
        </nav>
      </div>

      {/* Handy: Lesezeichen */}
      {bookmarksOpen && (
        <Portal>
        <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setBookmarksOpen(false) }}>
          <div className="pv-modal">
            <div className="pv-grip" />
            <div className="pv-row">
              <div className="pv-h2 pv-grow">Lesezeichen</div>
              <button className="pv-icon-btn ghost" aria-label="Schließen" onClick={() => setBookmarksOpen(false)}><Icon name="x" /></button>
            </div>
            <Bookmarks variant="sheet" toast={t => toast(t)} onNavigate={() => setBookmarksOpen(false)} />
          </div>
        </div>
        </Portal>
      )}

      {/* Handy-Menü: Profil + Links */}
      {menuOpen && (
        <Portal>
        <div className="pv-overlay sheet" onClick={e => { if (e.target === e.currentTarget) setMenuOpen(false) }}>
          <div className="pv-modal">
            <div className="pv-grip" />
            <div className="pv-row">
              <span className="pv-brand-mark">{displayName.slice(0, 1).toUpperCase() || 'P'}</span>
              <div className="pv-grow">
                <div style={{ fontWeight: 600 }}>{displayName}</div>
                <div className="pv-muted" style={{ fontSize: 13 }}>Privater Bereich</div>
              </div>
            </div>
            {moreItems.length > 0 && (
              <div className="pv-more-grid">
                {moreItems.map(item => (
                  <Link key={item.href} href={item.href} className={`pv-more-item ${isActive(item.href) ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
                    <Icon name={item.icon} size={22} />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
            {profileSwitch}
            <div className="pv-sep" />
            <Link href="/" className="pv-menu-item"><Icon name="back" /> Zur Website</Link>
            <Link href="/admin2" className="pv-menu-item"><Icon name="grid" /> Admin2</Link>
            <button className="pv-btn" onClick={() => setMenuOpen(false)}>Schließen</button>
          </div>
        </div>
        </Portal>
      )}

      {dragOver && (
        <div className="pv-drop-full">
          <div className="pv-glass strong">Loslassen zum Senden</div>
        </div>
      )}

      {bellOpen && (
        <BellPanel
          items={notifs}
          unread={notifUnread}
          onClose={() => setBellOpen(false)}
          onReadAll={() => markRead()}
          onRead={id => markRead([id])}
          onClear={async () => {
            setNotifs(prev => prev.filter(n => !n.read_at))
            await fetch('/api/private/notifications', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear' }),
            }).catch(() => {})
          }}
          toast={t => toast(t)}
        />
      )}

      {ringing && (
        <RingOverlay
          ring={ringing}
          onStop={() => { setRinging(null); refreshNotifications() }}
          onSnooze={ringing.canSnooze ? snooze : undefined}
        />
      )}

      <SelectionMenu toast={t => toast(t)} />
      <div id="pv-portal" />
      {toastLayer}
    </div>
  )
}