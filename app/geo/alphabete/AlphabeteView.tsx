'use client'

// Alle Alphabete: jede Schrift aus „Sprachen & Schriften“ als Tabelle zum Anhören (ein Ton pro Buchstabe)
// und „Ein Laut in allen Schriften“: derselbe Laut (z.B. sch) nebeneinander in Kyrillisch, Griechisch, Georgisch …
// Daten: public/geo/items/schriften.json (dieselben Karten wie in den Lernkarten). Gezeigt werden nur Schriften, deren Quiz schon offen ist.
// Laute: Aufnahmen der Lautschrift (IPA) von Wikimedia Commons, freie Lizenzen – in public/geo/audio/laute/.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useGeo } from '../_components/GeoShell'
import Icon from '../_components/Icon'
import { playSounds, stopAudio } from '../_lib/audio'

interface Card { key: string; c: string; a: string; n?: string; g: string; snd?: string[] }
interface Meta { kind: string; groups: { k: string; name: string; text?: string }[]; font?: string; dir?: string; big?: boolean }

/** Schriften in dieser Reihenfolge (nur Buchstaben-Decks) */
const SCRIPTS: [string, string][] = [
  ['kyrillisch', 'Kyrillisch'], ['griechisch', 'Griechisch'], ['georgisch', 'Georgisch'], ['armenisch', 'Armenisch'],
  ['hebraeisch', 'Hebräisch'], ['arabisch', 'Arabisch'], ['thai', 'Thai'], ['hangul', 'Hangul'],
  ['hiragana', 'Hiragana'], ['katakana', 'Katakana'], ['inuktitut', 'Inuktitut'], ['hieroglyphen', 'Hieroglyphen'], ['zahlen', 'Zahlen'],
]

/** Lautschrift-Zeichen (IPA) zu den Tondateien – damit z.B. „sch“ [ʃ] und „sch“ [ʒ] unterscheidbar sind */
const IPA: Record<string, string> = {"alveolar-ejective-affricate": "tsʼ", "alveolar-ejective-plosive": "tʼ", "alveolar-lateral-approximant": "l", "alveolar-nasal": "n", "alveolar-tap": "ɾ", "alveolar-trill": "r", "bilabial-ejective-plosive": "pʼ", "bilabial-nasal": "m", "close-mid-back-rounded-vowel": "o", "close-mid-front-rounded-vowel": "ø", "close-mid-front-unrounded-vowel": "e", "close-back-rounded-vowel": "u", "close-back-unrounded-vowel": "ɯ", "close-central-unrounded-vowel": "ɨ", "close-front-rounded-vowel": "y", "close-front-unrounded-vowel": "i", "glottal-stop": "ʔ", "mid-central-vowel": "ə", "near-open-front-unrounded-vowel": "æ", "open-mid-back-rounded-vowel": "ɔ", "open-mid-back-unrounded-vowel": "ʌ", "open-mid-front-unrounded-vowel": "ɛ", "open-front-unrounded-vowel": "a", "palatal-approximant": "j", "palato-alveolar-ejective-affricate": "tʃʼ", "uvular-ejective-stop": "qʼ", "velar-ejective-plosive": "kʼ", "velar-nasal": "ŋ", "voiced-alveolar-affricate": "dz", "voiced-alveolar-plosive": "d", "voiced-alveolar-sibilant": "z", "voiced-bilabial-plosive": "b", "voiced-dental-fricative": "ð", "voiced-labio-velar-approximant": "w", "voiced-labiodental-fricative": "v", "voiced-palato-alveolar-affricate": "dʒ", "voiced-pharyngeal-fricative": "ʕ", "voiced-postalveolar-fricative": "ʒ", "voiced-uvular-fricative": "ʁ", "voiced-velar-fricative": "ɣ", "voiced-velar-plosive": "ɡ", "voiceless-alveolar-affricate": "ts", "voiceless-alveolar-plosive": "t", "voiceless-alveolar-sibilant": "s", "voiceless-alveolo-palatal-fricative": "ɕ", "voiceless-bilabial-plosive": "p", "voiceless-dental-fricative": "θ", "voiceless-glottal-fricative": "h", "voiceless-labiodental-fricative": "f", "voiceless-palatal-fricative": "ç", "voiceless-palato-alveolar-affricate": "tʃ", "voiceless-pharyngeal-fricative": "ħ", "voiceless-postalveolar-fricative": "ʃ", "voiceless-uvular-fricative": "χ", "voiceless-uvular-plosive": "q", "voiceless-velar-fricative": "x", "voiceless-velar-plosive": "k"}

export default function AlphabeteView() {
  const { bySlug, status, loaded } = useGeo()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<string>('alle')
  useEffect(() => {
    fetch('/geo/items/schriften.json').then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then(setData).catch(e => setError(String(e?.message || e)))
    return () => stopAudio()
  }, [])

  const scripts = useMemo(() => {
    if (!data) return []
    const meta = data._meta as Record<string, Meta>
    return SCRIPTS
      .filter(([slug]) => data[slug] && meta[slug] && bySlug[slug] && status(bySlug[slug]).open)
      .map(([slug, name]) => ({ slug, name, cards: data[slug] as Card[], meta: meta[slug] }))
  }, [data, bySlug, status])

  // Ein Laut in allen Schriften: nach Laut-Tonfolge gruppiert, nur Laute, die es in mindestens 3 Schriften gibt
  const sounds = useMemo(() => {
    const m = new Map<string, { snd: string[]; label: string; items: { script: string; slug: string; c: string; font?: string }[] }>()
    for (const s of scripts) {
      if (s.slug === 'zahlen' || s.slug === 'hieroglyphen') continue
      const seen = new Set<string>()
      for (const c of s.cards) {
        if (!c.snd?.length) continue
        const k = c.snd.join('+')
        if (seen.has(k)) continue
        seen.add(k)
        const e = m.get(k) ?? { snd: c.snd, label: c.a, items: [] }
        e.items.push({ script: s.name, slug: s.slug, c: c.c, font: s.meta.font })
        m.set(k, e)
      }
    }
    return [...m.values()].filter(e => new Set(e.items.map(i => i.slug)).size >= 3).sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label, 'de'))
  }, [scripts])

  const shown = tab === 'alle' ? scripts : scripts.filter(s => s.slug === tab)

  return (
    <div className="ga-page ga-abc">
      <div className="ga-no-print">
        <Link href="/geo/sprachen" className="ga-btn ghost sm" style={{ marginLeft: -10 }}><Icon name="back" size={15} /> Sprachen & Schriften</Link>
      </div>
      <p className="ga-eyebrow" style={{ marginTop: 8 }}>Nachschlagen</p>
      <h1 className="ga-title">Alle <span className="grad">Alphabete</span></h1>
      <p className="ga-lead">Jede Schrift auf einen Blick – tippe ein Zeichen an, um den Laut zu hören. Unten: derselbe Laut in allen Schriften nebeneinander.</p>

      <div className="ga-toolbar ga-no-print" style={{ marginTop: 14 }}>
        <div className="ga-chips">
          <button className={`ga-chip ${tab === 'alle' ? 'active' : ''}`} onClick={() => setTab('alle')}>Alle</button>
          {scripts.map(s => <button key={s.slug} className={`ga-chip ${tab === s.slug ? 'active' : ''}`} onClick={() => setTab(s.slug)}>{s.name}</button>)}
          <a href="#laute" className="ga-chip"><Icon name="ear" size={15} /> Ein Laut, alle Schriften</a>
          <button className="ga-chip" onClick={() => window.print()}><Icon name="copy" size={15} /> Drucken</button>
        </div>
      </div>

      {error ? <div className="ga-map-loading"><Icon name="info" /> Konnte nicht geladen werden ({error})</div>
        : !data || !loaded ? <div className="ga-map-loading">Lädt …</div>
        : !scripts.length ? <div className="ga-map-loading">Noch keine Schrift freigeschaltet.</div>
        : (
          <>
            {shown.map(s => (
              <section key={s.slug} className="ga-section ga-abc-script">
                <div className="ga-section-head">
                  <div>
                    <p className="ga-eyebrow">{s.cards.length} Zeichen</p>
                    <h2 className="ga-h2">{s.name}</h2>
                  </div>
                  <Link href={`/geo/quiz/${s.slug}`} className="ga-btn sm ga-no-print"><Icon name="play" size={14} /> Lernen & üben</Link>
                </div>
                {s.meta.groups.map(g => {
                  const cards = s.cards.filter(c => c.g === g.k)
                  if (!cards.length) return null
                  return (
                    <div key={g.k} className="ga-abc-group">
                      {s.meta.groups.length > 1 && <h3 className="ga-h3">{g.name}</h3>}
                      <div className="ga-abc-grid">
                        {cards.map(c => (
                          <button key={c.key} type="button" className="ga-abc-cell" disabled={!c.snd?.length} onClick={() => c.snd?.length && playSounds(c.snd)} title={c.n}>
                            <b dir={s.meta.dir ?? 'auto'} style={s.meta.font ? { fontFamily: `'${s.meta.font}', system-ui, sans-serif` } : undefined} className={s.meta.big ? 'big' : ''}>{c.c}</b>
                            <span>{c.a}</span>
                            {c.snd?.length ? <Icon name="volume" size={11} className="ga-abc-snd" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </section>
            ))}

            {sounds.length > 0 && (
              <section className="ga-section" id="laute" style={{ scrollMarginTop: 90 }}>
                <div className="ga-section-head">
                  <div>
                    <p className="ga-eyebrow">{sounds.length} Laute</p>
                    <h2 className="ga-h2">Ein Laut in allen Schriften</h2>
                  </div>
                  <span className="ga-muted" style={{ fontSize: 13 }}>Antippen zum Anhören</span>
                </div>
                <div className="ga-card ga-abc-table-wrap">
                  <table className="ga-abc-table">
                    <thead><tr><th>Laut</th>{scripts.filter(s => sounds.some(x => x.items.some(i => i.slug === s.slug))).map(s => <th key={s.slug}>{s.name}</th>)}</tr></thead>
                    <tbody>
                      {sounds.map(x => (
                        <tr key={x.snd.join('+')}>
                          <th>
                            <button type="button" className="ga-btn ghost xs" onClick={() => playSounds(x.snd)}><Icon name="volume" size={13} /> {x.label} <span className="ga-muted">[{x.snd.map(k => IPA[k] ?? '?').join('')}]</span></button>
                          </th>
                          {scripts.filter(s => sounds.some(y => y.items.some(i => i.slug === s.slug))).map(s => {
                            const it = x.items.filter(i => i.slug === s.slug)
                            return <td key={s.slug}>{it.map(i => <b key={i.c} style={i.font ? { fontFamily: `'${i.font}', system-ui, sans-serif` } : undefined}>{i.c}</b>)}</td>
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <p className="ga-muted" style={{ fontSize: 12, marginTop: 18 }}>
              Laute: Aufnahmen der internationalen Lautschrift (IPA) von Wikimedia Commons – CC BY-SA 3.0/4.0, eine gemeinfrei; für die Seite gekürzt und in MP3 umgewandelt.
              Urheber und Links: <a href="/geo/audio/laute/QUELLEN.txt" target="_blank" rel="noopener">Quellenliste</a>.
              Die Aufnahmen zeigen den Laut selbst – die echte Aussprache in einer Sprache kann leicht abweichen. Umschrift auf Deutsch.
            </p>
          </>
        )}
    </div>
  )
}