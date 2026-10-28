'use client'

// seekclan.de/quiz – Hauptseite aller Quizzes
//
// Aufbau: Fortschritts-Panel (Level-Ring, XP-Leiste, Werte) · Kategorien · Angefangene Quizzes ·
// Neu freigeschaltet (Karten mit Kartenausschnitt) · Demnächst (Zeitleiste) · Rangliste (Podest) · Beliebt
// Kategorien: app/quiz/_lib/kategorien.ts · Daten: GET /api/quiz/uebersicht
// Angefangene Quizzes: Browser + Konto (app/geo/_lib/saves.ts)
//
// Level, XP, Sternis und Rangliste kommen zurzeit aus /geo. Sobald es den gemeinsamen Quiz-Kern gibt,
// zählen hier alle Kategorien zusammen.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'
import { KATEGORIEN } from './_lib/kategorien'
import QuizIcon from './_components/QuizIcon'
import { listAllSaves, saveProgress, type SaveState } from '../geo/_lib/saves'

interface QuizKurz {
  kategorie: string
  slug: string
  titel: string
  meta: string
  bereich: string
  farbe: string
  href: string
  at: string | null
  frisch?: boolean
  /** Kleines Kartenbild (nur bei „Neu freigeschaltet“) – siehe app/lib/quiz-karten.ts */
  karte?: { w: number; h: number; land: string; fokus: string } | null
}

interface Ich {
  name: string; username: string; xp: number; level: number; into: number; need: number; pct: number; left: number
  sternis: number; platz: number | null; versteckt: boolean; geloest: number; quizzes: number
}

interface Uebersicht {
  now: string
  loggedIn: boolean
  isAdmin: boolean
  kategorien: Record<string, { offen: number; eintraege: number; bald: number }>
  neu: QuizKurz[]
  bald: QuizKurz[]
  beliebt: QuizKurz[]
  ich: Ich | null
  top: { platz: number; name: string; username: string; level: number; xp: number; ich: boolean }[]
  ranglisten: boolean
  error?: string
}

const zahl = (n: number) => n.toLocaleString('de-DE')
const kopf = (username: string, size: number) => `/api/player-heads/${encodeURIComponent(username)}/${size}`
const MODUS: Record<string, string> = { click: 'Auf Karte finden', name: 'Namen zuordnen', type: 'Eintippen', text: 'Wissen', mixed: 'Gemischt' }

const tagStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }

/** „heute“, „gestern“, „vor 3 Tagen“, „in 2 Tagen“ – sonst Datum */
function wann(iso: string, jetzt: number) {
  const t = Date.parse(iso)
  const tage = Math.round((tagStart(t) - tagStart(jetzt)) / 86400_000)
  if (tage === 0) return t > jetzt ? `heute, ${new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'heute'
  if (tage === 1) return 'morgen'
  if (tage === -1) return 'gestern'
  if (tage < 0 && tage > -7) return `vor ${-tage} Tagen`
  if (tage > 1 && tage < 7) return `in ${tage} Tagen`
  return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

/** Kreis-Fortschritt (Level-Ring, Spielstände) */
function Ring({ pct, size, stroke, children, ticks = 0 }: { pct: number; size: number; stroke: number; children?: React.ReactNode; ticks?: number }) {
  const r = (size - stroke) / 2 - (ticks ? 7 : 0)
  const u = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, pct))
  const c = size / 2
  return (
    <div className="qz-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {ticks > 0 && Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * Math.PI * 2 - Math.PI / 2
          const r1 = c - 2, r2 = c - (i % 5 === 0 ? 7 : 5)
          return <line key={i} x1={c + Math.cos(a) * r1} y1={c + Math.sin(a) * r1} x2={c + Math.cos(a) * r2} y2={c + Math.sin(a) * r2} className={(i / ticks) * 100 < p ? 'qz-tick on' : 'qz-tick'} />
        })}
        <circle cx={c} cy={c} r={r} className="qz-ring-track" strokeWidth={stroke} fill="none" />
        <circle cx={c} cy={c} r={r} className="qz-ring-fill" strokeWidth={stroke} fill="none"
          strokeDasharray={u} strokeDashoffset={u * (1 - p / 100)} transform={`rotate(-90 ${c} ${c})`} strokeLinecap="round" />
      </svg>
      <div className="qz-ring-inner">{children}</div>
    </div>
  )
}

export default function QuizHome() {
  const { user, loading } = useAuth()
  const [daten, setDaten] = useState<Uebersicht | null>(null)
  const [fehler, setFehler] = useState(false)
  const [saves, setSaves] = useState<SaveState[]>([])
  const [ladeZeit] = useState(() => Date.now())

  useEffect(() => {
    if (loading) return
    let alive = true
    fetch('/api/quiz/uebersicht', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: Uebersicht) => { if (alive) { setFehler(!!d.error); if (!d.error) setDaten(d) } })
      .catch(() => { if (alive) setFehler(true) })
    listAllSaves(!!user).then(s => { if (alive) setSaves(s) })
    return () => { alive = false }
  }, [user?.id, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const jetzt = daten ? Date.parse(daten.now) : ladeZeit
  const geo = daten?.kategorien.geo
  const ich = daten?.ich ?? null
  const podest = daten?.top.slice(0, 3) ?? []
  const restListe = daten?.top.slice(3) ?? []

  return (
    <div className="qz-page">
      {/* ── Kopf ── */}
      <header className="qz-head">
        <h1 className="qz-h1">Quiz</h1>
        <div className="qz-chips">
          <span className="qz-chip"><b>{geo ? zahl(geo.offen) : '–'}</b> Quizzes offen</span>
          <span className="qz-chip"><b>{geo ? zahl(geo.eintraege) : '–'}</b> Fragen & Orte</span>
          <span className="qz-chip"><b>{KATEGORIEN.filter(k => k.status === 'live').length}</b> von {KATEGORIEN.length} Kategorien live</span>
        </div>
      </header>

      {/* ── Fortschritt ── */}
      {!daten && !fehler ? (
        <div className="qz-dash"><div className="qz-skeleton" style={{ height: 150, gridColumn: '1 / -1' }} /></div>
      ) : ich ? (
        <section className="qz-dash" aria-label="Dein Fortschritt">
          <div className="qz-dash-ring">
            <Ring pct={ich.pct} size={150} stroke={11} ticks={60}>
              <small>Level</small>
              <b>{ich.level}</b>
            </Ring>
            <img src={kopf(ich.username, 64)} alt="" className="qz-dash-kopf" width={40} height={40} />
          </div>

          <div className="qz-dash-main">
            <p className="qz-eyebrow">Dein Fortschritt</p>
            <h2 className="qz-dash-name">{ich.name}</h2>
            <div className="qz-xp">
              <div className="qz-xp-track">
                <span className="qz-xp-fill" style={{ width: `${Math.max(3, Math.min(100, ich.pct))}%` }}>
                  <span className="qz-xp-knopf" />
                </span>
                {[25, 50, 75].map(m => <i key={m} className={`qz-xp-mark ${ich.pct >= m ? 'on' : ''}`} style={{ left: `${m}%` }} />)}
              </div>
              <div className="qz-xp-legende">
                <span><b>{zahl(ich.into)}</b> / {zahl(ich.need)} XP</span>
                <span className="qz-xp-ziel">noch <b>{zahl(ich.left)} XP</b> bis Level {ich.level + 1}</span>
              </div>
            </div>
          </div>

          <div className="qz-dash-stats">
            <div className="qz-stat" style={{ '--qz-s': '#e9b35f' } as React.CSSProperties}>
              <span className="qz-stat-icon"><QuizIcon name="star" size={17} /></span>
              <b>{zahl(ich.xp)}</b><small>XP gesamt</small>
            </div>
            <div className="qz-stat" style={{ '--qz-s': '#f19cc0' } as React.CSSProperties}>
              <span className="qz-stat-icon"><QuizIcon name="sparkle" size={17} /></span>
              <b>{zahl(ich.sternis)}</b><small>Sternis</small>
            </div>
            <div className="qz-stat" style={{ '--qz-s': '#5ec4d4' } as React.CSSProperties}>
              <span className="qz-stat-icon"><QuizIcon name="trophy" size={17} /></span>
              <b>{ich.platz ? `#${zahl(ich.platz)}` : '–'}</b><small>{ich.versteckt ? 'ausgeblendet' : 'Platz'}</small>
            </div>
            <div className="qz-stat" style={{ '--qz-s': '#7fd19b' } as React.CSSProperties}>
              <span className="qz-stat-icon"><QuizIcon name="check" size={17} /></span>
              <b>{zahl(ich.geloest)}</b><small>gelöst</small>
            </div>
          </div>
        </section>
      ) : daten ? (
        <section className="qz-dash gast">
          <span className="qz-gast-icon"><QuizIcon name="star" size={26} /></span>
          <div className="qz-dash-main">
            <h2 className="qz-dash-name">Spielen geht auch ohne Konto.</h2>
            <p className="qz-muted">Mit Login bekommst du XP, Sternis und einen Platz in der Rangliste – und dein Fortschritt bleibt auf jedem Gerät.</p>
          </div>
          <Link href="/login?redirect=/quiz" className="qz-btn primary">Einloggen</Link>
        </section>
      ) : null}

      {fehler && <div className="qz-card qz-hinweis">Die Übersicht konnte gerade nicht geladen werden. Die Quizzes selbst funktionieren trotzdem – einfach unten eine Kategorie öffnen.</div>}

      {/* ── Kategorien ── */}
      <section className="qz-section">
        <div className="qz-section-head">
          <div>
            <p className="qz-eyebrow">Wähl dein Thema</p>
            <h2 className="qz-h2">Kategorien</h2>
          </div>
        </div>
        <div className="qz-kat-grid">
          {KATEGORIEN.map(k => {
            const st = daten?.kategorien[k.key]
            const inhalt = (
              <>
                <span className="qz-kat-emblem"><QuizIcon name={k.icon} size={30} /></span>
                <div className="qz-kat-body">
                  <small className="qz-kat-sub">{k.untertitel}</small>
                  <b className="qz-kat-title">{k.titel}</b>
                  <p className="qz-kat-text">{k.text}</p>
                </div>
                <div className="qz-kat-foot">
                  {k.status === 'live' ? (
                    <>
                      <span className="qz-muted">{st ? `${zahl(st.offen)} offen${st.bald ? ` · ${zahl(st.bald)} bald` : ''}` : ' '}</span>
                      <span className="qz-go">Öffnen <QuizIcon name="next" size={15} /></span>
                    </>
                  ) : (
                    <span className="qz-badge"><QuizIcon name="lock" size={13} /> Bald verfügbar</span>
                  )}
                </div>
              </>
            )
            const style = { '--qz-kat': k.farbe } as React.CSSProperties
            return k.status === 'live'
              ? <Link key={k.key} href={k.href} className="qz-kat" style={style}>{inhalt}</Link>
              : <div key={k.key} className="qz-kat locked" style={style} aria-disabled="true">{inhalt}</div>
          })}
        </div>
      </section>

      {/* ── Weiterspielen ── */}
      {saves.length > 0 && (
        <section className="qz-section">
          <div className="qz-section-head">
            <div>
              <p className="qz-eyebrow">Weitermachen</p>
              <h2 className="qz-h2">Angefangene Quizzes</h2>
            </div>
            {saves.length > 4 && <Link href="/geo" className="qz-btn ghost sm">Alle ansehen <QuizIcon name="next" size={14} /></Link>}
          </div>
          <div className="qz-weiter-grid">
            {saves.slice(0, 4).map(s => {
              const p = saveProgress(s)
              const pct = p.total ? Math.round((p.done / p.total) * 100) : 0
              const href = s.href + (s.href.includes('?') ? '&' : '?') + 'weiter=1'
              return (
                <Link key={s.slug} href={href} className="qz-weiter">
                  <Ring pct={pct} size={58} stroke={6}><b className="qz-weiter-pct">{pct}<small>%</small></b></Ring>
                  <div className="qz-weiter-text">
                    <b className="qz-weiter-title" title={s.title}>{s.title}</b>
                    <small className="qz-muted">{MODUS[s.mode] ?? s.mode} · {p.done} von {p.total}</small>
                    <span className="qz-weiter-meta">
                      <span className={`qz-treffer ${p.accuracy >= 80 ? 'gut' : p.accuracy >= 50 ? 'mittel' : 'schlecht'}`}>{p.accuracy} % richtig</span>
                      <small className="qz-muted">{wann(s.savedAt, jetzt)}</small>
                    </span>
                  </div>
                  <span className="qz-weiter-play" aria-label="Fortsetzen"><QuizIcon name="play" size={14} /></span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Neu freigeschaltet ── */}
      <section className="qz-section">
        <div className="qz-section-head">
          <div>
            <p className="qz-eyebrow">Frisch dabei</p>
            <h2 className="qz-h2">Neu freigeschaltet</h2>
          </div>
          <Link href="/geo/updates" className="qz-btn ghost sm">Alle Updates <QuizIcon name="next" size={14} /></Link>
        </div>
        <div className="qz-neu-grid">
          {!daten && !fehler && [0, 1, 2].map(i => <div key={i} className="qz-skeleton" style={{ height: 150 }} />)}
          {daten && daten.neu.length === 0 && <p className="qz-muted qz-leer">Noch nichts freigeschaltet.</p>}
          {daten?.neu.map(q => (
            <Link key={q.slug} href={q.href} className="qz-neu-karte" style={{ '--qz-kat': q.farbe } as React.CSSProperties}>
              <div className="qz-neu-bild">
                {q.karte && (
                  <svg viewBox={`0 0 ${q.karte.w} ${q.karte.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                    <path d={q.karte.land} className="qz-karte-land" />
                    <path d={q.karte.fokus} className="qz-karte-fokus" />
                  </svg>
                )}
                <span className="qz-neu-bereich"><span className="qz-dot" /> {q.bereich}</span>
                {q.frisch && <span className="qz-neu-tag">Neu</span>}
              </div>
              <div className="qz-neu-body">
                <b className="qz-neu-titel">{q.titel}</b>
                <small className="qz-muted">{q.meta}</small>
              </div>
              <div className="qz-neu-fuss">
                <span className="qz-muted">{q.at ? wann(q.at, jetzt) : ''}</span>
                <span className="qz-go">Spielen <QuizIcon name="play" size={11} /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Demnächst + Rangliste ── */}
      <section className="qz-section qz-split">
        <div>
          <div className="qz-section-head">
            <div>
              <p className="qz-eyebrow">Kalender</p>
              <h2 className="qz-h2">Demnächst</h2>
            </div>
          </div>
          <div className="qz-card qz-zeitleiste">
            {!daten && !fehler && [0, 1, 2].map(i => <div key={i} className="qz-skeleton" style={{ height: 58, margin: '8px 0' }} />)}
            {daten && daten.bald.length === 0 && <p className="qz-muted qz-leer">Gerade ist nichts geplant.</p>}
            {daten?.bald.map(q => {
              const d = new Date(q.at!)
              return (
                <div key={q.slug} className="qz-zl-eintrag" style={{ '--qz-kat': q.farbe } as React.CSSProperties}>
                  <div className="qz-zl-datum">
                    <small>{d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}</small>
                    <b>{d.getDate()}</b>
                    <small>{d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}</small>
                  </div>
                  <div className="qz-zl-text">
                    <b>{q.titel}</b>
                    <small className="qz-muted">{q.bereich} · {q.meta}</small>
                  </div>
                  <span className="qz-zl-wann">{wann(q.at!, jetzt)}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div className="qz-section-head">
            <div>
              <p className="qz-eyebrow">Wer vorne liegt</p>
              <h2 className="qz-h2">Rangliste</h2>
            </div>
            <Link href="/geo/rangliste" className="qz-btn ghost sm">Ganze Liste <QuizIcon name="next" size={14} /></Link>
          </div>
          <div className="qz-card qz-rangliste">
            {!daten && !fehler && <div className="qz-skeleton" style={{ height: 240 }} />}
            {daten && !daten.ranglisten && <p className="qz-muted qz-leer">Die Rangliste ist gerade ausgeschaltet.</p>}
            {daten?.ranglisten && daten.top.length === 0 && <p className="qz-muted qz-leer">Noch niemand in der Rangliste.</p>}
            {podest.length > 0 && (
              <div className="qz-podest">
                {[podest[1], podest[0], podest[2]].map(r => r && (
                  <Link key={r.username} href={`/${r.username}`} className={`qz-podest-platz p${r.platz} ${r.ich ? 'ich' : ''}`}>
                    <img src={kopf(r.username, 64)} alt="" className="qz-podest-kopf" width={r.platz === 1 ? 52 : 42} height={r.platz === 1 ? 52 : 42} />
                    <b className="qz-podest-name" title={r.name}>{r.name}</b>
                    <small className="qz-muted">{zahl(r.xp)} XP</small>
                    <span className="qz-level sm">Lv {r.level}</span>
                    <div className="qz-podest-sockel"><span>{r.platz}</span></div>
                  </Link>
                ))}
              </div>
            )}
            {restListe.map(r => (
              <Link key={r.username} href={`/${r.username}`} className={`qz-rang-zeile ${r.ich ? 'ich' : ''}`}>
                <span className="qz-rang-nr">{r.platz}</span>
                <img src={kopf(r.username, 32)} alt="" className="qz-rang-kopf" width={28} height={28} />
                <b className="qz-rang-name">{r.name}{r.ich && <span className="qz-du">Du</span>}</b>
                <small className="qz-muted">{zahl(r.xp)} XP</small>
                <span className="qz-level sm">Lv {r.level}</span>
              </Link>
            ))}
            {ich && ich.platz && ich.platz > (daten?.top.length ?? 0) && (
              <div className="qz-rang-zeile ich">
                <span className="qz-rang-nr">{zahl(ich.platz)}</span>
                <img src={kopf(ich.username, 32)} alt="" className="qz-rang-kopf" width={28} height={28} />
                <b className="qz-rang-name">{ich.name}<span className="qz-du">Du</span></b>
                <small className="qz-muted">{zahl(ich.xp)} XP</small>
                <span className="qz-level sm">Lv {ich.level}</span>
              </div>
            )}
          </div>
          <p className="qz-muted qz-fuss">Zählt zurzeit die XP aus Geografie.</p>
        </div>
      </section>

      {/* ── Beliebt ── */}
      {daten && daten.beliebt.length > 0 && (
        <section className="qz-section">
          <div className="qz-section-head">
            <div>
              <p className="qz-eyebrow">Was alle spielen</p>
              <h2 className="qz-h2"><QuizIcon name="fire" size={20} style={{ verticalAlign: '-2px', color: 'var(--qz-hot)' }} /> Beliebt</h2>
            </div>
          </div>
          <div className="qz-beliebt">
            {daten.beliebt.map((q, i) => (
              <Link key={q.slug} href={q.href} className="qz-beliebt-zeile" style={{ '--qz-kat': q.farbe } as React.CSSProperties}>
                <span className="qz-beliebt-nr">{String(i + 1).padStart(2, '0')}</span>
                <span className="qz-beliebt-text">
                  <b>{q.titel}</b>
                  <small className="qz-muted"><span className="qz-dot" /> {q.bereich} · {q.meta}</small>
                </span>
                <span className="qz-beliebt-go"><QuizIcon name="next" size={16} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}