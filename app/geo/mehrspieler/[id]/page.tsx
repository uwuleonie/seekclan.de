import type { Metadata } from 'next'
import RoomView from './RoomView'

// /geo/mehrspieler/<id> – gemeinsam ein Quiz spielen (Einladungslink)
export const metadata: Metadata = { title: 'Mehrspieler', description: 'Spiel mit – gemeinsam ein Geo-Quiz auf seekclan.de.' }

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RoomView id={id} />
}