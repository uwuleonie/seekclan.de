import Link from 'next/link'
import Icon from '../_components/Icon'

// Mikeys Profilseite im privaten Bereich. Über den kleinen Profil-Umschalter
// (Seitenleiste bzw. Menü am Handy) erreichbar — bewusst schlicht gehalten.
export default function MikeyPage() {
  return (
    <div className="pv-page" style={{ maxWidth: 760 }}>
      <section className="pv-glass pv-hero">
        <div>
          <p className="pv-eyebrow">Profil</p>
          <h1 className="pv-title">Hey Mikey</h1>
          <p className="pv-subtitle">Hier geht es direkt zu den gemeinsamen Bereichen.</p>
        </div>
        <span className="pv-brand-mark" style={{ width: 64, height: 64, fontSize: 32, borderRadius: 20 }}>M</span>
      </section>

      <section className="pv-glass pv-card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Link href="/private/dateien" className="pv-tile-link">
          <span className="pv-tile-icon"><Icon name="share" /></span>
          <span className="pv-grow">
            <b style={{ display: 'block' }}>Quick Share</b>
            <span className="pv-muted" style={{ fontSize: 13 }}>Eigene Ablage für Fotos, Videos und Dateien</span>
          </span>
          <Icon name="next" size={16} />
        </Link>
        <Link href="/private/geoguessr" className="pv-tile-link">
          <span className="pv-tile-icon"><Icon name="globe" /></span>
          <span className="pv-grow">
            <b style={{ display: 'block' }}>GeoGuessr</b>
            <span className="pv-muted" style={{ fontSize: 13 }}>Regionen & Präfekturen lernen</span>
          </span>
          <Icon name="next" size={16} />
        </Link>
      </section>
    </div>
  )
}