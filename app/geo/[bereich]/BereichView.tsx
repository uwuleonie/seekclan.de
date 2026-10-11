'use client'

// Kontinent-/Welt-Seite: Quizzes für den ganzen Bereich und je Land

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useGeo } from '../_components/GeoShell'
import FlatWorld from '../_components/FlatWorld'
import QuizTile from '../_components/QuizTile'
import LaenderWahl from '../_components/LaenderWahl'
import Icon from '../_components/Icon'
import QuizSearch from '../_components/QuizSearch'
import PinButton from '../_components/PinButton'
import { belongsTo, countryName, groupSort, groupTitle, bySort } from '../_lib/catalog'
import { BEREICH_BY_KEY } from '../_content/welt'
import { isDue, readLocal, SAFE_BOX } from '../_lib/srs'
import type { Bereich, CatalogEntry } from '../_lib/types'

const LEAD: Record<Bereich, string> = {
  welt: 'Länder, Hauptstädte, Flaggen, Vorwahlen, Meere, Gebirge, Flüsse, Städte und Flughäfen – dazu Geschichte: Kolonien 1914, Weltwunder, alte Namen.',
  europa: 'Von Island bis zum Ural: Länder, Hauptstädte, Bundesländer, Regionen, Städte, Flüsse – und Geschichte.',
  asien: 'Vom Bosporus bis Japan: Länder, Hauptstädte, Sprachen, Präfekturen und Provinzen.',
  afrika: 'Alle 54 Staaten Afrikas mit ihren Hauptstädten – und Afrika 1914 als Kolonialkarte.',
  nordamerika: 'Von Alaska bis in die Karibik – Länder, Bundesstaaten und Hauptstädte.',
  suedamerika: 'Länder, Hauptstädte und Brasilien im Detail: Bundesstaaten und Telefon-Vorwahlen.',
  ozeanien: 'Australien, Neuseeland und die Inselstaaten im Pazifik.',
  sprachen: 'Kyrillisch, Griechisch, Georgisch, Arabisch, Thai, Hangul, Kana und mehr: Buchstaben lernen, Ortsnamen lesen und Länder an der Schrift erkennen – wie bei GeoGuessr.',
}

export default function BereichView({ bereich }: { bereich: Bereich }) {
  const { status, catalog, state, bereichName } = useGeo()
  const b = { ...BEREICH_BY_KEY[bereich], name: bereichName(bereich) }

  const { general, byCountry, all } = useMemo(() => {
    const list = catalog.filter(e => belongsTo(e, bereich))
    const general = list.filter(e => !e.country)
    const map = new Map<string, CatalogEntry[]>()
    for (const e of list.filter(e => e.country)) {
      const arr = map.get(e.country!) ?? []
      arr.push(e)
      map.set(e.country!, arr)
    }
    const byCountry = [...map.entries()]
      .map(([id, entries]) => ({ id, name: countryName(id), entries }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    return { general, byCountry, all: list }
  }, [bereich, catalog])

  const openOf = (es: CatalogEntry[]) => es.filter(e => status(e).open).length
  // Sortierung: offene Quizzes zuerst; innerhalb davon die Reihenfolge aus dem Adminpanel (catalog ist schon so sortiert)
  const sortEntries = (es: CatalogEntry[]) => [...es].sort((x, y) => Number(status(y).open) - Number(status(x).open))
  // Quizzes mit Abschnitt (z.B. "Flüsse & Seen") stehen zusammen – in der Reihenfolge, in der sie im Katalog stehen
  const sections = useMemo(() => {
    const out: { name: string | undefined; entries: CatalogEntry[] }[] = []
    for (const e of general) {
      let sec = out.find(s => s.name === e.section)
      if (!sec) { sec = { name: e.section, entries: [] }; out.push(sec) }
      sec.entries.push(e)
    }
    // Abschnitte: Reihenfolge und Namen aus dem Adminpanel
    return bySort(out, s => groupSort('section', `${bereich}/${s.name ?? ''}`, state))
      .map(s => ({ ...s, title: groupTitle('section', `${bereich}/${s.name ?? ''}`, state) ?? s.name }))
  }, [general, bereich, state])
  const countries = bySort(
    [...byCountry].sort((x, y) => (openOf(y.entries) > 0 ? 1 : 0) - (openOf(x.entries) > 0 ? 1 : 0) || x.name.localeCompare(y.name, 'de')),
    c => groupSort('country', c.id, state),
  ).map(c => ({ ...c, name: groupTitle('country', c.id, state) ?? c.name }))

  return (
    <div className="ga-page">
      <div className="ga-hero" style={{ alignItems: 'center' }}>
        <div>
          <Link href="/geo" className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> Atlas</Link>
          <p className="ga-eyebrow" style={{ marginTop: 8 }}>{bereich === 'welt' ? 'Ganze Erde' : bereich === 'sprachen' ? 'Themen-Bereich' : 'Kontinent'}</p>
          <h1 className="ga-title"><span className="grad">{b.name}</span> <PinButton kind="bereich" pinKey={bereich} label={b.name} /></h1>
          <p className="ga-lead">{LEAD[bereich]}</p>
          {bereich === 'europa' && (
            <div className="ga-row ga-wrap" style={{ marginTop: 16 }}>
              <Link href="/geo/geoguessr" className="ga-btn sm"><Icon name="compass" size={15} /> GeoGuessr Europa – Steckbriefe & Training</Link>
            </div>
          )}
          {bereich === 'sprachen' && (
            <div className="ga-row ga-wrap" style={{ marginTop: 16 }}>
              <Link href="/geo/alphabete" className="ga-btn sm"><Icon name="book" size={15} /> Alle Alphabete</Link>
              <Link href="/geo/quiz/meine-woerter" className="ga-btn ghost sm"><Icon name="star" size={15} /> Meine Wörter</Link>
            </div>
          )}
          {countries.length > 0 && (
            <a href="#laender" className="ga-btn ghost sm" style={{ marginTop: 16 }}>
              <Icon name="flag" size={15} /> {countries.length} Länder im Detail
            </a>
          )}
        </div>
        <div className="ga-map-wrap" style={{ padding: 0, background: 'transparent' }}>
          {bereich === 'sprachen' ? <SchriftMosaik /> : <FlatWorld focus={bereich} />}
        </div>
      </div>

      {(bereich === 'sprachen' || bereich === 'europa') && <LernkarteiUebersicht bereich={bereich} />}

      <QuizSearch entries={all} placeholder={`In ${b.name} suchen – Thema, Land, Stichwort …`}>
      {sections.map((sec, i) => (
        <section key={sec.name ?? 'alle'} className="ga-section">
          <div className="ga-section-head">
            <div>
              <p className="ga-eyebrow">{i === 0 && bereich !== 'sprachen' ? (bereich === 'welt' ? 'Weltweit' : 'Ganzer Kontinent') : `${sec.entries.length} Quizzes`}</p>
              <h2 className="ga-h2">{sec.title ?? (bereich === 'welt' ? 'Die ganze Welt' : `Ganz ${b.name}`)}</h2>
            </div>
            <span className="ga-row" style={{ gap: 8 }}>
              {sec.name && <span className="ga-muted" style={{ fontSize: 13 }}>{openOf(sec.entries)} von {sec.entries.length} offen</span>}
              <PinButton kind="section" pinKey={`${bereich}/${sec.name ?? ''}`} label={sec.title ?? 'Abschnitt'} />
            </span>
          </div>
          <div className="ga-tiles">{sortEntries(sec.entries).map(e => <QuizTile key={e.slug} entry={e} />)}</div>
        </section>
      ))}

      {countries.length > 0 && (
        <section className="ga-section" id="laender" style={{ scrollMarginTop: 90 }}>
          <div className="ga-section-head">
            <div>
              <p className="ga-eyebrow">Im Detail</p>
              <h2 className="ga-h2">Länder</h2>
            </div>
            <span className="ga-muted" style={{ fontSize: 13 }}>Land wählen – die Quizzes stehen rechts</span>
          </div>
          <LaenderWahl countries={countries} status={status} />
        </section>
      )}
      </QuizSearch>
    </div>
  )
}

/** Kopfbild für „Sprachen & Schriften“: Ortsnamen in vielen Schriften */
const MOSAIK: [string, string][] = [
  ['Москва', 'Moskau'], ['Αθήνα', 'Athen'], ['თბილისი', 'Tiflis'], ['Երևան', 'Jerewan'], ['ירושלים', 'Jerusalem'], ['القاهرة', 'Kairo'],
  ['กรุงเทพ', 'Bangkok'], ['서울', 'Seoul'], ['東京', 'Tokio'], ['臺北', 'Taipeh'], ['मुंबई', 'Mumbai'], ['ᐃᖃᓗᐃᑦ', 'Iqaluit'],
]
function SchriftMosaik() {
  return (
    <div className="ga-sc-mosaik" aria-hidden="true">
      {MOSAIK.map(([w, de]) => <span key={de}><b>{w}</b><small>{de}</small></span>)}
    </div>
  )
}

/** „Heute wiederholen“: fällige Karten aller Lernkarteien (Konto oder Browser) und die Merkliste */
function LernkarteiUebersicht({ bereich }: { bereich: Bereich }) {
  const { loggedIn, bySlug, status, words } = useGeo()
  const [decks, setDecks] = useState<Record<string, { due: number; safe: number; seen: number }> | null>(null)
  useEffect(() => {
    let alive = true
    if (loggedIn) {
      fetch('/api/geo/srs', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => { if (alive) setDecks(d?.decks ?? {}) }).catch(() => { if (alive) setDecks({}) })
    } else {
      const out: Record<string, { due: number; safe: number; seen: number }> = {}
      const now = Date.now()
      for (const [deck, cards] of Object.entries(readLocal())) {
        const list = Object.values(cards)
        out[deck] = { due: list.filter(c => isDue(c, now)).length, safe: list.filter(c => c.box >= SAFE_BOX).length, seen: list.length }
      }
      setDecks(out)
    }
    return () => { alive = false }
  }, [loggedIn])
  const rows = Object.entries(decks ?? {}).filter(([slug, d]) => d.seen > 0 && bySlug[slug] && bySlug[slug].bereich === bereich && status(bySlug[slug]).open).sort((a, b) => b[1].due - a[1].due)
  const showWords = bereich === 'sprachen' && words.length > 0
  if (!decks || (!rows.length && !showWords)) return null
  const dueTotal = rows.reduce((n, [, d]) => n + d.due, 0)
  return (
    <section className="ga-section">
      <div className="ga-section-head">
        <div>
          <p className="ga-eyebrow">Lernkartei</p>
          <h2 className="ga-h2">{dueTotal > 0 ? `Heute wiederholen: ${dueTotal} ${dueTotal === 1 ? 'Karte' : 'Karten'}` : 'Für heute alles wiederholt'}</h2>
        </div>
        <span className="ga-muted" style={{ fontSize: 13 }}>{loggedIn ? 'Aus deinem Konto' : 'Aus diesem Browser'}</span>
      </div>
      <div className="ga-srs-sum">
        {showWords && (
          <Link href="/geo/quiz/meine-woerter" className="ga-srs-row">
            <span><Icon name="star" size={14} /> Meine Wörter</span>
            <span className="ga-muted">{words.length} gemerkt{decks['meine-woerter']?.due ? <> · <span className="due">{decks['meine-woerter'].due} fällig</span></> : null}</span>
          </Link>
        )}
        {rows.filter(([slug]) => slug !== 'meine-woerter').map(([slug, d]) => (
          <Link key={slug} href={`/geo/quiz/${slug}`} className="ga-srs-row">
            <span>{bySlug[slug].title}</span>
            <span className="ga-muted">{d.due > 0 ? <span className="due">{d.due} fällig</span> : 'nichts fällig'} · {d.safe}/{d.seen} sicher</span>
          </Link>
        ))}
      </div>
    </section>
  )
}