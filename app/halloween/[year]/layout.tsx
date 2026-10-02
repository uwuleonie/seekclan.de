import type { Metadata } from 'next'

// Titel der Halloween-Seite (die Seite selbst ist eine Client-Seite und kann keinen Titel setzen)
export async function generateMetadata({ params }: { params: Promise<{ year: string }> }): Promise<Metadata> {
  const { year } = await params
  const y = /^\d{4}$/.test(year) ? year : ''
  return {
    title: `Halloween ${y}`.trim(),
    description: 'Finde die versteckten Kürbisse auf seekclan.de, beantworte die Quizfragen und tausche deine Süßigkeiten im Shop ein.',
  }
}

export default function HalloweenYearLayout({ children }: { children: React.ReactNode }) {
  return children
}