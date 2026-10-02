'use client'

// /halloween/2026 – Event-Seite mit Süßigkeiten-Shop
//  • Countdown vor dem Start, Restzeit während des Events
//  • eigener Stand (Süßigkeiten, gefundene Kürbisse), Shop, eigene Käufe, Rangliste
//  • Musik im Hintergrund (Schallplatte unten rechts, pausierbar) – Datei wird in /admin2/halloween hochgeladen
// Ist das Event beendet („Sofort beenden“), kommt nur ein Hinweis.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { spookyFont } from '@/app/lib/fonts'
import { BatArt, CandyArt, PumpkinArt, SpiderArt, WebArt } from '@/app/components/halloween/art'
import SpookyMusic from '@/app/components/halloween/SpookyMusic'
import '@/app/components/halloween/halloween.css'
import '../halloween-page.css'

type Item = { id: number; name: string; description: string; image: string | null; price: number; rewardType: 'manual' | 'mailbox'; left: number | null; perUserLimit: number | null; mine: number }
type Purchase = { id: number; name: string; price: number; status: 'offen' | 'erledigt' | 'zugestellt'; at: string }
type Me = { loggedIn: boolean; username: string; hasMinecraft: boolean; earned: number; spent: number; candies: number; found: number; total: number; purchases: Purchase[] }
type Data = {
  event: null | {
    slug: string; title: string; subtitle: string; accent: string; startsAt: string; endsAt: string; shopUntil: string
    running: boolean; shopOpen: boolean; preview: boolean; music: string | null
    candy: { find: number; easy: number; medium: number; hard: number }
  }
  items: Item[]
  me: Me | null
  leaderboard: { name: string; candies: number; found: number }[]
  stats: { players: number; pumpkins: number }
}

const STATUS_LABEL: Record<Purchase['status'], string> = { offen: 'Wird vom Team vergeben', erledigt: 'Erhalten', zugestellt: 'In deiner Ingame-Mailbox' }

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}
const fmtDate = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Countdown({ to, now }: { to: string; now: number }) {
  const p = parts(new Date(to).getTime() - now)
  const box = (v: number, l: string) => (
    <div className="hwp-cd-box"><b className={spookyFont.className}>{String(v).padStart(2, '0')}</b><span>{l}</span></div>
  )
  return <div className="hwp-cd">{box(p.d, 'Tage')}{box(p.h, 'Std')}{box(p.m, 'Min')}{box(p.s, 'Sek')}</div>
}

export default function HalloweenPage() {
  const params = useParams<{ year: string }>()
  const year = String(params?.year || '')
  const slug = `halloween-${year}`

  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [confirmItem, setConfirmItem] = useState<Item | null>(null)
  const [buying, setBuying] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/halloween/shop?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async r => {
        const d = await r.json().catch(() => ({ event: null }))
        if (!alive) return
        if (r.status >= 500) setError(d.error || 'Fehler beim Laden')
        else { setData(d); setError('') }
      })
      .catch(() => { if (alive) setError('Fehler beim Laden') })
    return () => { alive = false }
  }, [slug, reload])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    const r = setInterval(() => setReload(n => n + 1), 60000)
    return () => { clearInterval(t); clearInterval(r) }
  }, [])

  const buy = useCallback(async (item: Item) => {
    setBuying(true)
    const r = await fetch('/api/halloween/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, itemId: item.id }) })
    const d = await r.json().catch(() => ({}))
    setBuying(false)
    setConfirmItem(null)
    setMsg({ ok: r.ok, text: r.ok ? d.message : d.error || 'Kauf fehlgeschlagen' })
    setReload(n => n + 1)
  }, [slug])

  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 5000)
    return () => clearTimeout(t)
  }, [msg])

  const ev = data?.event
  const me = data?.me

  // Hintergrund (Mond, Fledermäuse, Nebel) – gleich für alle Zustände
  const scene = (
    <div className="hwp-scene" aria-hidden="true">
      <div className="hwp-stars" />
      <div className="hwp-moon" />
      {/* Spinnennetze in den Ecken, eine Spinne seilt sich ab */}
      <div className="hwp-web tl"><WebArt /></div>
      <div className="hwp-web tr"><WebArt size={190} /></div>
      <div className="hwp-web bl"><WebArt size={170} /></div>
      <div className="hwp-spider"><span className="hwp-spider-thread" /><SpiderArt size={30} color="#e9e2f5" /></div>
      <div className="hwp-bat b1"><BatArt size={46} /></div>
      <div className="hwp-bat b2"><BatArt size={30} /></div>
      <div className="hwp-bat b3"><BatArt size={38} /></div>
      <div className="hwp-fog f1" />
      <div className="hwp-fog f2" />
    </div>
  )

  if (!data && !error) {
    return <div className="hwp">{scene}<div className="hwp-wrap"><p className="hwp-loading">Lädt …</p></div></div>
  }

  if (error || !ev) {
    return (
      <div className="hwp">
        {scene}
        <div className="hwp-wrap hwp-gone">
          <PumpkinArt size={96} glow={false} />
          <h1 className={`hwp-title ${spookyFont.className}`}>Halloween {/^\d{4}$/.test(year) ? year : ''}</h1>
          <p className="hwp-sub">{error || 'Dieses Event ist gerade nicht verfügbar oder schon vorbei.'}</p>
          <Link href="/" className="hw-btn">Zur Startseite</Link>
        </div>
      </div>
    )
  }

  const start = new Date(ev.startsAt).getTime()
  const end = new Date(ev.endsAt).getTime()
  const shopEnd = new Date(ev.shopUntil).getTime()
  const before = now < start
  const canBuyNow = ev.shopOpen || ev.preview

  let statusLine: React.ReactNode
  if (before) statusLine = <>Die Kürbisjagd beginnt am <b>{fmtDate(ev.startsAt)}</b></>
  else if (now < end) statusLine = <>Die Kürbisse sind noch versteckt bis <b>{fmtDate(ev.endsAt)}</b></>
  else if (now < shopEnd) statusLine = <>Die Jagd ist vorbei – der Shop hat noch offen bis <b>{fmtDate(ev.shopUntil)}</b></>
  else statusLine = <>Das Event ist vorbei. Danke fürs Mitmachen!</>

  const buyBlock = (it: Item): string | null => {
    if (!canBuyNow) return before ? 'Ab Eventstart' : 'Shop geschlossen'
    if (!me) return 'Einloggen'
    if (it.left === 0) return 'Ausverkauft'
    if (it.perUserLimit != null && it.mine >= it.perUserLimit) return 'Limit erreicht'
    if (it.rewardType === 'mailbox' && !me.hasMinecraft) return 'Minecraft verknüpfen'
    if (me.candies < it.price) return `Noch ${it.price - me.candies} fehlen`
    return null
  }

  return (
    <div className="hwp" style={{ '--hwp-accent': ev.accent } as React.CSSProperties}>
      {scene}
      {ev.music && <SpookyMusic src={ev.music} />}

      <div className="hwp-wrap">
        {/* Kopf */}
        <header className="hwp-hero">
          <div className="hwp-hero-pumpkins" aria-hidden="true">
            <PumpkinArt size={54} /><PumpkinArt size={78} /><PumpkinArt size={54} />
          </div>
          <h1 className={`hwp-title ${spookyFont.className}`}>{ev.title}</h1>
          {ev.subtitle && <p className="hwp-sub">{ev.subtitle}</p>}
          {ev.preview && <p className="hwp-preview">Vorschau – nur Administrator/Owner sehen und testen das schon. Testdaten danach in /admin2/halloween löschen.</p>}
          <p className="hwp-status">{statusLine}</p>
          {before && <Countdown to={ev.startsAt} now={now} />}
          {!before && now < end && <Countdown to={ev.endsAt} now={now} />}
        </header>

        {/* Eigener Stand */}
        <section className="hwp-card hwp-me">
          {me ? (
            <>
              <div className="hwp-me-main">
                <CandyArt kind="wrap" color="#f43f5e" size={46} />
                <div>
                  <b className={`hwp-me-num ${spookyFont.className}`}>{me.candies}</b>
                  <span>Süßigkeiten</span>
                </div>
              </div>
              <div className="hwp-me-stats">
                <div><b>{me.found}</b><span>von {me.total} Kürbissen</span></div>
                <div><b>{me.earned}</b><span>gesammelt</span></div>
                <div><b>{me.spent}</b><span>ausgegeben</span></div>
              </div>
              <div className="hwp-progress" aria-label={`${me.found} von ${me.total} Kürbissen gefunden`}>
                <div style={{ width: `${me.total ? Math.min(100, (me.found / me.total) * 100) : 0}%` }} />
              </div>
            </>
          ) : (
            <div className="hwp-guest">
              <p>Melde dich an, um Kürbisse zu sammeln und Süßigkeiten auszugeben.</p>
              <Link href="/login" className="hw-btn">Einloggen</Link>
            </div>
          )}
        </section>

        {/* So funktioniert's */}
        <section className="hwp-how">
          <h2 className={spookyFont.className}>So funktioniert&apos;s</h2>
          <div className="hwp-how-grid">
            <div className="hwp-how-step"><PumpkinArt size={40} /><b>Kürbis finden</b><span>Überall auf seekclan.de sind {data.stats.pumpkins} Kürbisse versteckt.</span><em>+{ev.candy.find}</em></div>
            <div className="hwp-how-step"><span className="hwp-q easy">?</span><b>Einfache Frage</b><span>Richtig beantworten bringt extra.</span><em>+{ev.candy.easy}</em></div>
            <div className="hwp-how-step"><span className="hwp-q medium">?</span><b>Mittlere Frage</b><span>Etwas kniffliger.</span><em>+{ev.candy.medium}</em></div>
            <div className="hwp-how-step"><span className="hwp-q hard">?</span><b>Schwere Frage</b><span>Nur für echte Profis.</span><em>+{ev.candy.hard}</em></div>
          </div>
          <p className="hwp-how-note">Jede Frage hat einen Timer. Falsche Antwort, Zeit vorbei oder Tab gewechselt = keine Extra-Süßigkeiten (die fürs Finden bleiben).</p>
        </section>

        {/* Shop */}
        <section className="hwp-shop">
          <h2 className={spookyFont.className}>Süßigkeiten-Shop</h2>
          {data.items.length === 0 ? (
            <p className="hwp-empty">Der Shop wird gerade noch eingeräumt …</p>
          ) : (
            <div className="hwp-items">
              {data.items.map(it => {
                const block = buyBlock(it)
                return (
                  <article key={it.id} className="hwp-item">
                    <div className="hwp-item-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.image ? <img src={it.image} alt="" /> : <CandyArt kind="lolli" color="#a855f7" size={64} />}
                      {it.left !== null && <span className="hwp-item-left">{it.left === 0 ? 'Ausverkauft' : `Noch ${it.left}`}</span>}
                    </div>
                    <div className="hwp-item-body">
                      <h3>{it.name}</h3>
                      {it.description && <p>{it.description}</p>}
                      <span className="hwp-item-type">{it.rewardType === 'mailbox' ? 'Kommt sofort in deine Ingame-Mailbox' : 'Wird vom Team vergeben'}</span>
                      {it.perUserLimit != null && <span className="hwp-item-type">Max. {it.perUserLimit}× pro Spieler{it.mine ? ` · du hast ${it.mine}` : ''}</span>}
                    </div>
                    <div className="hwp-item-foot">
                      <span className="hwp-price"><CandyArt kind="wrap" color="#f43f5e" size={20} /><b>{it.price}</b></span>
                      {block === 'Einloggen'
                        ? <Link href="/login" className="hw-btn ghost">Einloggen</Link>
                        : block === 'Minecraft verknüpfen'
                        ? <Link href="/verify-account" className="hw-btn ghost">Minecraft verknüpfen</Link>
                        : <button type="button" className="hw-btn" disabled={!!block} onClick={() => setConfirmItem(it)}>{block || 'Kaufen'}</button>}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <div className="hwp-cols">
          {/* Eigene Käufe */}
          {me && (
            <section className="hwp-card">
              <h2 className={spookyFont.className}>Deine Käufe</h2>
              {me.purchases.length === 0 ? <p className="hwp-empty">Noch nichts gekauft.</p> : (
                <ul className="hwp-list">
                  {me.purchases.map(p => (
                    <li key={p.id}>
                      <span><b>{p.name}</b><small>{fmtDate(p.at)} · {p.price} Süßigkeiten</small></span>
                      <span className={`hwp-st ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Rangliste */}
          <section className="hwp-card">
            <h2 className={spookyFont.className}>Rangliste</h2>
            {data.leaderboard.length === 0 ? <p className="hwp-empty">Noch hat niemand einen Kürbis gefunden.</p> : (
              <ol className="hwp-list hwp-lb">
                {data.leaderboard.map((r, i) => (
                  <li key={i}>
                    <span className={`hwp-rank r${i + 1}`}>{i + 1}</span>
                    <span className="hwp-lb-name"><b>{r.name}</b><small>{r.found} Kürbisse</small></span>
                    <span className="hwp-price"><CandyArt kind="wrap" color="#f43f5e" size={16} /><b>{r.candies}</b></span>
                  </li>
                ))}
              </ol>
            )}
            <p className="hwp-how-note">{data.stats.players === 1 ? '1 Spieler ist' : `${data.stats.players} Spieler sind`} schon auf Kürbisjagd.</p>
          </section>
        </div>
      </div>

      {/* Kauf bestätigen */}
      {confirmItem && me && (
        <div className="hw-modal-bg" onClick={() => !buying && setConfirmItem(null)}>
          <div className="hw-modal small" onClick={e => e.stopPropagation()}>
            <CandyArt kind="wrap" color="#f43f5e" size={46} />
            <p className={`hw-modal-title ${spookyFont.className}`}>{confirmItem.name}</p>
            <p className="hw-modal-text">
              Für <b>{confirmItem.price}</b> Süßigkeiten kaufen? Danach hast du noch {me.candies - confirmItem.price}.
              <br />{confirmItem.rewardType === 'mailbox' ? 'Das Item kommt sofort in deine Ingame-Mailbox.' : 'Das Team gibt dir die Belohnung so bald wie möglich.'}
            </p>
            <div className="hw-row">
              <button type="button" className="hw-btn" disabled={buying} onClick={() => buy(confirmItem)}>{buying ? 'Kauft …' : 'Kaufen'}</button>
              <button type="button" className="hw-btn ghost" disabled={buying} onClick={() => setConfirmItem(null)}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {msg && <div className={`hw-toast ${msg.ok ? '' : 'err'}`} role="status">{msg.text}</div>}
    </div>
  )
}