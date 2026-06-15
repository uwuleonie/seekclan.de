const FLAGS: Record<string, string> = {
  // Deutschland & Nachbarn
  'deutschland': 'de', 'germany': 'de',
  'frankreich': 'fr', 'france': 'fr',
  'spanien': 'es', 'spain': 'es',
  'portugal': 'pt',
  'england': 'gb-eng', 'großbritannien': 'gb',
  'italien': 'it', 'italy': 'it',
  'niederlande': 'nl', 'holland': 'nl',
  'belgien': 'be', 'belgium': 'be',
  'schweiz': 'ch', 'switzerland': 'ch',
  'österreich': 'at', 'austria': 'at',
  'polen': 'pl', 'poland': 'pl',
  'tschechien': 'cz', 'czech republic': 'cz',
  'kroatien': 'hr', 'croatia': 'hr',
  'serbien': 'rs', 'serbia': 'rs',
  'dänemark': 'dk', 'denmark': 'dk',
  'schweden': 'se', 'sweden': 'se',
  'norwegen': 'no', 'norway': 'no',
  'finnland': 'fi', 'finland': 'fi',
  'schottland': 'gb-sct',
  'wales': 'gb-wls',
  'irland': 'ie', 'ireland': 'ie',
  'türkei': 'tr', 'turkey': 'tr',
  'ukraine': 'ua',
  'russland': 'ru', 'russia': 'ru',
  'ungarn': 'hu', 'hungary': 'hu',
  'rumänien': 'ro', 'romania': 'ro',
  'slowakei': 'sk', 'slovakia': 'sk',
  'slowenien': 'si', 'slovenia': 'si',
  'albanien': 'al', 'albania': 'al',
  'georgien': 'ge', 'georgia': 'ge',
  // Südamerika
  'brasilien': 'br', 'brazil': 'br',
  'argentinien': 'ar', 'argentina': 'ar',
  'kolumbien': 'co', 'colombia': 'co',
  'uruguay': 'uy',
  'chile': 'cl',
  'ecuador': 'ec',
  'peru': 'pe',
  'venezuela': 've',
  'paraguay': 'py',
  'bolivien': 'bo', 'bolivia': 'bo',
  // Nordamerika
  'usa': 'us', 'united states': 'us', 'vereinigte staaten': 'us',
  'mexiko': 'mx', 'mexico': 'mx',
  'kanada': 'ca', 'canada': 'ca',
  'costa rica': 'cr',
  'panama': 'pa',
  'jamaika': 'jm', 'jamaica': 'jm',
  // Asien
  'japan': 'jp',
  'südkorea': 'kr', 'south korea': 'kr', 'korea': 'kr',
  'china': 'cn',
  'australien': 'au', 'australia': 'au',
  'saudi arabien': 'sa', 'saudi arabia': 'sa',
  'iran': 'ir',
  'irak': 'iq', 'iraq': 'iq',
  'katar': 'qa', 'qatar': 'qa',
  'vereinigte arabische emirate': 'ae', 'uae': 'ae',
  'indien': 'in', 'india': 'in',
  // Afrika
  'marokko': 'ma', 'morocco': 'ma',
  'ägypten': 'eg', 'egypt': 'eg',
  'nigeria': 'ng',
  'senegal': 'sn',
  'ghana': 'gh',
  'kamerun': 'cm', 'cameroon': 'cm',
  'südafrika': 'za', 'south africa': 'za',
  'tunesien': 'tn', 'tunisia': 'tn',
  'algerien': 'dz', 'algeria': 'dz',
  'elfenbeinküste': 'ci', 'ivory coast': 'ci',
  'mali': 'ml',
}

export function getFlagUrl(teamName: string): string | null {
  // Emoji-Flagge entfernen und bereinigen
  const clean = teamName.replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, '').trim().toLowerCase()
  
  const code = FLAGS[clean]
  if (!code) return null
  
  return `https://flagcdn.com/w40/${code}.png`
}