export default function ImpressumPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 prose" style={{ color: 'var(--foreground)' }}>
      <h1 className="text-2xl font-bold mb-6">Impressum</h1>

      <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</p>

      <p className="mb-6">
        [Leonie Schmidt]<br />
        [Heddernheimer Landstraße 3]<br />
        [60439] [Frankfurt am Main]<br />
        Deutschland
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">Kontakt</h2>
      <p className="mb-6">E-Mail: [LeonieMAIN@outlok.de]</p>

      <h2 className="text-lg font-bold mt-6 mb-2">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p className="mb-6">
        [Leonie Schmidt]<br />
        [Heddernheimer Landstraße 3]<br />
        [60439] [Frankfurt am Main]
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">Streitschlichtung</h2>
      <p className="mb-6 text-sm">
        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="underline">
          https://ec.europa.eu/consumers/odr/
        </a>
        <br /><br />
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">Haftung für Inhalte</h2>
      <p className="mb-6 text-sm">
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        <br /><br />
        Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">Haftung für Links</h2>
      <p className="mb-6 text-sm">
        Unser Angebot enthält gegebenenfalls Links zu externen Webseiten Dritter (z. B. Discord, Spotify, Steam), auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">Urheberrecht</h2>
      <p className="mb-6 text-sm">
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Beiträge Dritter (z. B. von Nutzern hochgeladene Inhalte) sind als solche gekennzeichnet.
      </p>
    </div>
  )
}