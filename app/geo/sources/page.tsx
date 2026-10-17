import { permanentRedirect } from 'next/navigation'

// /geo/sources → /geo/quellen
export default function SourcesPage() {
  permanentRedirect('/geo/quellen')
}
