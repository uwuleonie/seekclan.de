'use client'

// Rendert Dialoge/Vollbild-Ansichten direkt in die oberste Ebene des privaten Bereichs
// (#pv-portal in der Shell). So liegen sie sicher über Tab-Leiste, Kopfzeile und Upload-Anzeige,
// und der Glas-Unschärfe-Effekt wirkt auf den ganzen Bildschirm statt nur auf den Inhaltsbereich.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Portal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setTarget(document.getElementById('pv-portal'))
  }, [])
  return target ? createPortal(children, target) : null
}