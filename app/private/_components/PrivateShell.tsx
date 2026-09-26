'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/auth-context'
import Icon from './Icon'
import UploadDock from './UploadDock'
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
})

export function usePrivate() {
  return useContext(Ctx)
}

const NAV = [
  { href: '/private', label: 'Übersicht', short: 'Start', icon: 'home', key: '1' },
  { href: '/private/dateien', label: 'Quick Share', short: 'Teilen', icon: 'share', key: '2' },
  { href: '/private/leonie', label: 'Notizen', short: 'Notizen', icon: 'notes', key: '3', leonieOnly: true },
  { href: '/private/geoguessr', label: 'GeoGuessr', short: 'Geo', icon: 'globe', key: '4' },
]

const SECTION_TITLES: [string, string][] = [
  ['/private/dateien', 'Quick Share'],
  ['/private/leonie', 'Notizen'],
  ['/private/geoguessr', 'GeoGuessr'],
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
  const [uploadFolder, setUploadFolder] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const toastId = useRef(0)
  const dragDepth = useRef(0)

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

  /* Tastenkürzel am PC: Alt + 1–4 wechselt den Bereich */
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
        <Link href="/private" className="pv-brand">
          <span className="pv-brand-mark">P</span>
          <span>
            <div className="pv-brand-name">Privat</div>
            <div className="pv-brand-sub">{displayName}</div>
          </span>
        </Link>

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
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className={`pv-tab ${isActive(item.href) ? 'active' : ''}`}>
              <Icon name={item.icon} size={21} />
              {item.short}
              {item.href === '/private/dateien' && unseen > 0 && (
                <span className="pv-dot">{unseen > 9 ? '9+' : unseen}</span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Handy-Menü: Profil + Links */}
      {menuOpen && (
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
            {profileSwitch}
            <div className="pv-sep" />
            <Link href="/" className="pv-menu-item"><Icon name="back" /> Zur Website</Link>
            <Link href="/admin2" className="pv-menu-item"><Icon name="grid" /> Admin2</Link>
            <button className="pv-btn" onClick={() => setMenuOpen(false)}>Schließen</button>
          </div>
        </div>
      )}

      {dragOver && (
        <div className="pv-drop-full">
          <div className="pv-glass strong">Loslassen zum Senden</div>
        </div>
      )}

      <div id="pv-portal" />
      {toastLayer}
    </div>
  )
}