export default function DatenschutzPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12" style={{ color: 'var(--foreground)' }}>
      <h1 className="text-2xl font-bold mb-2">Datenschutzerklärung</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>Stand: [21.06.2026]</p>

      <h2 className="text-lg font-bold mt-6 mb-2">1. Verantwortlicher</h2>
      <p className="mb-6 text-sm">
        Verantwortlich für die Datenverarbeitung auf dieser Website ist:<br /><br />
        [Leonie Schmidt]<br />
        [Heddernheimer Landstraße 3]<br />
        [60439] [Frankfurt am Main]<br />
        Deutschland<br />
        E-Mail: [LeonieMAIN@outlok.de]
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">2. Allgemeines zur Datenverarbeitung</h2>
      <p className="mb-6 text-sm">
        Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies zur Bereitstellung einer funktionsfähigen Website sowie unserer Inhalte und Leistungen erforderlich ist. Die Verarbeitung personenbezogener Daten erfolgt regelmäßig nur nach Einwilligung des Nutzers (Art. 6 Abs. 1 lit. a DSGVO) oder zur Erfüllung eines Vertrags bzw. vorvertraglicher Maßnahmen (Art. 6 Abs. 1 lit. b DSGVO), soweit eine gesetzliche Regelung die Verarbeitung erlaubt oder wir aufgrund eines berechtigten Interesses an der Verarbeitung handeln (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">3. Hosting und Server-Logs</h2>

      <h3 className="font-bold mt-4 mb-1">Website-Hosting (Vercel)</h3>
      <p className="mb-4 text-sm">
        Diese Website wird über die Plattform Vercel Inc. gehostet. Beim Aufruf der Website verarbeitet Vercel automatisch technische Daten (u. a. IP-Adresse, Datum und Uhrzeit der Anfrage, aufgerufene Seite), um die Website auszuliefern und Missbrauch zu verhindern. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren und funktionsfähigen Betrieb der Website (Art. 6 Abs. 1 lit. f DSGVO).<br /><br />
        Weitere Informationen:{' '}
        <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">
          https://vercel.com/legal/privacy-policy
        </a>
      </p>

      <h3 className="font-bold mt-4 mb-1">Datenbank (Supabase)</h3>
      <p className="mb-4 text-sm">
        Die Datenbank dieser Website wird bei Supabase betrieben, mit Serverstandort Frankfurt am Main (Deutschland/EU). Dort werden alle Account- und Anwendungsdaten gespeichert, die in dieser Erklärung beschrieben sind.
      </p>

      <h3 className="font-bold mt-4 mb-1">Minecraft-Server (Hetzner)</h3>
      <p className="mb-4 text-sm">
        Der zugehörige Minecraft-Server wird bei Hetzner Online GmbH betrieben. Beim Verbinden mit dem Server wird, wie bei jedem Minecraft-Server technisch erforderlich, die IP-Adresse des verbindenden Spielers kurzfristig verarbeitet.
      </p>

      <h3 className="font-bold mt-4 mb-1">Analyse-Tool (Vercel Analytics)</h3>
      <p className="mb-6 text-sm">
        Wir nutzen Vercel Analytics, um die Nutzung unserer Website statistisch auszuwerten (z. B. Seitenaufrufe). Laut Anbieterangaben werden dabei keine Cookies gesetzt und keine personenbezogenen Kennungen dauerhaft gespeichert. Rechtsgrundlage ist unser berechtigtes Interesse an der Verbesserung unseres Angebots (Art. 6 Abs. 1 lit. f DSGVO).<br /><br />
        Weitere Informationen:{' '}
        <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">
          https://vercel.com/docs/analytics/privacy-policy
        </a>
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">4. Registrierung und Nutzerkonto</h2>
      <p className="mb-3 text-sm">
        Bei der Erstellung eines Nutzerkontos erheben wir die für die Registrierung notwendigen Daten, u. a.:
      </p>
      <ul className="list-disc pl-5 mb-4 text-sm space-y-1">
        <li>Benutzername, Anzeigename</li>
        <li>Profilangaben (z. B. Biografie, Profilbild, Banner, Akzentfarbe), soweit freiwillig angegeben</li>
        <li>Minecraft-Benutzername und Minecraft-UUID (bei Verknüpfung des Minecraft-Accounts)</li>
        <li>Discord-Benutzername und Discord-ID (bei Verknüpfung über Discord-Login)</li>
        <li>Letzter Online-Zeitpunkt</li>
      </ul>
      <p className="mb-4 text-sm">
        Die Verarbeitung erfolgt zur Erfüllung des Nutzungsvertrags mit unserer Plattform (Art. 6 Abs. 1 lit. b DSGVO).
      </p>

      <h3 className="font-bold mt-4 mb-1">Login über Discord</h3>
      <p className="mb-4 text-sm">
        Für den Login steht eine Anmeldung über Discord (OAuth) zur Verfügung. Dabei werden Daten zwischen Discord und unserer Website ausgetauscht (u. a. Discord-Benutzername und Discord-ID). Es gilt zusätzlich die Datenschutzerklärung von Discord:{' '}
        <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">https://discord.com/privacy</a>
      </p>

      <h3 className="font-bold mt-4 mb-1">Verknüpfung mit Spotify</h3>
      <p className="mb-4 text-sm">
        Nutzer können optional ihr Spotify-Konto verknüpfen. Dabei wird ein Zugriffstoken gespeichert, um z. B. aktuell gehörte Musik anzeigen zu können. Diese Verknüpfung erfolgt freiwillig auf Grundlage einer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) und kann durch den Nutzer jederzeit widerrufen werden. Es gilt zusätzlich die Datenschutzerklärung von Spotify:{' '}
        <a href="https://www.spotify.com/de/legal/privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline">https://www.spotify.com/de/legal/privacy-policy/</a>
      </p>

      <h3 className="font-bold mt-4 mb-1">Verknüpfung mit Steam</h3>
      <p className="mb-6 text-sm">
        Nutzer können optional ihre Steam-ID und ihren Steam-Anzeigenamen mit ihrem Profil verknüpfen. Diese Verknüpfung erfolgt freiwillig auf Grundlage einer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) und kann jederzeit widerrufen werden.
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">5. Minecraft-Server-Funktionen</h2>
      <p className="mb-3 text-sm">Für Spieler unseres Minecraft-Servers verarbeiten wir zusätzlich:</p>
      <ul className="list-disc pl-5 mb-4 text-sm space-y-1">
        <li>Spielstatistiken (z. B. Spielzeit) zur Bereitstellung von Server-Funktionen (z. B. Claim-Limits)</li>
        <li>Inventar- und Positionsdaten, um diese auf der Website anzeigen zu können</li>
        <li>Informationen zu geclaimten Grundstücken (Claims), zugeordneten Berechtigungen und vertrauten Spielern</li>
        <li>Informationen zu platzierten Shulkerkisten und deren Inhalt</li>
      </ul>
      <p className="mb-6 text-sm">
        Diese Daten werden zur Bereitstellung der Server- und Website-Funktionen verarbeitet (Art. 6 Abs. 1 lit. b DSGVO).
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">6. Freundessystem</h2>
      <p className="mb-6 text-sm">
        Nutzer können anderen Nutzern Freundschaftsanfragen senden. Dabei wird gespeichert, wer eine Anfrage an wen gesendet hat und der Status (offen/angenommen). Rechtsgrundlage ist die Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO).
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">7. Support-System</h2>
      <p className="mb-3 text-sm">
        Nutzer können über unser Support-System Anliegen (z. B. Fehlermeldungen, Beschwerden, Vorschläge) einreichen. Dabei werden der Inhalt der Anfrage sowie der Nachrichtenverlauf zwischen Nutzer und Team gespeichert.
      </p>
      <p className="mb-6 text-sm">
        Bei bestimmten Anliegen (z. B. Beschwerden über andere Spieler) kann ein betroffener Nutzer benannt werden. In diesem Fall verarbeiten wir auch Daten über den benannten, betroffenen Nutzer, ohne dass dieser Zugriff auf das Ticket erhält, es sei denn, er wird durch unser Team nachträglich als Teilnehmer hinzugefügt. Rechtsgrundlage ist unser berechtigtes Interesse an der Aufrechterhaltung einer funktionierenden Community und Konfliktlösung (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">8. Benachrichtigungen</h2>
      <p className="mb-6 text-sm">
        Wir versenden interne Benachrichtigungen (z. B. über neue Vertrauensverhältnisse im Claim-System, Freundschaftsanfragen, Antworten auf Support-Tickets) innerhalb der Website. Hierfür werden die jeweils notwendigen Daten gespeichert. Rechtsgrundlage ist die Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO).
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">9. Cookies und lokale Speicherung</h2>
      <p className="mb-2 text-sm">
        Wir verwenden ein technisch notwendiges Session-Cookie (<code>session_token</code>), um eingeloggte Nutzer zu erkennen. Dieses Cookie ist für den Betrieb der Website zwingend erforderlich und unterliegt nicht der Einwilligungspflicht nach § 25 Abs. 2 TTDSG.
      </p>
      <p className="mb-6 text-sm" style={{ color: 'var(--muted)' }}>

      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">10. Speicherdauer</h2>
      <p className="mb-6 text-sm">
        Wir speichern personenbezogene Daten nur so lange, wie dies für die genannten Zwecke erforderlich ist, oder so lange wie der Nutzer ein aktives Konto bei uns unterhält. Nach Löschung des Kontos werden die Daten gelöscht, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">11. Rechte der Nutzer</h2>
      <p className="mb-3 text-sm">Nutzer haben das Recht:</p>
      <ul className="list-disc pl-5 mb-4 text-sm space-y-1">
        <li>Auskunft über die von uns verarbeiteten personenbezogenen Daten zu erhalten (Art. 15 DSGVO)</li>
        <li>die Berichtigung unrichtiger Daten zu verlangen (Art. 16 DSGVO)</li>
        <li>die Löschung ihrer Daten zu verlangen (Art. 17 DSGVO)</li>
        <li>die Einschränkung der Verarbeitung zu verlangen (Art. 18 DSGVO)</li>
        <li>ihre Daten in einem strukturierten, gängigen Format zu erhalten (Art. 20 DSGVO)</li>
        <li>der Verarbeitung zu widersprechen, soweit diese auf Art. 6 Abs. 1 lit. f DSGVO beruht (Art. 21 DSGVO)</li>
        <li>eine erteilte Einwilligung jederzeit zu widerrufen (Art. 7 Abs. 3 DSGVO)</li>
        <li>sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO)</li>
      </ul>
      <p className="mb-6 text-sm">
        Anfragen hierzu richten Sie bitte an die unter Punkt 1 genannte E-Mail-Adresse.
      </p>
    </div>
  )
}