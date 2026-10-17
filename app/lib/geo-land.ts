import fs from 'node:fs'
import path from 'node:path'
import { geoArea } from 'd3-geo'
import { CATALOG, isBuilt } from '@/app/geo/_lib/catalog'
import { itemIsos } from '@/app/geo/_lib/gg'
import type { GeoItem } from '@/app/geo/_lib/types'
import type { Gliederung, LandDaten } from '@/app/geo/_lib/land'

// Länderseiten von seekclan.de/geo (/geo/land/<slug>) – Daten auf dem Server laden.
// Länderdaten: public/geo/land/<ISO3>.json (erzeugt von scripts/geo/build-laenderseiten.mjs)

const PUB = path.join(process.cwd(), 'public')

export function loadLandDaten(iso: string): LandDaten | null {
  try { return JSON.parse(fs.readFileSync(path.join(PUB, 'geo/land', `${iso}.json`), 'utf8')) } catch { return null }
}

/**
 * Welche Quizzes enthalten welches Land? ISO3 → slugs. Einmal je Server-Prozess berechnet:
 * Einträge direkt im Quiz oder in public/geo/items/<itemsFile>.json, Land über iso, Fläche „world:XXX“ oder Schlüssel „…:XXX“.
 * GG-Editionen zählen über ihr Quell-Quiz.
 */
let index: Map<string, string[]> | null = null
export function quizzesMitLand(iso: string): string[] {
  if (!index) {
    index = new Map()
    const dateien = new Map<string, Record<string, GeoItem[]>>()
    const datei = (f: string) => {
      if (!dateien.has(f)) {
        try { dateien.set(f, JSON.parse(fs.readFileSync(path.join(PUB, 'geo/items', `${f}.json`), 'utf8'))) } catch { dateien.set(f, {}) }
      }
      return dateien.get(f)!
    }
    const isosVon = new Map<string, Set<string>>()
    for (const e of CATALOG) {
      if (!isBuilt(e) || e.special) continue
      const items = e.items.length ? e.items : e.itemsFile ? (datei(e.itemsFile)[e.slug] ?? []) : []
      const set = new Set<string>()
      for (const it of items) for (const i of itemIsos(it)) set.add(i)
      isosVon.set(e.slug, set)
    }
    for (const e of CATALOG) {
      if (!isBuilt(e)) continue
      let set = isosVon.get(e.slug)
      if (e.ggQuelle) set = isosVon.get(e.ggQuelle.slug)
      if (e.country) (set = new Set(set)).add(e.country)
      for (const i of set ?? []) {
        if (!index.has(i)) index.set(i, [])
        index.get(i)!.push(e.slug)
      }
    }
  }
  return index.get(iso) ?? []
}

/* ───────────── Gliederungen für die Karte (Bundesländer, Provinzen, Kreise …) ───────────── */

const ebenen = new Map<string, { f: { i: string; g: GeoJSON.Geometry }[] } | null>()
function ebene(id: string) {
  if (!ebenen.has(id)) {
    try { ebenen.set(id, JSON.parse(fs.readFileSync(path.join(PUB, 'geo/layers', `${id}.json`), 'utf8'))) } catch { ebenen.set(id, null) }
  }
  return ebenen.get(id)!
}
/** Fläche in Steradiant – falsch herum gewickelte Polygone zählen als Rest der Erde, das wird korrigiert */
const flaeche = (g: GeoJSON.Geometry) => { const a = geoArea(g as GeoJSON.GeometryObject); return a > 2 * Math.PI ? 4 * Math.PI - a : a }

/**
 * Gliederungen eines Landes: alle Regionen-Quizzes des Landes, deren Flächen das ganze Land abdecken (mindestens 80 % –
 * so fallen z. B. die Bezirke Bayerns bei Deutschland weg), grob → fein. Gibt es keine, dann Natural Earth admin_1.
 */
export function gliederungen(land: LandDaten): Gliederung[] {
  const world = ebene('world')
  const geo = world?.f.find(x => x.i === land.iso)?.g
  const landFl = geo ? flaeche(geo) : 0
  const out: Gliederung[] = []
  const genutzt = new Set<string>()
  const dateien = new Map<string, Record<string, GeoItem[]>>()
  for (const e of CATALOG) {
    if (!isBuilt(e) || e.country !== land.iso || e.kind !== 'regionen' || e.special) continue
    let items = e.items
    if (!items.length && e.itemsFile) {
      if (!dateien.has(e.itemsFile)) {
        try { dateien.set(e.itemsFile, JSON.parse(fs.readFileSync(path.join(PUB, 'geo/items', `${e.itemsFile}.json`), 'utf8'))) } catch { dateien.set(e.itemsFile, {}) }
      }
      items = dateien.get(e.itemsFile)![e.slug] ?? []
    }
    // Flächen je Ebene
    const jeEbene = new Map<string, Record<string, string>>()
    for (const it of items) for (const a of it.areas ?? []) {
      const [l, id] = a.split(':')
      if (!l || !id || l === 'world') continue
      if (!jeEbene.has(l)) jeEbene.set(l, {})
      jeEbene.get(l)![id] = it.label
    }
    for (const [l, namen] of jeEbene) {
      if (genutzt.has(l)) continue
      const lay = ebene(l)
      if (!lay) continue
      const ids = new Set(Object.keys(namen))
      const fl = lay.f.filter(x => ids.has(x.i)).reduce((s, x) => s + flaeche(x.g), 0)
      if (landFl && (fl < landFl * 0.8 || fl > landFl * 1.5)) continue
      genutzt.add(l)
      out.push({ titel: e.itemsNoun, anzahl: ids.size, url: `/geo/layers/${l}.json`, ids: [...ids], namen, quiz: e.slug, quelle: 'atlas' })
    }
  }
  if (!out.length && land.adm1) {
    out.push({ titel: land.adm1.titel, anzahl: land.adm1.anzahl, url: `/geo/land/adm1/${land.iso}.json`, ids: null, namen: {}, quiz: null, quelle: 'natural-earth' })
  }
  return out.sort((a, b) => a.anzahl - b.anzahl)
}
