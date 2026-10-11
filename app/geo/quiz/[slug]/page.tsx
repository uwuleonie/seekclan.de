import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import QuizView from './QuizView'
import { CATALOG_BY_SLUG } from '../../_lib/catalog'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (slug === 'mix') return { title: 'Eigener Mix' }
  return { title: CATALOG_BY_SLUG[slug]?.title ?? 'Quiz' }
}

// /geo/quiz/<slug>  – ein Quiz
// /geo/quiz/mix?q=a,b,c – mehrere Quizzes kombiniert (aus dem Baukasten)
export default async function QuizPage({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const { slug } = await params
  const sp = await searchParams
  if (slug === 'mix') {
    const raw = Array.isArray(sp.q) ? sp.q.join(',') : sp.q ?? ''
    const slugs = [...new Set(raw.split(',').map(s => s.trim()).filter(s => CATALOG_BY_SLUG[s]))].slice(0, 12)
    if (!slugs.length) notFound()
    return <QuizView slugs={slugs} />
  }
  if (!CATALOG_BY_SLUG[slug]) notFound()
  return <QuizView slugs={[slug]} />
}
