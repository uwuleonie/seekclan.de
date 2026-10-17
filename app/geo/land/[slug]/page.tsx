import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import LandView from './LandView'
import { LAENDER } from '../../_data/land'
import { gliederungen, loadLandDaten, quizzesMitLand } from '@/app/lib/geo-land'
import { hlLandWerte } from '@/app/lib/geo-hl'

// Länderseite /geo/land/<slug> – Daten aus public/geo/land/<ISO3>.json und den Higher-Lower-Werten (mit Korrekturen
// aus dem Adminpanel, deshalb alle 10 Minuten neu gebaut).
export const revalidate = 600

export function generateStaticParams() {
  return LAENDER.map(([slug]) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const l = LAENDER.find(x => x[0] === slug)
  if (!l) return { title: 'Land' }
  return { title: `${l[2]} – Länderprofil`, description: `${l[2]}: Hauptstadt, Einwohner, Nachbarländer, Wirtschaft mit Diagrammen, alle Zahlen, GeoGuessr-Hinweise und alle Quizzes.` }
}

export default async function LandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const l = LAENDER.find(x => x[0] === slug)
  if (!l) notFound()
  const land = loadLandDaten(l[1])
  if (!land) notFound()
  const hl = await hlLandWerte(land.iso, land.nachbarn.map(n => n.iso))
  return <LandView land={land} hl={hl} quizzes={quizzesMitLand(land.iso)} gliederungen={gliederungen(land)} />
}
