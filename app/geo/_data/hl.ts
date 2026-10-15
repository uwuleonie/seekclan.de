// Erzeugt von scripts/geo/build-higherlower.mjs – nicht von Hand bearbeiten.
// Kategorien für Higher Lower (ohne Werte – die liegen nur auf dem Server in app/lib/hl-werte.json).

export type HlRegion = 'welt' | 'europa' | 'suedamerika'
export type HlGruppe = 'ernst' | 'spass' | 'absurd'
export interface HlKategorie {
  key: string; name: string; icon: string; gruppe: HlGruppe
  /** 1 = leicht … 3 = schwer (für die Start-Trefferquote der Wetten) */
  schwer: number
  einheit: string; fmt: 'gross' | 'zahl' | 'usd' | 'usd-gross'; dez: number
  quelle: string; url: string
  /** Anzahl Länder mit Wert je Region (fehlt = gibt es dort nicht) */
  regionen: Partial<Record<HlRegion, number>>
  jahr: string | null
  zusatz?: string
}

export const HL_REGIONEN: { key: HlRegion; name: string }[] = [{"key":"welt","name":"Welt"},{"key":"europa","name":"Europa"},{"key":"suedamerika","name":"Südamerika"}]

export const HL_KATEGORIEN: HlKategorie[] = [
 {
  "key": "einwohner",
  "name": "Einwohner",
  "icon": "👥",
  "gruppe": "ernst",
  "schwer": 1,
  "einheit": "",
  "fmt": "gross",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/SP.POP.TOTL",
  "regionen": {
   "welt": 195,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": "2025"
 },
 {
  "key": "flaeche",
  "name": "Fläche",
  "icon": "🗺️",
  "gruppe": "ernst",
  "schwer": 1,
  "einheit": "km²",
  "fmt": "gross",
  "dez": 0,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/AG.SRF.TOTL.K2",
  "regionen": {
   "welt": 194,
   "europa": 49,
   "suedamerika": 12
  },
  "jahr": "2023–2024"
 },
 {
  "key": "dichte",
  "name": "Einwohner pro km²",
  "icon": "🏘️",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "pro km²",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/EN.POP.DNST",
  "regionen": {
   "welt": 194,
   "europa": 49,
   "suedamerika": 12
  },
  "jahr": "2023–2024"
 },
 {
  "key": "bip",
  "name": "Wirtschaftsleistung (BIP)",
  "icon": "💰",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "US$",
  "fmt": "usd-gross",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD",
  "regionen": {
   "welt": 193,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": "2015–2025"
 },
 {
  "key": "bip-kopf",
  "name": "BIP pro Kopf",
  "icon": "💶",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "US$",
  "fmt": "usd",
  "dez": 0,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/NY.GDP.PCAP.CD",
  "regionen": {
   "welt": 193,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": "2015–2025"
 },
 {
  "key": "lebenserwartung",
  "name": "Lebenserwartung",
  "icon": "❤️",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "Jahre",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/SP.DYN.LE00.IN",
  "regionen": {
   "welt": 195,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": "2024"
 },
 {
  "key": "gluecks",
  "name": "Glücks-Wert (World Happiness Report)",
  "icon": "😊",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "von 10",
  "fmt": "zahl",
  "dez": 2,
  "quelle": "Wikipedia: World Happiness Report",
  "url": "https://en.wikipedia.org/wiki/World_Happiness_Report",
  "regionen": {
   "welt": 146,
   "europa": 45,
   "suedamerika": 10
  },
  "jahr": "2026"
 },
 {
  "key": "hdi",
  "name": "Menschliche Entwicklung (HDI)",
  "icon": "🎓",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "von 1",
  "fmt": "zahl",
  "dez": 3,
  "quelle": "Wikipedia: List of countries by Human Development Index",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_by_Human_Development_Index",
  "regionen": {
   "welt": 192,
   "europa": 48,
   "suedamerika": 12
  },
  "jahr": "2023"
 },
 {
  "key": "kinder-pro-frau",
  "name": "Kinder pro Frau",
  "icon": "👶",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "Kinder",
  "fmt": "zahl",
  "dez": 2,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/SP.DYN.TFRT.IN",
  "regionen": {
   "welt": 195,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": "2024"
 },
 {
  "key": "medianalter",
  "name": "Medianalter",
  "icon": "🎂",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "Jahre",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 193,
   "europa": 48,
   "suedamerika": 12
  },
  "jahr": "2025"
 },
 {
  "key": "senioren",
  "name": "Anteil über 65-Jährige",
  "icon": "👵",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "%",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/SP.POP.65UP.TO.ZS",
  "regionen": {
   "welt": 195,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": "2025"
 },
 {
  "key": "jugend",
  "name": "Anteil unter 15-Jährige",
  "icon": "🧒",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "%",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/SP.POP.0014.TO.ZS",
  "regionen": {
   "welt": 195,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": "2025"
 },
 {
  "key": "stadt",
  "name": "Anteil Stadtbevölkerung",
  "icon": "🏙️",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "%",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/SP.URB.TOTL.IN.ZS",
  "regionen": {
   "welt": 195,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": "2025"
 },
 {
  "key": "internet",
  "name": "Internetnutzer",
  "icon": "🌐",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "%",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/IT.NET.USER.ZS",
  "regionen": {
   "welt": 193,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": "2015–2025"
 },
 {
  "key": "handy",
  "name": "Handyverträge pro 100 Einwohner",
  "icon": "📱",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "pro 100",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/IT.CEL.SETS.P2",
  "regionen": {
   "welt": 195,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": "2021–2024"
 },
 {
  "key": "wald",
  "name": "Waldanteil",
  "icon": "🌲",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "%",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/AG.LND.FRST.ZS",
  "regionen": {
   "welt": 194,
   "europa": 49,
   "suedamerika": 12
  },
  "jahr": "2023–2024"
 },
 {
  "key": "acker",
  "name": "Anteil Ackerland",
  "icon": "🌾",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "%",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/AG.LND.ARBL.ZS",
  "regionen": {
   "welt": 191,
   "europa": 48,
   "suedamerika": 12
  },
  "jahr": "2022–2024"
 },
 {
  "key": "co2",
  "name": "CO₂ pro Kopf",
  "icon": "🏭",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "t pro Jahr",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/EN.GHG.CO2.PC.CE.AR5",
  "regionen": {
   "welt": 186,
   "europa": 43,
   "suedamerika": 12
  },
  "jahr": "2024"
 },
 {
  "key": "oekostrom",
  "name": "Strom aus Erneuerbaren",
  "icon": "⚡",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "%",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/EG.ELC.RNEW.ZS",
  "regionen": {
   "welt": 190,
   "europa": 46,
   "suedamerika": 11
  },
  "jahr": "2016–2021"
 },
 {
  "key": "arbeitslos",
  "name": "Arbeitslosenquote",
  "icon": "📉",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "%",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS",
  "regionen": {
   "welt": 179,
   "europa": 45,
   "suedamerika": 12
  },
  "jahr": "2021–2025"
 },
 {
  "key": "aerzte",
  "name": "Ärzte pro 1.000 Einwohner",
  "icon": "🩺",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "pro 1.000",
  "fmt": "zahl",
  "dez": 2,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/SH.MED.PHYS.ZS",
  "regionen": {
   "welt": 189,
   "europa": 48,
   "suedamerika": 12
  },
  "jahr": "2015–2023"
 },
 {
  "key": "betten",
  "name": "Krankenhausbetten pro 1.000 Einwohner",
  "icon": "🛏️",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "pro 1.000",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 153,
   "europa": 44,
   "suedamerika": 12
  },
  "jahr": "2015–2021"
 },
 {
  "key": "mutter-alter",
  "name": "Alter der Mutter beim ersten Kind",
  "icon": "🍼",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "Jahre",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 129,
   "europa": 47
  },
  "jahr": "2008–2023"
 },
 {
  "key": "bildung",
  "name": "Ausgaben für Bildung",
  "icon": "📚",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "% des BIP",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/SE.XPD.TOTL.GD.ZS",
  "regionen": {
   "welt": 180,
   "europa": 46,
   "suedamerika": 11
  },
  "jahr": "2016–2025"
 },
 {
  "key": "export",
  "name": "Exporte",
  "icon": "📦",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "% des BIP",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/NE.EXP.GNFS.ZS",
  "regionen": {
   "welt": 173,
   "europa": 47,
   "suedamerika": 10
  },
  "jahr": "2015–2025"
 },
 {
  "key": "militaer",
  "name": "Militärausgaben",
  "icon": "🪖",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "% des BIP",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 164,
   "europa": 43,
   "suedamerika": 12
  },
  "jahr": "2019–2025"
 },
 {
  "key": "gini",
  "name": "Ungleichheit (Gini-Index)",
  "icon": "⚖️",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "von 100",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 145,
   "europa": 42,
   "suedamerika": 10
  },
  "jahr": "2015–2024"
 },
 {
  "key": "flugpassagiere",
  "name": "Flugpassagiere pro Jahr",
  "icon": "✈️",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "",
  "fmt": "gross",
  "dez": 1,
  "quelle": "Weltbank",
  "url": "https://data.worldbank.org/indicator/IS.AIR.PSGR",
  "regionen": {
   "welt": 152,
   "europa": 40,
   "suedamerika": 10
  },
  "jahr": "2022–2023"
 },
 {
  "key": "hoechster-punkt",
  "name": "Höchster Punkt",
  "icon": "🏔️",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "m",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 191,
   "europa": 47,
   "suedamerika": 11
  },
  "jahr": null,
  "zusatz": "berg"
 },
 {
  "key": "mittlere-hoehe",
  "name": "Mittlere Höhe des Landes",
  "icon": "⛰️",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "m",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 162,
   "europa": 44,
   "suedamerika": 12
  },
  "jahr": null
 },
 {
  "key": "kueste",
  "name": "Küstenlänge",
  "icon": "🌊",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "km",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 194,
   "europa": 49,
   "suedamerika": 12
  },
  "jahr": null,
  "zusatz": "kueste"
 },
 {
  "key": "grenze",
  "name": "Länge der Landgrenzen",
  "icon": "🧱",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "km",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 194,
   "europa": 49,
   "suedamerika": 12
  },
  "jahr": null
 },
 {
  "key": "hauptstadt-hoehe",
  "name": "Höhe der Hauptstadt",
  "icon": "🏛️",
  "gruppe": "ernst",
  "schwer": 3,
  "einheit": "m",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Wikipedia: List of capital cities by elevation",
  "url": "https://en.wikipedia.org/wiki/List_of_capital_cities_by_elevation",
  "regionen": {
   "welt": 195,
   "europa": 50,
   "suedamerika": 12
  },
  "jahr": null
 },
 {
  "key": "temperatur",
  "name": "Durchschnittstemperatur",
  "icon": "🌡️",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "°C",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Wikipedia: List of countries by average yearly temperature",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_by_average_yearly_temperature",
  "regionen": {
   "welt": 196,
   "europa": 51,
   "suedamerika": 12
  },
  "jahr": null
 },
 {
  "key": "hauptstadt-einw",
  "name": "Einwohner der Hauptstadt (Ballungsraum)",
  "icon": "🌆",
  "gruppe": "ernst",
  "schwer": 2,
  "einheit": "",
  "fmt": "gross",
  "dez": 2,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 117,
   "europa": 28,
   "suedamerika": 10
  },
  "jahr": "2018–2023",
  "zusatz": "hauptstadt"
 },
 {
  "key": "nachbarn",
  "name": "Anzahl Nachbarländer",
  "icon": "🤝",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "Länder",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "mledoze/countries",
  "url": "https://github.com/mledoze/countries",
  "regionen": {
   "welt": 197,
   "europa": 51,
   "suedamerika": 12
  },
  "jahr": null
 },
 {
  "key": "sprachen",
  "name": "Anzahl Amtssprachen",
  "icon": "🗣️",
  "gruppe": "spass",
  "schwer": 3,
  "einheit": "Sprachen",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "mledoze/countries",
  "url": "https://github.com/mledoze/countries",
  "regionen": {
   "welt": 197,
   "europa": 51,
   "suedamerika": 12
  },
  "jahr": null
 },
 {
  "key": "olympia",
  "name": "Olympia-Medaillen (alle Zeiten)",
  "icon": "🥇",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "Medaillen",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Wikipedia: All-time Olympic Games medal table",
  "url": "https://en.wikipedia.org/wiki/All-time_Olympic_Games_medal_table",
  "regionen": {
   "welt": 138,
   "europa": 46,
   "suedamerika": 11
  },
  "jahr": "2026"
 },
 {
  "key": "nobel",
  "name": "Nobelpreisträger",
  "icon": "🏅",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "Personen",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Wikipedia: List of Nobel laureates by country",
  "url": "https://en.wikipedia.org/wiki/List_of_Nobel_laureates_by_country",
  "regionen": {
   "welt": 79,
   "europa": 32
  },
  "jahr": "2025"
 },
 {
  "key": "eurovision",
  "name": "Eurovision-Siege",
  "icon": "🎤",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "Siege",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Wikipedia: List of Eurovision Song Contest winners",
  "url": "https://en.wikipedia.org/wiki/List_of_Eurovision_Song_Contest_winners",
  "regionen": {
   "europa": 47
  },
  "jahr": "2026"
 },
 {
  "key": "groesse",
  "name": "Durchschnittsgröße der Männer",
  "icon": "📏",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "cm",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Wikipedia: Human height by country",
  "url": "https://en.wikipedia.org/wiki/Human_height_by_country",
  "regionen": {
   "welt": 88,
   "europa": 14
  },
  "jahr": null
 },
 {
  "key": "autos",
  "name": "Autos pro 1.000 Einwohner",
  "icon": "🚗",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "pro 1.000",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Wikipedia: List of countries and territories by motor vehicles per capita",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_and_territories_by_motor_vehicles_per_capita",
  "regionen": {
   "welt": 171,
   "europa": 49,
   "suedamerika": 10
  },
  "jahr": "2007–2025"
 },
 {
  "key": "bier",
  "name": "Bier pro Kopf",
  "icon": "🍺",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "Liter pro Jahr",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Wikipedia: List of countries by beer consumption per capita",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_by_beer_consumption_per_capita",
  "regionen": {
   "welt": 61,
   "europa": 29
  },
  "jahr": "2013–2024",
  "zusatz": "bier"
 },
 {
  "key": "wein",
  "name": "Wein pro Kopf",
  "icon": "🍷",
  "gruppe": "spass",
  "schwer": 3,
  "einheit": "Liter reiner Alkohol",
  "fmt": "zahl",
  "dez": 2,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 186,
   "europa": 45,
   "suedamerika": 12
  },
  "jahr": "2019"
 },
 {
  "key": "alkohol",
  "name": "Alkohol pro Kopf",
  "icon": "🥃",
  "gruppe": "spass",
  "schwer": 3,
  "einheit": "Liter reiner Alkohol",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 186,
   "europa": 45,
   "suedamerika": 12
  },
  "jahr": "2019"
 },
 {
  "key": "tee",
  "name": "Tee pro Kopf",
  "icon": "🍵",
  "gruppe": "spass",
  "schwer": 3,
  "einheit": "kg pro Jahr",
  "fmt": "zahl",
  "dez": 2,
  "quelle": "Wikipedia: List of countries by tea consumption per capita",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_by_tea_consumption_per_capita",
  "regionen": {
   "welt": 54,
   "europa": 26
  },
  "jahr": null,
  "zusatz": "tee"
 },
 {
  "key": "milch",
  "name": "Milch pro Kopf",
  "icon": "🥛",
  "gruppe": "spass",
  "schwer": 3,
  "einheit": "kg pro Jahr",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Wikipedia: List of countries by milk consumption per capita",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_by_milk_consumption_per_capita",
  "regionen": {
   "welt": 175,
   "europa": 45,
   "suedamerika": 12
  },
  "jahr": "2013",
  "zusatz": "milch"
 },
 {
  "key": "fleisch",
  "name": "Fleisch pro Kopf",
  "icon": "🥩",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "kg pro Jahr",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Wikipedia: List of countries by meat consumption",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_by_meat_consumption",
  "regionen": {
   "welt": 164,
   "europa": 45,
   "suedamerika": 12
  },
  "jahr": "2020",
  "zusatz": "fleisch"
 },
 {
  "key": "kaffee-ernte",
  "name": "Kaffee-Ernte",
  "icon": "☕",
  "gruppe": "spass",
  "schwer": 3,
  "einheit": "Tonnen",
  "fmt": "gross",
  "dez": 1,
  "quelle": "Wikipedia: List of countries by coffee production",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_by_coffee_production",
  "regionen": {
   "welt": 36
  },
  "jahr": null
 },
 {
  "key": "rauchen",
  "name": "Anteil Raucher",
  "icon": "🚬",
  "gruppe": "spass",
  "schwer": 3,
  "einheit": "%",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 166,
   "europa": 44,
   "suedamerika": 10
  },
  "jahr": "2020–2025"
 },
 {
  "key": "adipositas",
  "name": "Starkes Übergewicht (Erwachsene)",
  "icon": "⚖️",
  "gruppe": "spass",
  "schwer": 3,
  "einheit": "%",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 189,
   "europa": 45,
   "suedamerika": 12
  },
  "jahr": "2014–2016"
 },
 {
  "key": "flughaefen",
  "name": "Flughäfen und Flugplätze",
  "icon": "🛫",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "Stück",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 190,
   "europa": 45,
   "suedamerika": 12
  },
  "jahr": "2025"
 },
 {
  "key": "schiene",
  "name": "Länge des Schienennetzes",
  "icon": "🚆",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "km",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 133,
   "europa": 42,
   "suedamerika": 10
  },
  "jahr": "2008–2023",
  "zusatz": "schiene"
 },
 {
  "key": "milliardaere",
  "name": "Milliardäre",
  "icon": "💎",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "Personen",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Wikipedia: List of countries by number of billionaires",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_by_number_of_billionaires",
  "regionen": {
   "welt": 74,
   "europa": 36
  },
  "jahr": "2026"
 },
 {
  "key": "inseln",
  "name": "Anzahl Inseln",
  "icon": "🏝️",
  "gruppe": "spass",
  "schwer": 3,
  "einheit": "Inseln",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Wikipedia: List of countries by number of islands",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_by_number_of_islands",
  "regionen": {
   "welt": 95,
   "europa": 25
  },
  "jahr": null
 },
 {
  "key": "atomkraft",
  "name": "Atomreaktoren in Betrieb",
  "icon": "☢️",
  "gruppe": "spass",
  "schwer": 2,
  "einheit": "Reaktoren",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Wikipedia: Nuclear power by country",
  "url": "https://en.wikipedia.org/wiki/Nuclear_power_by_country",
  "regionen": {
   "welt": 34,
   "europa": 19
  },
  "jahr": null
 },
 {
  "key": "breitband",
  "name": "Festnetz-Internet pro 100 Einwohner",
  "icon": "📶",
  "gruppe": "spass",
  "schwer": 3,
  "einheit": "pro 100",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 192,
   "europa": 48,
   "suedamerika": 12
  },
  "jahr": "2019–2023"
 },
 {
  "key": "name-laenge",
  "name": "Buchstaben im deutschen Ländernamen",
  "icon": "🔤",
  "gruppe": "absurd",
  "schwer": 2,
  "einheit": "Buchstaben",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "eigene Zählung (Atlas-Namen)",
  "url": "",
  "regionen": {
   "welt": 197,
   "europa": 51,
   "suedamerika": 12
  },
  "jahr": null,
  "zusatz": "name"
 },
 {
  "key": "saarlaender",
  "name": "Fläche in Saarländern",
  "icon": "📐",
  "gruppe": "absurd",
  "schwer": 2,
  "einheit": "Saarländer",
  "fmt": "zahl",
  "dez": 1,
  "quelle": "Weltbank-Fläche ÷ Saarland (2.569,69 km²)",
  "url": "https://de.wikipedia.org/wiki/Saarland",
  "regionen": {
   "welt": 194,
   "europa": 49,
   "suedamerika": 12
  },
  "jahr": "2023–2024"
 },
 {
  "key": "heliports",
  "name": "Hubschrauber-Landeplätze",
  "icon": "🚁",
  "gruppe": "absurd",
  "schwer": 3,
  "einheit": "Stück",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 144,
   "europa": 48,
   "suedamerika": 11
  },
  "jahr": "2025"
 },
 {
  "key": "schiffe",
  "name": "Handelsschiffe unter eigener Flagge",
  "icon": "🚢",
  "gruppe": "absurd",
  "schwer": 3,
  "einheit": "Schiffe",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "CIA World Factbook",
  "url": "https://github.com/factbook/factbook.json",
  "regionen": {
   "welt": 165,
   "europa": 41,
   "suedamerika": 12
  },
  "jahr": "2022–2023"
 },
 {
  "key": "mcdonalds",
  "name": "McDonald’s-Filialen",
  "icon": "🍟",
  "gruppe": "absurd",
  "schwer": 2,
  "einheit": "Filialen",
  "fmt": "zahl",
  "dez": 0,
  "quelle": "Wikipedia: List of countries with McDonald's restaurants",
  "url": "https://en.wikipedia.org/wiki/List_of_countries_with_McDonald's_restaurants",
  "regionen": {
   "welt": 92,
   "europa": 39,
   "suedamerika": 10
  },
  "jahr": "2025",
  "zusatz": "mcdonalds"
 },
 {
  "key": "bigmac",
  "name": "Preis eines Big Mac",
  "icon": "🍔",
  "gruppe": "absurd",
  "schwer": 3,
  "einheit": "US$",
  "fmt": "zahl",
  "dez": 2,
  "quelle": "The Economist – Big-Mac-Index",
  "url": "https://github.com/TheEconomist/big-mac-data",
  "regionen": {
   "welt": 52,
   "europa": 13
  },
  "jahr": "2026"
 }
]

export const HL_KAT: Record<string, HlKategorie> = Object.fromEntries(HL_KATEGORIEN.map(k => [k.key, k]))