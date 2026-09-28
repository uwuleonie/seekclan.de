'use client'

// Werkzeuge: Bildbearbeitung, Farbwähler, Taschenrechner, Einheiten, Währungen, Passwörter.
// Der gewählte Reiter steht in der Adresse (?t=bild), damit man direkt hinspringen kann.

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Icon from '../_components/Icon'
import ImageTool from './_tools/ImageTool'
import ColorTool from './_tools/ColorTool'
import CalcTool from './_tools/CalcTool'
import UnitTool from './_tools/UnitTool'
import CurrencyTool from './_tools/CurrencyTool'
import PasswordTool from './_tools/PasswordTool'

const TOOLS = [
  { key: 'bild', label: 'Bild', title: 'Bildbearbeitung', icon: 'image', C: ImageTool },
  { key: 'farbe', label: 'Farbe', title: 'Farbwähler', icon: 'palette', C: ColorTool },
  { key: 'rechner', label: 'Rechner', title: 'Taschenrechner', icon: 'calculator', C: CalcTool },
  { key: 'einheiten', label: 'Einheiten', title: 'Einheitenrechner', icon: 'ruler', C: UnitTool },
  { key: 'waehrung', label: 'Währung', title: 'Währungsrechner', icon: 'currency', C: CurrencyTool },
  { key: 'passwort', label: 'Passwort', title: 'Passwortgenerator', icon: 'key', C: PasswordTool },
] as const

function ToolsInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const [active, setActive] = useState<string>(sp.get('t') ?? 'bild')
  useEffect(() => { const t = sp.get('t'); if (t && TOOLS.some(x => x.key === t)) setActive(t) }, [sp])

  const tool = TOOLS.find(t => t.key === active) ?? TOOLS[0]
  // Schon geöffnete Werkzeuge bleiben im Hintergrund bestehen (z.B. halb bearbeitetes Bild)
  const [visited, setVisited] = useState<string[]>([])
  useEffect(() => { setVisited(v => (v.includes(tool.key) ? v : [...v, tool.key])) }, [tool.key])
  const choose = (k: string) => { setActive(k); router.replace(`/private/tools?t=${k}`, { scroll: false }) }

  return (
    <div className="pv-page">
      <div className="pv-page-head">
        <div>
          <p className="pv-eyebrow">Werkzeuge</p>
          <h1 className="pv-title">{tool.title}</h1>
        </div>
      </div>
      <div className="pv-tool-tabs" role="tablist">
        {TOOLS.map(t => (
          <button key={t.key} role="tab" aria-selected={t.key === tool.key} className={t.key === tool.key ? 'active' : ''} onClick={() => choose(t.key)}>
            <Icon name={t.icon} size={19} /><span>{t.label}</span>
          </button>
        ))}
      </div>
      {TOOLS.filter(t => visited.includes(t.key) || t.key === tool.key).map(t => (
        <div key={t.key} style={{ display: t.key === tool.key ? 'block' : 'none' }}>
          <t.C />
        </div>
      ))}
    </div>
  )
}

export default function ToolsPage() {
  return (
    <Suspense fallback={<div className="pv-center"><div className="pv-spinner" /></div>}>
      <ToolsInner />
    </Suspense>
  )
}