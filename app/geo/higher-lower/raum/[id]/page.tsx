import type { Metadata } from 'next'
import RaumView from './RaumView'
import '../../hl.css'

// seekclan.de/geo/higher-lower/raum/<id> – Higher Lower mit Freunden (Duell oder Team), per Einladungslink

export const metadata: Metadata = {
  title: 'Higher Lower – Mehrspieler',
  description: 'Higher Lower mit Freunden: im Duell gegeneinander oder als Team miteinander.',
}

export default async function RaumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RaumView id={id} />
}