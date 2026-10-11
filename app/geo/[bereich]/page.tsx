import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BereichView from './BereichView'
import { BEREICHE } from '../_content/welt'
import type { Bereich } from '../_lib/types'

const KEYS = BEREICHE.map(b => b.key) as string[]

export function generateStaticParams() {
  return KEYS.map(bereich => ({ bereich }))
}

export async function generateMetadata({ params }: { params: Promise<{ bereich: string }> }): Promise<Metadata> {
  const { bereich } = await params
  const b = BEREICHE.find(x => x.key === bereich)
  return { title: b ? b.name : 'Geo' }
}

export default async function BereichPage({ params }: { params: Promise<{ bereich: string }> }) {
  const { bereich } = await params
  if (!KEYS.includes(bereich)) notFound()
  return <BereichView bereich={bereich as Bereich} />
}
