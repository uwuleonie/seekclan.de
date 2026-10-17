import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SteckbriefView from '../../geoguessr/[land]/SteckbriefView'
import { GG_AF_LAENDER } from '../../_data/gg-af'

export function generateStaticParams() {
  return GG_AF_LAENDER.map(([land]) => ({ land }))
}

export async function generateMetadata({ params }: { params: Promise<{ land: string }> }): Promise<Metadata> {
  const { land } = await params
  const l = GG_AF_LAENDER.find(x => x[0] === land)
  return { title: l ? `${l[1]} – GeoGuessr` : 'GeoGuessr', description: l ? `Woran erkennst du ${l[1]} bei GeoGuessr? Linien, Kennzeichen, Google-Auto, Landschaft und mehr.` : undefined }
}

export default async function SteckbriefAfrikaPage({ params }: { params: Promise<{ land: string }> }) {
  const { land } = await params
  if (!GG_AF_LAENDER.some(x => x[0] === land)) notFound()
  return <SteckbriefView slug={land} region="afrika" />
}