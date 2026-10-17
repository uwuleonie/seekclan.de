'use client'

// Leiste über einem Länder-Quiz: Land wechseln (springt zum gleichen Quiz-Typ im anderen Land, z.B. Städte → Städte)
// und die anderen Quizzes desselben Landes als Abkürzung.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Flag from './Flag'
import Icon from './Icon'
import { useGeo } from './GeoShell'
import { ISO2 } from '../_data/welt-extra'
import { LAENDER } from '../_data/land'
import { BEREICHE } from '../_content/welt'
import { KIND_LABEL, belongsTo, countryName } from '../_lib/catalog'
import { themaOf } from './LaenderWahl'
import type { Bereich, CatalogEntry } from '../_lib/types'

export default function LandLeiste({ entry }: { entry: CatalogEntry }) {
  const { status, catalog } = useGeo()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Bereich>(entry.bereich === 'welt' ? 'europa' : entry.bereich)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])

  const country = entry.country!
  const visible = (e: CatalogEntry) => !e.planned && status(e).open

  // Andere Quizzes dieses Landes
  const all = useMemo(() => catalog.filter(e => e.country === country && visible(e)), [country, status, catalog]) // eslint-disable-line react-hooks/exhaustive-deps
  const siblings = all.filter(e => themaOf(e.kind) === themaOf(entry.kind))
  const home = entry.bereich === 'welt' ? 'europa' : entry.bereich
  const profil = LAENDER.find(l => l[1] === country)?.[0]

  // Länder je Kontinent mit dem passenden Quiz (gleiche Art, sonst gleiches Thema)
  const lands = useMemo(() => {
    const byCountry = new Map<string, CatalogEntry[]>()
    for (const e of catalog) {
      if (!e.country || !visible(e) || !belongsTo(e, tab)) continue
      if (!byCountry.has(e.country)) byCountry.set(e.country, [])
      byCountry.get(e.country)!.push(e)
    }
    return [...byCountry.entries()].map(([id, es]) => {
      const same = es.find(e => e.kind === entry.kind) ?? es.find(e => themaOf(e.kind) === themaOf(entry.kind))
      return { id, name: countryName(id), href: same ? `/geo/quiz/${same.slug}` : `/geo/${tab}#land-${id}`, match: !!same, title: same?.title }
    }).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  }, [tab, entry.kind, catalog]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ga-ll">
      <div className="ga-ll-land" ref={box}>
        <button type="button" className="ga-ll-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {ISO2[country] && <Flag code={ISO2[country]} size="sm" />}
          {countryName(country)}
          <Icon name="next" size={14} style={{ transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .15s' }} />
        </button>
        {open && (
          <div className="ga-ll-pop" role="dialog" aria-label="Land wechseln">
            <div className="ga-ll-tabs">
              {BEREICHE.filter(b => b.key !== 'welt' && b.key !== 'sprachen').map(b => (
                <button key={b.key} type="button" className={`ga-chip sm ${tab === b.key ? 'active' : ''}`} onClick={() => setTab(b.key)}>{b.name}</button>
              ))}
            </div>
            <div className="ga-ll-grid">
              {lands.map(l => (
                <Link key={l.id} href={l.href} className={`${l.id === country ? 'active' : ''} ${l.match ? '' : 'none'}`} title={l.title ?? 'Zur Länder-Seite'} onClick={() => setOpen(false)}>
                  {ISO2[l.id] && <Flag code={ISO2[l.id]} size="sm" />}
                  <span>{l.name}</span>
                </Link>
              ))}
              {!lands.length && <p className="ga-muted" style={{ fontSize: 13 }}>Hier gibt es noch keine Länder-Quizzes.</p>}
            </div>
            <p className="ga-ll-hint">Springt zum gleichen Quiz-Typ ({KIND_LABEL[entry.kind]}) im anderen Land – blasse Länder haben ihn noch nicht.</p>
          </div>
        )}
      </div>
      <div className="ga-ll-sib">
        {siblings.length > 1 && siblings.map(e => (
          <Link key={e.slug} href={`/geo/quiz/${e.slug}`} className={`ga-chip sm ${e.slug === entry.slug ? 'active' : ''}`}>
            {e.title.includes(' – ') ? e.title.split(' – ').slice(1).join(' – ') : e.title}
          </Link>
        ))}
        {all.length > siblings.length && (
          <Link href={`/geo/${home}#land-${country}`} className="ga-chip sm">Alle {all.length} Quizzes</Link>
        )}
        {profil && <Link href={`/geo/land/${profil}`} className="ga-chip sm"><Icon name="globe" size={13} /> Länderprofil</Link>}
      </div>
    </div>
  )
}
