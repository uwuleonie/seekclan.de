'use client'

// Startseite von seekclan.de
// Aufbau:
//  1. Hero über die ganze Breite: Showcase-Bilder (langsamer Zoom), Server-IP zum Kopieren,
//     Live-Status mit den Köpfen der Spieler, die gerade online sind
//  2. Live-Leiste: nächstes SMP-Event, neuestes Update, Clan
//  3. Bereiche als Bildkacheln – im Admin-Bereich unter /admin2/startseite einstellbar
//  4. „So kommst du rein“ + Discord
// Styles: app/home.css (Präfix hm-). Unter dem Hero richten sich die Farben nach dem gewählten Theme.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { signatureFont as signature } from './lib/fonts'
import { useAuth } from './lib/auth-context'
import './home.css'

type Tile = { id: number; title: string; description: string; href: string; image: string | null; icon: string | null }
type HomeData = {
  showcase: { url: string; caption: string }[]
  tiles: Tile[] | null
  update: { title: string; version: string | null; date: string } | null
  event: { title: string; date: string } | null
  members: number | null
  servers?: ExtraServer[]
  featured?: FeaturedEvent | null
}
type FeaturedEvent = { id: number; slug: string; title: string; subtitle: string; href: string | null; accent: string; image: string | null; startsAt: string; endsAt: string }
type ExtraServer = { id: number; address: string; name: string; description: string; version: string; icon: string | null; image: string | null }
type Status = { online: boolean; players: number; maxPlayers?: number }

const SERVER_IP = 'seekclan.de'
const MC_VERSION = '1.21.11'

// Wird nur benutzt, solange die Tabelle für die Kacheln noch nicht angelegt ist
const FALLBACK_TILES: Tile[] = [
  { id: -1, title: 'SMP', description: 'Verbinde dich auf seekclan.de in 1.21.11.', href: '/smp', image: null, icon: 'filled_map' },
  { id: -2, title: 'Clan', description: 'Alle Mitglieder mit Rolle und Beitrittsdatum.', href: '/clan', image: null, icon: 'name_tag' },
  { id: -3, title: "Hide'n'Seek", description: 'Erfolge, Rekorde, Top 10 und mehr.', href: '/hidenseek', image: null, icon: 'spyglass' },
  { id: -4, title: 'UCL-Tippspiel', description: 'Champions League 26/27 tippen.', href: '/ucl2627', image: null, icon: 'nether_star' },
]

function relTime(iso: string, future: boolean) {
  const diff = (new Date(iso).getTime() - Date.now()) * (future ? 1 : -1)
  const min = Math.round(diff / 60000)
  const h = Math.round(diff / 3600000)
  const d = Math.round(diff / 86400000)
  const pre = future ? 'in' : 'vor'
  if (min < 1) return future ? 'jetzt' : 'gerade eben'
  if (min < 60) return `${pre} ${min} Min.`
  if (h < 24) return `${pre} ${h} Std.`
  if (d < 14) return `${pre} ${d} ${d === 1 ? 'Tag' : 'Tagen'}`
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })
}

// Kleine eigene Linien-Icons (keine Emojis)
function Svg({ d, size = 18 }: { d: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  )
}
const I = {
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
  check: <path d="m5 12 5 5L20 7" />,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  discord: <><path d="M8 17c-2.5-.5-4-1.5-4-1.5S4.5 9 7 6c1.5-.8 3-1 3-1l.5 1h3l.5-1s1.5.2 3 1c2.5 3 3 9.5 3 9.5s-1.5 1-4 1.5l-1-2" /><circle cx="9.5" cy="12" r="1" /><circle cx="14.5" cy="12" r="1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
}

function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* egal */ }
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }, [])
  return { copied, copy }
}

function IpButton({ big }: { big?: boolean }) {
  const { copied, copy } = useCopy()
  return (
    <button className={`hm-ip ${big ? 'big' : ''} ${copied ? 'done' : ''}`} onClick={() => copy(SERVER_IP)} aria-label={`Server-Adresse ${SERVER_IP} kopieren`}>
      <img src="/block-textures/grass_block_side.png" alt="" className="hm-ip-block" />
      <span className="hm-ip-text">{SERVER_IP}</span>
      <span className="hm-ip-action">
        <Svg d={copied ? I.check : I.copy} size={16} />
        {copied ? 'Kopiert' : 'Kopieren'}
      </span>
    </button>
  )
}

// Bild der Event-Karte.
// Fotos füllen die Fläche. Logos mit durchsichtigem Hintergrund (z. B. ein PNG-Schriftzug) werden
// ganz gezeigt und bekommen dahinter eine weichgezeichnete, vergrößerte Kopie von sich selbst –
// so passt der Hintergrund immer farblich zum Logo.
function EventMedia({ src }: { src: string }) {
  const [logo, setLogo] = useState(false)
  const check = (img: HTMLImageElement) => {
    try {
      const w = 24, h = 24
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(img, 0, 0, w, h)
      const d = ctx.getImageData(0, 0, w, h).data
      // Ecken und Ränder prüfen: viel Durchsichtiges = Logo
      let transparent = 0, total = 0
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (x > 2 && x < w - 3 && y > 2 && y < h - 3) continue
        total++
        if (d[(y * w + x) * 4 + 3] < 200) transparent++
      }
      setLogo(transparent / total > 0.3)
    } catch { /* Bild von fremder Seite – dann einfach als Foto zeigen */ }
  }
  return (
    <div className={`hm-ev-media ${logo ? 'logo' : ''}`}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden="true" className="hm-ev-ambient" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="hm-ev-img" onLoad={ev => check(ev.currentTarget)} />
    </div>
  )
}

// Hervorgehobenes Event (aus /admin2/events): vor dem Start Countdown, danach „läuft noch“
function EventCard({ e }: { e: FeaturedEvent }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const start = new Date(e.startsAt).getTime()
  const end = new Date(e.endsAt).getTime()
  if (now >= end) return null
  const live = now >= start
  const left = Math.max(0, (live ? end : start) - now)
  const parts = [
    { v: Math.floor(left / 86400000), l: 'Tage' },
    { v: Math.floor(left / 3600000) % 24, l: 'Std' },
    { v: Math.floor(left / 60000) % 60, l: 'Min' },
    { v: Math.floor(left / 1000) % 60, l: 'Sek' },
  ]
  const body = (
    <>
      {e.image ? <EventMedia src={e.image} /> : <div className="hm-ev-img hm-ev-noimg" />}
      <div className="hm-ev-body">
        <span className={`hm-ev-badge ${live ? 'live' : ''}`}>{live ? 'Läuft gerade' : 'Bald'}</span>
        <b className="hm-ev-title">{e.title}</b>
        {e.subtitle && <span className="hm-ev-sub">{e.subtitle}</span>}
        <span className="hm-ev-label">{live ? 'Endet in' : 'Startet in'}</span>
        <div className="hm-ev-count" aria-label={`${parts[0].v} Tage, ${parts[1].v} Stunden, ${parts[2].v} Minuten`}>
          {parts.map(p => (
            <span key={p.l}><b>{String(p.v).padStart(2, '0')}</b><small>{p.l}</small></span>
          ))}
        </div>
        {e.href && <span className="hm-ev-go">Zum Event <Svg d={I.arrow} size={15} /></span>}
      </div>
    </>
  )
  const style = { '--ev': e.accent } as React.CSSProperties
  if (!e.href) return <div className="hm-ev" style={style}>{body}</div>
  return /^https?:\/\//i.test(e.href)
    ? <a href={e.href} target="_blank" rel="noopener noreferrer" className="hm-ev link" style={style}>{body}</a>
    : <Link href={e.href} className="hm-ev link" style={style}>{body}</Link>
}

// Eine weitere Server-Adresse als Kachel (im Aufklapp-Menü unter seekclan.de)
function ServerCard({ s }: { s: ExtraServer }) {
  const { copied, copy } = useCopy()
  return (
    <div className="hm-srv-card">
      {s.image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={s.image} alt="" className="hm-srv-img" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={`/item-textures/${s.icon || 'compass_00'}.png`} alt="" className="hm-srv-img pixel" />}
      <div className="hm-srv-text">
        <b>{s.name}{s.version && <span className="hm-srv-ver">{s.version}</span>}</b>
        <span className="hm-srv-addr">{s.address}</span>
        {s.description && <small>{s.description}</small>}
      </div>
      <button className={`hm-srv-copy ${copied ? 'done' : ''}`} onClick={() => copy(s.address)} aria-label={`Server-Adresse ${s.address} kopieren`} title="Adresse kopieren">
        <Svg d={copied ? I.check : I.copy} size={16} />
      </button>
    </div>
  )
}

// Hauptadresse seekclan.de – beim Drüberfahren (oder Antippen des Pfeils) klappen weitere Server auf
function ServerPicker({ servers }: { servers: ExtraServer[] }) {
  const [open, setOpen] = useState(false)
  const more = servers.length > 0
  return (
    <div
      className={`hm-srv ${open ? 'open' : ''}`}
      // Nur mit der Maus per Drüberfahren öffnen – am Handy über den Pfeil-Knopf
      onPointerEnter={e => { if (more && e.pointerType === 'mouse') setOpen(true) }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') setOpen(false) }}
    >
      <div className="hm-hero-ip">
        <IpButton big />
        {more && (
          <button className="hm-srv-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Weitere Server anzeigen" title="Weitere Server">
            <span>+{servers.length}</span>
            <Svg d={<path d="m6 9 6 6 6-6" />} size={16} />
          </button>
        )}
        <span className="hm-version">Java {MC_VERSION}</span>
      </div>
      {more && (
        <div className="hm-srv-panel" aria-hidden={!open} inert={!open}>
          <div className="hm-srv-box">
            <p className="hm-srv-label">Weitere Server</p>
            {servers.map(s => <ServerCard key={s.id} s={s} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// Hintergrund unter dem Hero: Unterwasser-Licht im Prismarin-Stil
// Schimmernde Wasseroberfläche und Lichtstrahlen von oben, nach unten wird das Wasser tiefer.
// Rein dekorativ, bei „Bewegung reduzieren“ steht alles still.
function Sea() {
  return (
    <div className="hm-sea" aria-hidden="true">
      <div className="hm-sea-surface" />
      <div className="hm-sea-rays">{[0, 1, 2, 3, 4].map(i => <span key={i} />)}</div>
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  const [data, setData] = useState<HomeData | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [online, setOnline] = useState<string[]>([])
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    fetch('/api/home').then(r => r.json()).then(setData).catch(() => setData({ showcase: [], tiles: null, update: null, event: null, members: null }))
  }, [])

  // Live-Status alle 20 Sekunden
  useEffect(() => {
    const load = () => {
      fetch('/api/smp/server-status').then(r => r.json()).then(setStatus).catch(() => {})
      fetch('/api/smp/dynmap-players').then(r => r.json())
        .then(d => setOnline(((d.players ?? []) as { account?: string }[]).map(p => p.account || '').filter(n => /^[A-Za-z0-9_]{2,16}$/.test(n))))
        .catch(() => {})
    }
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [])

  const shots = data?.showcase ?? []
  useEffect(() => {
    if (shots.length < 2) return
    const t = setInterval(() => setSlide(s => (s + 1) % shots.length), 7000)
    return () => clearInterval(t)
  }, [shots.length])

  const tiles = data ? (data.tiles ?? FALLBACK_TILES) : null
  const players = status?.online ? status.players : 0
  const heads = online.slice(0, 8)

  return (
    <div className="hm">
      {/* ── 1. Hero ─────────────────────────────────────────────── */}
      <section className="hm-hero">
        <div className="hm-hero-bg" aria-hidden="true">
          {shots.length === 0 && <div className="hm-hero-empty" />}
          {shots.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={s.url} src={s.url} alt="" className={`hm-hero-img ${i === slide ? 'on' : ''}`} />
          ))}
          <div className="hm-hero-shade" />
        </div>

        <div className="hm-hero-inner">
          <div className="hm-hero-main">
            <h1 className={`hm-title ${signature.className}`}>seek</h1>
            <p className="hm-lead">Minecraft-Community · seit 2022</p>

            <ServerPicker servers={data?.servers ?? []} />

            <div className="hm-hero-actions">
              <a href="/discord" target="_blank" rel="noopener noreferrer" className="hm-btn primary">
                <Svg d={I.discord} /> Discord beitreten
              </a>
              <Link href="/join-server" className="hm-btn ghost">So trittst du bei <Svg d={I.arrow} size={16} /></Link>
            </div>
          </div>

          <div className="hm-side">
          {data?.featured && <EventCard e={data.featured} />}
          <aside className="hm-live" aria-live="polite">
            <div className="hm-live-row">
              <span className={`hm-dot ${status === null ? '' : status.online ? 'on' : 'off'}`} />
              <b>{status === null ? 'Server wird geprüft …' : status.online ? 'Server online' : 'Server offline'}</b>
            </div>
            {status?.online && (
              <>
                <p className="hm-live-count">
                  <span>{players}</span> Spieler gerade da
                </p>
                {heads.length > 0 && (
                  <div className="hm-heads">
                    {heads.map(n => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={n} src={`/api/player-heads/${n}/64`} alt={n} title={n} loading="lazy" />
                    ))}
                    {online.length > heads.length && <span className="hm-heads-more">+{online.length - heads.length}</span>}
                  </div>
                )}
              </>
            )}
            {status && !status.online && <p className="hm-live-sub">Schau im Discord, wann es weitergeht.</p>}
          </aside>
          </div>
        </div>

        {shots.length > 0 && (
          <div className="hm-hero-foot">
            <span className="hm-caption">{shots[slide]?.caption}</span>
            {shots.length > 1 && (
              <div className="hm-dots">
                {shots.map((s, i) => (
                  <button key={s.url} className={i === slide ? 'on' : ''} onClick={() => setSlide(i)} aria-label={`Bild ${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hinweis: nach unten geht es weiter */}
        <button
          className="hm-scroll"
          aria-label="Nach unten scrollen"
          onClick={() => document.querySelector('.hm-below')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <Svg d={<path d="m6 9 6 6 6-6" />} size={22} />
        </button>
      </section>

      {/* Alles unter dem Hero liegt „unter Wasser“ (Hintergrund: siehe Sea) */}
      <div className="hm-below">
      <Sea />

      {/* ── 2. Live-Leiste ──────────────────────────────────────── */}
      {data && (data.event || data.update || data.members) && (
        <section className="hm-wrap hm-strip">
          {data.event && (
            <Link href="/smp" className="hm-strip-item">
              <span className="hm-strip-icon"><Svg d={I.calendar} /></span>
              <span className="hm-strip-text">
                <small>Nächstes Event · {relTime(data.event.date, true)}</small>
                <b>{data.event.title}</b>
              </span>
            </Link>
          )}
          {data.update && (
            <Link href="/changelog" className="hm-strip-item">
              <span className="hm-strip-icon"><Svg d={I.spark} /></span>
              <span className="hm-strip-text">
                <small>Neuestes Update{data.update.version ? ` · v${data.update.version}` : ''} · {relTime(data.update.date, false)}</small>
                <b>{data.update.title}</b>
              </span>
            </Link>
          )}
          {data.members ? (
            <Link href="/clan" className="hm-strip-item">
              <span className="hm-strip-icon"><Svg d={I.users} /></span>
              <span className="hm-strip-text">
                <small>Clan</small>
                <b>{data.members} Mitglieder</b>
              </span>
            </Link>
          ) : null}
        </section>
      )}

      {/* ── 3. Bereiche ─────────────────────────────────────────── */}
      <section className="hm-wrap hm-section">
        <div className="hm-section-head">
          <h2>Entdecken</h2>
        </div>
        {!tiles && <div className="hm-tiles">{[0, 1, 2, 3].map(i => <div key={i} className="hm-tile skeleton" />)}</div>}
        {tiles && tiles.length > 0 && (
          <div className={`hm-tiles n${Math.min(tiles.length, 5)}`}>
            {tiles.map(t => {
              const external = /^https?:\/\//i.test(t.href)
              const inner = (
                <>
                  {t.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={t.image} alt="" className="hm-tile-img" loading="lazy" />
                    : <div className="hm-tile-pattern" />}
                  <div className="hm-tile-shade" />
                  {t.icon && <img src={`/item-textures/${t.icon}.png`} alt="" className="hm-tile-icon" />}
                  <div className="hm-tile-body">
                    <h3>{t.title}</h3>
                    {t.description && <p>{t.description}</p>}
                    <span className="hm-tile-go"><Svg d={I.arrow} size={16} /></span>
                  </div>
                </>
              )
              return external
                ? <a key={t.id} href={t.href} target="_blank" rel="noopener noreferrer" className="hm-tile">{inner}</a>
                : <Link key={t.id} href={t.href} className="hm-tile">{inner}</Link>
            })}
          </div>
        )}
      </section>

      {/* ── 4. Beitreten ────────────────────────────────────────── */}
      <section className="hm-wrap hm-section hm-join">
        <div className="hm-join-steps">
          <h2>So kommst du rein</h2>
          <ol>
            <li><span>1</span><div><b>Minecraft Java Edition starten</b><p>Version {MC_VERSION}</p></div></li>
            <li><span>2</span><div><b>Mehrspieler → Server hinzufügen</b><p>Namen kannst du frei wählen.</p></div></li>
            <li><span>3</span><div><b>Adresse eintragen</b><IpButton /></div></li>
          </ol>
          <Link href="/join-server" className="hm-link">Ausführliche Anleitung <Svg d={I.arrow} size={15} /></Link>
        </div>
        <a href="/discord" target="_blank" rel="noopener noreferrer" className="hm-discord">
          <span className="hm-discord-icon"><Svg d={I.discord} size={30} /></span>
          <b>Discord</b>
          <p>Events, Updates und direkter Austausch mit dem Clan.</p>
          <span className="hm-btn light">Beitreten <Svg d={I.arrow} size={16} /></span>
        </a>
      </section>
      </div>
    </div>
  )
}