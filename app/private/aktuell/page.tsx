'use client'

// Aktuell: Nachrichten (tagesschau.de + tägliche Claude-Zusammenfassung) und Sport

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Icon from '../_components/Icon'
import News from './_News'
import Sport from './_Sport'

function Inner() {
  const sp = useSearchParams()
  const router = useRouter()
  const [tab, setTab] = useState<'news' | 'sport'>(sp.get('t') === 'sport' ? 'sport' : 'news')
  useEffect(() => { setTab(sp.get('t') === 'sport' ? 'sport' : 'news') }, [sp])
  const choose = (t: 'news' | 'sport') => { setTab(t); router.replace(`/private/aktuell${t === 'sport' ? '?t=sport' : ''}`, { scroll: false }) }

  return (
    <div className="pv-page">
      <div className="pv-page-head">
        <div>
          <p className="pv-eyebrow">{new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="pv-title">{tab === 'news' ? 'Nachrichten' : 'Sport'}</h1>
        </div>
        <div className="pv-seg">
          <button className={tab === 'news' ? 'active' : ''} onClick={() => choose('news')}><Icon name="globe" size={16} /> Nachrichten</button>
          <button className={tab === 'sport' ? 'active' : ''} onClick={() => choose('sport')}><Icon name="flag" size={16} /> Sport</button>
        </div>
      </div>
      <div style={{ display: tab === 'news' ? 'block' : 'none' }}><News /></div>
      {tab === 'sport' && <Sport />}
    </div>
  )
}

export default function AktuellPage() {
  return (
    <Suspense fallback={<div className="pv-center"><div className="pv-spinner" /></div>}>
      <Inner />
    </Suspense>
  )
}